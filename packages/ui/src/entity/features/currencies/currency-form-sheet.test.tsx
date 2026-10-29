/**
 * CurrencyFormSheet pending/expiry rule pickers read every page of their
 * catalog, so a rule past the first 100 stays selectable, and a failed page
 * shows the picker's error state instead of a silently partial list.
 */

import type * as LoomSdk from "@loom-loyalty/sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listPendingRules = vi.fn();
const listExpiryRules = vi.fn();

vi.mock("@loom-loyalty/sdk", async () => {
  const actual = await vi.importActual<typeof LoomSdk>("@loom-loyalty/sdk");
  return {
    ...actual,
    programBankManagementListPendingRules: (params: unknown) => listPendingRules(params),
    programBankManagementListExpiryRules: (params: unknown) => listExpiryRules(params),
  };
});

vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({ id }: { id?: string }): ReactNode => <input id={id} readOnly />,
  useMetadataField: () => ({
    createMetadata: vi.fn(),
    findOption: vi.fn(),
    isTypeNotFound: false,
  }),
}));

vi.mock("../../../forms/program-field/index.js", () => ({
  ProgramMultiField: (): ReactNode => <div data-mock="program-multi-field" />,
  useProgramField: () => ({ createProgram: vi.fn(), isCreating: false }),
}));

import { CurrencyFormSheet } from "./currency-form-sheet";

function rulePage(
  idKey: "pendingRuleId" | "expiryRuleId",
  label: string,
  page: number,
  totalPages: number
) {
  return Promise.resolve({
    status: 200,
    data: {
      content: [
        { [idKey]: `${idKey}-${page}`, name: `${label} ${page}`, code: `${label}-${page}` },
      ],
      pageNumber: page,
      totalPages,
    },
  });
}

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CurrencyFormSheet
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    </QueryClientProvider>
  );
}

describe("CurrencyFormSheet rule pickers", () => {
  beforeEach(() => {
    listPendingRules.mockReset();
    listExpiryRules.mockReset();
  });

  it("offers rules from every page at size 100", async () => {
    listPendingRules.mockImplementation(({ page }: { page: number }) =>
      rulePage("pendingRuleId", "Pending", page, 2)
    );
    listExpiryRules.mockImplementation(({ page }: { page: number }) =>
      rulePage("expiryRuleId", "Expiry", page, 3)
    );

    renderSheet();

    await waitFor(() => expect(listExpiryRules).toHaveBeenCalledTimes(3));
    expect(listPendingRules).toHaveBeenCalledTimes(2);
    expect(listExpiryRules).toHaveBeenLastCalledWith({ page: 2, size: 100 });
    expect(listPendingRules).toHaveBeenLastCalledWith({ page: 1, size: 100 });

    const expiryTrigger = screen.getByRole("combobox", { name: /select expiry rule/i });
    await waitFor(() => expect(expiryTrigger).toBeEnabled());
    await userEvent.click(expiryTrigger);
    expect(await screen.findByText("Expiry 2")).toBeInTheDocument();
    expect(screen.getByText("Expiry 0")).toBeInTheDocument();
  });

  it("shows the error state when a page fails instead of a partial list", async () => {
    listPendingRules.mockImplementation(({ page }: { page: number }) =>
      page === 0
        ? rulePage("pendingRuleId", "Pending", 0, 2)
        : Promise.reject(new Error("pending rules page 2 failed"))
    );
    listExpiryRules.mockImplementation(({ page }: { page: number }) =>
      rulePage("expiryRuleId", "Expiry", page, 1)
    );

    renderSheet();

    expect(await screen.findByText("Failed to load pending rule")).toBeInTheDocument();
    expect(screen.getByText("pending rules page 2 failed")).toBeInTheDocument();
  });
});
