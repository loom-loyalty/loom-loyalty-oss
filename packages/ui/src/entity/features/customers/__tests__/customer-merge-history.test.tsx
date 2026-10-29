/**
 * CustomerMergedBanner and CustomerMergeHistory.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomerMergedBanner, CustomerMergeHistory } from "../customer-merge-history";

describe("CustomerMergedBanner", () => {
  it("links to the customer this one was merged into", async () => {
    const onView = vi.fn();
    render(<CustomerMergedBanner mergedCustomerId="cust_new" onViewMergedCustomer={onView} />);

    expect(screen.getByRole("status")).toHaveTextContent("merged into another customer");
    await userEvent.click(screen.getByRole("button", { name: "View merged customer" }));
    expect(onView).toHaveBeenCalledWith("cust_new");
  });

  it("still says the customer was merged when the merge record can't be read", () => {
    render(<CustomerMergedBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("This customer was merged.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("CustomerMergeHistory", () => {
  it("lists source customers, status and replay progress, highlighting failures", async () => {
    const onView = vi.fn();
    render(
      <CustomerMergeHistory
        onViewCustomer={onView}
        entries={[
          {
            consolidationId: "con_1",
            sourceCustomerIds: ["cust_a", "cust_b"],
            createdDateTime: "2026-10-22T15:00:00Z",
            status: "REPLAY_IN_PROGRESS",
            totalEvents: 40,
            processedEvents: 12,
            failedEvents: 2,
          },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Merged from" })).toBeInTheDocument();
    expect(screen.getByText("Replaying events")).toBeInTheDocument();
    expect(screen.getByText("12 of 40 events replayed")).toBeInTheDocument();
    expect(screen.getByText("2 events failed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "cust_b" }));
    expect(onView).toHaveBeenCalledWith("cust_b");
  });

  it("shows an unknown status as-is and renders nothing with no merges", () => {
    const { rerender, container } = render(
      <CustomerMergeHistory
        entries={[{ consolidationId: "con_1", sourceCustomerIds: ["cust_a"], status: "ARCHIVED" }]}
      />
    );
    expect(screen.getByText("ARCHIVED")).toBeInTheDocument();

    rerender(<CustomerMergeHistory entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
