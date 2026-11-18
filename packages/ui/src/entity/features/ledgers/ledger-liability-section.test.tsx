import type { ProgramLedgerLiabilityReport } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  LedgerLiabilitySection,
  type LedgerLiabilitySectionProps,
} from "./ledger-liability-section";

const NOW = new Date("2026-11-18T03:28:00Z");

/**
 * An October report whose figures are all non-zero and distinct, so a swapped field shows.
 * Breakage is set apart from expired only for that: with EXPIRED_UNSPENT the API reports them equal.
 */
const REPORT: ProgramLedgerLiabilityReport = {
  programLedgerId: "pldg_0000000000000000000000000000000a",
  programCurrencyCode: "POINTS",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  openingLiability: 12500,
  issued: 4200,
  redeemed: 1800,
  adjusted: -150,
  expired: 650,
  closingLiability: 14100,
  closingPending: 300,
  breakage: 640,
  breakageMethod: "EXPIRED_UNSPENT",
};

const VALUED: ProgramLedgerLiabilityReport = {
  ...REPORT,
  costPerPoint: 0.01,
  costCurrencyCode: "USD",
  openingValue: 125,
  closingValue: 141,
  breakageValue: 6.5,
};

function renderSection(overrides: Partial<LedgerLiabilitySectionProps> = {}) {
  const props: LedgerLiabilitySectionProps = {
    period: { start: "2026-10-01", end: "2026-10-31" },
    onPeriodChange: vi.fn(),
    state: { status: "ready", report: REPORT },
    now: NOW,
    ...overrides,
  };
  render(<LedgerLiabilitySection {...props} />);
  return props;
}

function figure(label: string): string {
  const term = screen.getByText(label, { selector: "dt" });
  return term.nextElementSibling?.textContent ?? "";
}

describe("LedgerLiabilitySection", () => {
  it("case 19: shows every figure for the period, pending inside closing, and the breakage method in words", () => {
    renderSection();

    const section = screen.getByRole("region", { name: /liability and breakage/i });
    expect(within(section).getByText(/Oct 1, 2026/)).toBeInTheDocument();
    expect(within(section).getByText(/UTC days/i)).toBeInTheDocument();
    expect(figure("Opening liability")).toBe("12,500");
    expect(figure("Issued")).toBe("4,200");
    expect(figure("Redeemed")).toBe("1,800");
    expect(figure("Adjusted")).toBe("-150");
    expect(figure("Expired")).toBe("650");
    expect(figure("Closing liability")).toBe("14,100");
    expect(figure("Pending (in closing)")).toBe("300");
    expect(figure("Breakage")).toBe("640");
    expect(within(section).getByText(/points that expired unspent/i)).toBeInTheDocument();
  });

  it("case 12/19: names the no-expiry-rule method", () => {
    renderSection({
      state: {
        status: "ready",
        report: { ...REPORT, expired: 0, breakage: 0, breakageMethod: "NO_EXPIRY_RULE" },
      },
    });
    expect(screen.getByText(/no expiry rule/i)).toBeInTheDocument();
  });

  it("case 24: the shown figures satisfy closing = opening + issued - redeemed + adjusted - expired", () => {
    renderSection();
    const n = (label: string) => Number(figure(label).replace(/,/g, ""));
    expect(
      n("Opening liability") + n("Issued") - n("Redeemed") + n("Adjusted") - n("Expired")
    ).toBe(n("Closing liability"));
  });

  it("case 20: with a cost per point, shows money values in the cost currency", () => {
    renderSection({ state: { status: "ready", report: VALUED } });
    expect(screen.getByText("$125.00")).toBeInTheDocument();
    expect(screen.getByText("$141.00")).toBeInTheDocument();
    expect(screen.getByText("$6.50")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.01 per point/)).toBeInTheDocument();
  });

  it("case 20/31: without a cost per point, shows no money anywhere (no $0)", () => {
    renderSection();
    const section = screen.getByRole("region", { name: /liability and breakage/i });
    expect(section.textContent).not.toMatch(/\$/);
    expect(within(section).queryByText(/per point/)).not.toBeInTheDocument();
  });

  it("case 29: a ledger with no activity shows zeros, not an error", () => {
    renderSection({
      state: {
        status: "ready",
        report: {
          ...REPORT,
          openingLiability: 0,
          issued: 0,
          redeemed: 0,
          adjusted: 0,
          expired: 0,
          closingLiability: 0,
          closingPending: 0,
          breakage: 0,
          breakageMethod: "NO_EXPIRY_RULE",
        },
      },
    });
    expect(figure("Closing liability")).toBe("0");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows skeletons while loading", () => {
    renderSection({ state: { status: "loading" } });
    expect(screen.getByRole("status", { name: /loading liability report/i })).toBeInTheDocument();
  });

  it("case 22: not ready yet explains the daily run and offers the month before", () => {
    const onShowMonthBefore = vi.fn();
    renderSection({ state: { status: "not-ready", onShowMonthBefore } });
    expect(screen.getByText(/not ready yet/i)).toBeInTheDocument();
    expect(screen.getByText(/2 AM UTC/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show the month before/i }));
    expect(onShowMonthBefore).toHaveBeenCalledOnce();
  });

  it("case 23: a 403 shows one quiet line, not an error", () => {
    renderSection({ state: { status: "forbidden" } });
    expect(screen.getByText(/don't have access to this report/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("case 30: a ledger the API can't find shows a clean not-found", () => {
    renderSection({ state: { status: "not-found" } });
    expect(screen.getByText(/ledger wasn't found/i)).toBeInTheDocument();
  });

  it("shows an inline error with retry on any other failure", () => {
    const onRetry = vi.fn();
    renderSection({ state: { status: "error", onRetry } });
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("case 21: an invalid picked range shows the reason inline, announced politely", () => {
    renderSection({ periodError: "The period must end before today (UTC)." });
    expect(screen.getByRole("status")).toHaveTextContent("The period must end before today (UTC).");
    expect(screen.queryByText("Closing liability")).not.toBeInTheDocument();
  });

  it("case 21: picking a preset hands its period to onPeriodChange", async () => {
    const props = renderSection();
    fireEvent.click(screen.getByRole("button", { name: /oct 1, 2026/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Month before last" }));
    expect(props.onPeriodChange).toHaveBeenCalledWith({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("shows a figure the API left out as a dash, not 0", () => {
    renderSection({ state: { status: "ready", report: { ...REPORT, closingPending: undefined } } });
    expect(figure("Pending (in closing)")).toBe("\u2014");
  });
});
