/**
 * CustomerMergeSheet.
 *
 * The sheet never builds the merged customer itself: it asks the app for a
 * preview on entering step 2 (and again after a survivor change), shows what
 * comes back, and only merges after an explicit confirm naming the survivor.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomerMergeSheet, type CustomerMergeSheetProps } from "../customer-merge-sheet";
import type { CustomerData } from "../types";

const CURRENT = { customerId: "cust_a", name: "Sarah Chen", detail: "sarah@example.com" };
const OTHER = { customerId: "cust_b", name: "Sara Chen", detail: "sara@example.com" };

const PREVIEW: CustomerData = {
  customer: {
    customerId: "",
    identity: { firstName: "Sarah", lastName: "Chen" },
    statusCode: "ACTIVE",
    statusName: "Active",
    fraudStatusCode: "CLEAN",
    enrollmentChannel: "WEB",
    enrollmentDateTime: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  },
  emails: [
    {
      id: "e1",
      emailAddress: "sarah@example.com",
      typeCode: "PERSONAL",
      typeName: "Personal",
      primary: true,
      status: "ACTIVE",
      verified: true,
    },
  ],
  phones: [],
  addresses: [],
  programs: [],
  tiers: [],
  badges: [],
  currencies: [],
  ledger: [],
  segments: [],
  events: [],
  preferences: [],
  identifiers: [],
  coupons: [],
  tags: [],
};

function setup(overrides: Partial<CustomerMergeSheetProps> = {}) {
  const props: CustomerMergeSheetProps = {
    open: true,
    onOpenChange: vi.fn(),
    current: CURRENT,
    searchValue: "chen",
    onSearchValueChange: vi.fn(),
    searchResults: [OTHER],
    onPreview: vi.fn(),
    preview: null,
    onConfirm: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const view = render(<CustomerMergeSheet {...props} />);
  return { props, user: userEvent.setup(), ...view };
}

describe("CustomerMergeSheet", () => {
  it("keeps Preview disabled until the other customer is chosen", async () => {
    const { user } = setup();
    expect(screen.getByRole("button", { name: "Preview merge" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Sara Chen/ }));

    expect(screen.getByRole("radio", { name: /Sarah Chen/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Preview merge" })).toBeEnabled();
  });

  it("requests a preview for the chosen survivor and again after a swap", async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole("button", { name: /Sara Chen/ }));
    await user.click(screen.getByRole("button", { name: "Preview merge" }));
    expect(props.onPreview).toHaveBeenLastCalledWith({ survivorId: "cust_a", sourceId: "cust_b" });

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("radio", { name: /Sara Chen/ }));
    await user.click(screen.getByRole("button", { name: "Preview merge" }));
    expect(props.onPreview).toHaveBeenLastCalledWith({ survivorId: "cust_b", sourceId: "cust_a" });
  });

  it("shows the merged customer with the warnings and the later-arrival note", async () => {
    const { user, rerender, props } = setup();
    await user.click(screen.getByRole("button", { name: /Sara Chen/ }));
    await user.click(screen.getByRole("button", { name: "Preview merge" }));
    expect(screen.getByRole("button", { name: "Merge…" })).toBeDisabled();

    rerender(<CustomerMergeSheet {...props} preview={PREVIEW} />);

    expect(screen.getByText("Preview, not saved")).toBeInTheDocument();
    expect(screen.getByText(/Tiers, badges and point balances move over/)).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    expect(screen.getByText(/gets a new customer ID/)).toBeInTheDocument();
    expect(screen.getByText(/sign in again on the Rewards Portal/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sarah Chen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Merge…" })).toBeEnabled();
  });

  it("merges only after confirming, naming the survivor", async () => {
    const { user, rerender, props } = setup();
    await user.click(screen.getByRole("button", { name: /Sara Chen/ }));
    await user.click(screen.getByRole("radio", { name: /Sara Chen/ }));
    await user.click(screen.getByRole("button", { name: "Preview merge" }));
    rerender(<CustomerMergeSheet {...props} preview={PREVIEW} />);

    await user.click(screen.getByRole("button", { name: "Merge…" }));
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Sarah Chen will be merged into Sara Chen.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Merge into Sara Chen" }));
    expect(props.onConfirm).toHaveBeenCalledWith({ survivorId: "cust_b", sourceId: "cust_a" });
  });

  it("starts over at the choose step after it is closed from outside", async () => {
    const { user, rerender, props } = setup();
    await user.click(screen.getByRole("button", { name: /Sara Chen/ }));
    await user.click(screen.getByRole("button", { name: "Preview merge" }));

    rerender(<CustomerMergeSheet {...props} open={false} />);
    rerender(<CustomerMergeSheet {...props} open />);

    expect(screen.getByRole("button", { name: "Preview merge" })).toBeDisabled();
    expect(screen.getByLabelText("Other customer")).toBeInTheDocument();
  });

  it("shows a refusal inline", () => {
    setup({ error: "These customers are already merged." });
    expect(screen.getByRole("alert")).toHaveTextContent("These customers are already merged.");
  });

  it("shows and announces the search hint when nothing matches", () => {
    setup({ searchResults: [], searchHint: "Type at least 3 characters to search." });
    expect(screen.getAllByText("Type at least 3 characters to search.")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Type at least 3 characters to search.");
  });

  it("announces searching and the number of matches", () => {
    const { rerender, props } = setup({ searchResults: [], searchLoading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Searching customers…");

    rerender(<CustomerMergeSheet {...props} searchResults={[OTHER]} searchLoading={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 matching customer");
  });

  it("moves focus to the survivor choice and back to the search", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Sara Chen/ }));
    expect(screen.getByRole("radio", { name: /Sarah Chen/ })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Choose a different customer" }));
    expect(screen.getByLabelText("Other customer")).toHaveFocus();
  });
});
