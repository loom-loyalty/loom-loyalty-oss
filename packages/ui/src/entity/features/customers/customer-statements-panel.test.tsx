import type { ProgramLedgerStatement } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CustomerStatementsPanel,
  type CustomerStatementsPanelProps,
} from "./customer-statements-panel";

const NOW = new Date("2026-11-18T14:28:00Z");

const POINTS_LEDGER = "pldg_0000000000000000000000000000000a";
const MILES_LEDGER = "pldg_0000000000000000000000000000000b";

/** October 2026, with distinct non-zero figures so a swapped field shows. */
const OCTOBER: ProgramLedgerStatement = {
  programLedgerStatementId: "plst_000000000000000000000000000000a1",
  programAccountId: "pacc_0000000000000000000000000000000a",
  programLedgerId: POINTS_LEDGER,
  status: "ACTIVE",
  statementDateTime: "2026-11-01T03:00:12Z",
  periodStartDateTime: "2026-10-01T00:00:00Z",
  periodEndDateTime: "2026-11-01T00:00:00Z",
  periodCreditAmount: 1250,
  periodCreditCount: 4,
  periodDebitAmount: 300,
  periodDebitCount: 1,
  closingAvailable: 2140,
  closingPending: 75,
  closingExpired: 60,
  closingEarned: 2500,
  closingPosted: 2425,
  closingDebited: 285,
  highWaterMarkEntryPkId: 991,
};

const SEPTEMBER: ProgramLedgerStatement = {
  ...OCTOBER,
  programLedgerStatementId: "plst_000000000000000000000000000000a0",
  statementDateTime: "2026-10-01T03:00:09Z",
  periodStartDateTime: "2026-09-01T00:00:00Z",
  periodEndDateTime: "2026-10-01T00:00:00Z",
  periodCreditAmount: 800,
  periodDebitAmount: 120,
  closingAvailable: 1190,
};

function renderPanel(overrides: Partial<CustomerStatementsPanelProps> = {}) {
  const props: CustomerStatementsPanelProps = {
    currencies: [
      { ledgerId: POINTS_LEDGER, label: "Points" },
      { ledgerId: MILES_LEDGER, label: "Miles" },
    ],
    selectedLedgerId: POINTS_LEDGER,
    onLedgerChange: vi.fn(),
    range: { start: "2025-11-01", end: "2026-10-31" },
    onRangeChange: vi.fn(),
    latest: { status: "ready", statement: OCTOBER },
    list: {
      status: "ready",
      // The API returns a page in no set order; the panel shows it newest first.
      statements: [SEPTEMBER, OCTOBER],
      page: 1,
      totalPages: 1,
      onPageChange: vi.fn(),
    },
    now: NOW,
    ...overrides,
  };
  render(<CustomerStatementsPanel {...props} />);
  return props;
}

function latestFigure(label: string): string {
  const latest = screen.getByRole("region", { name: /latest statement/i });
  const term = within(latest).getByText(label, { selector: "dt" });
  return term.nextElementSibling?.textContent ?? "";
}

describe("CustomerStatementsPanel", () => {
  it("case 25: shows the selected currency's newest statement in UTC days", () => {
    renderPanel();
    const latest = screen.getByRole("region", { name: /latest statement/i });
    // periodEnd is the exclusive midnight, so October ends on Oct 31 (not Nov 1, nor Sep 30 in CT).
    expect(within(latest).getByText("Oct 1, 2026 – Oct 31, 2026")).toBeInTheDocument();
    expect(latestFigure("Credits")).toBe("1,250");
    expect(latestFigure("Debits")).toBe("300");
    expect(latestFigure("Closing available")).toBe("2,140");
    expect(latestFigure("Pending")).toBe("75");
    expect(latestFigure("Expired (to date)")).toBe("60");
  });

  it("case 25: switches currency", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: "Miles" }));
    expect(props.onLedgerChange).toHaveBeenCalledWith(MILES_LEDGER);
    expect(screen.getByRole("radio", { name: "Points" })).toHaveAttribute("data-state", "on");
  });

  it("case 25: a member in one currency gets no switcher", () => {
    renderPanel({ currencies: [{ ledgerId: POINTS_LEDGER, label: "Points" }] });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Currency" })).not.toBeInTheDocument();
  });

  it("case 26: lists the range's statements newest first", () => {
    renderPanel();
    const table = screen.getByRole("table", { name: /statements in range/i });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Oct 1, 2026 – Oct 31, 2026");
    expect(rows[0]).toHaveTextContent("2,140");
    expect(rows[1]).toHaveTextContent("Sep 1, 2026 – Sep 30, 2026");
    expect(rows[1]).toHaveTextContent("1,190");
  });

  it("case 26: pages through the API, not a client slice", () => {
    const onPageChange = vi.fn();
    renderPanel({
      list: { status: "ready", statements: [OCTOBER], page: 1, totalPages: 3, onPageChange },
    });
    // Announced when it changes.
    expect(screen.getByText("Page 1 of 3")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("case 26: picking a preset passes the range up", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /oct 31, 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: "Last 3 months" }));
    expect(props.onRangeChange).toHaveBeenCalledWith({ start: "2026-08-01", end: "2026-10-31" });
  });

  it("case 26: a range the filter can't use shows why instead of the list", () => {
    renderPanel({ rangeError: "The end date must be on or after the start date." });
    expect(screen.getByTestId("statement-range-reason")).toHaveTextContent(/on or after/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // The latest statement doesn't depend on the range.
    expect(screen.getByRole("region", { name: /latest statement/i })).toBeInTheDocument();
  });

  it("case 26: an empty range says so", () => {
    renderPanel({
      list: { status: "ready", statements: [], page: 1, totalPages: 0, onPageChange: vi.fn() },
    });
    expect(screen.getByText(/no statements in this range/i)).toBeInTheDocument();
  });

  it("case 27: an account with no statement yet explains the monthly run", () => {
    renderPanel({
      latest: { status: "none" },
      list: { status: "ready", statements: [], page: 1, totalPages: 0, onPageChange: vi.fn() },
    });
    expect(
      screen.getByText(/statements appear after the first monthly run.*1st.*3 AM UTC/i)
    ).toBeInTheDocument();
  });

  it("case 28: a failed request shows an inline error with retry", () => {
    const retryLatest = vi.fn();
    const retryList = vi.fn();
    renderPanel({
      latest: { status: "error", onRetry: retryLatest },
      list: { status: "error", onRetry: retryList },
    });
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    const retries = screen.getAllByRole("button", { name: "Retry" });
    fireEvent.click(retries[0]!);
    fireEvent.click(retries[1]!);
    expect(retryLatest).toHaveBeenCalledOnce();
    expect(retryList).toHaveBeenCalledOnce();
  });

  it("shows skeletons while loading", () => {
    renderPanel({ latest: { status: "loading" }, list: { status: "loading" } });
    expect(screen.getByRole("status", { name: /loading latest statement/i })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /loading statements/i })).toBeInTheDocument();
  });

  it("a 403 shows one quiet line", () => {
    renderPanel({ latest: { status: "forbidden" }, list: { status: "forbidden" } });
    expect(screen.getAllByText(/you don't have access to statements/i)).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a member with no program account says so", () => {
    renderPanel({ currencies: [] });
    expect(screen.getByText(/no points account yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("waits for the member's account before showing anything", () => {
    renderPanel({ account: { status: "loading" }, currencies: [] });
    expect(screen.getByRole("status", { name: /loading statements/i })).toBeInTheDocument();
    expect(screen.queryByText(/no points account/i)).not.toBeInTheDocument();
  });

  it("case 28: a failed account read shows an inline error with retry", () => {
    const onRetry = vi.fn();
    renderPanel({ account: { status: "error", onRetry }, currencies: [] });
    expect(screen.getByRole("alert")).toHaveTextContent(/statements could not be loaded/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the range reason's live region mounted, so a new reason is announced", () => {
    renderPanel();
    const region = screen.getByTestId("statement-range-reason");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("Retry is a 44px touch target", () => {
    renderPanel({ latest: { status: "error", onRetry: vi.fn() } });
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass("min-h-11");
  });
});
