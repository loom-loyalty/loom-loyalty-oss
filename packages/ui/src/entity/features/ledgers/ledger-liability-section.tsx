/**
 * Ledger Liability Section
 *
 * A program ledger's outstanding points liability for a period, and the
 * breakage behind it (api#2695). Every figure comes from the API's liability
 * report; this component only lays them out and formats them. Days are UTC
 * days, as the API counts them.
 */

import { formatDateRange } from "@loom-loyalty/core";
import type { ProgramLedgerLiabilityReport } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";

import { DateRangePicker } from "../../../analytics/date-range-picker.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import { liabilityPeriodPresets, type LiabilityPeriod } from "./liability-period.js";

/** What the section shows below the period picker. */
export type LedgerLiabilityState =
  | { status: "loading" }
  | { status: "ready"; report: ProgramLedgerLiabilityReport }
  /** The API answered 409: statements aren't generated through the period end yet. */
  | { status: "not-ready"; onShowMonthBefore?: () => void }
  /** The API answered 403. Roles known to lack the scope never render this section. */
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "error"; onRetry: () => void };

export interface LedgerLiabilitySectionProps {
  /** The period shown (inclusive UTC days). */
  period: LiabilityPeriod;
  /** Called with the picked period; the caller validates it and sets `periodError`. */
  onPeriodChange: (period: LiabilityPeriod) => void;
  /** Why the picked period can't be reported, shown inline instead of the figures. */
  periodError?: string | null;
  state: LedgerLiabilityState;
  /** Clock for the picker's presets (tests pass a fixed one). */
  now?: Date;
}

const BREAKAGE_METHOD_LABELS: Record<string, string> = {
  EXPIRED_UNSPENT: "Points that expired unspent in the period",
  NO_EXPIRY_RULE: "No expiry rule on this currency, so nothing breaks",
};

/**
 * Money in the currency's usual decimals (cents for USD, none for JPY). A cost per point can be a
 * fraction of a cent, so it passes `precise` to keep up to 6 decimals. An unknown currency code
 * falls back to the number and the code.
 */
function formatMoney(value: number, currency: string, precise = false): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      ...(precise ? { maximumFractionDigits: 6 } : {}),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** A figure the API left out shows as a dash, never as 0. */
function formatPoints(value: number | undefined): string {
  if (value === undefined) return "\u2014";
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/**
 * Ledger liability and breakage for a period.
 */
export function LedgerLiabilitySection({
  period,
  onPeriodChange,
  periodError,
  state,
  now = new Date(),
}: LedgerLiabilitySectionProps): ReactNode {
  const periodLabel = formatDateRange(period.start, period.end);

  return (
    <section className="space-y-4" aria-labelledby="ledger-liability-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="ledger-liability-heading"
          className="text-foreground text-sm font-semibold tracking-wide uppercase"
        >
          Liability and breakage
        </h3>
        <DateRangePicker
          value={{ startDate: period.start, endDate: period.end, preset: "", label: periodLabel }}
          onChange={(range) => onPeriodChange({ start: range.startDate, end: range.endDate })}
          presets={liabilityPeriodPresets(now)}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Days are UTC days. Liability is the points members hold, pending included.
      </p>

      {periodError ? (
        <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
          {periodError}
        </p>
      ) : (
        <LiabilityBody state={state} />
      )}
    </section>
  );
}

function LiabilityBody({ state }: { state: LedgerLiabilityState }): ReactNode {
  switch (state.status) {
    case "loading":
      return (
        <div className="space-y-3" role="status" aria-label="Loading liability report">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    case "not-ready":
      return (
        <div className="border-border space-y-2 rounded-lg border p-4">
          <p className="text-foreground text-sm">
            This period&apos;s report is not ready yet. The daily statement run finishes shortly
            after 2 AM UTC.
          </p>
          {state.onShowMonthBefore && (
            <Button variant="outline" size="sm" onClick={state.onShowMonthBefore}>
              Show the month before
            </Button>
          )}
        </div>
      );
    case "forbidden":
      return (
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to this report. Ask an organization admin.
        </p>
      );
    case "not-found":
      return <p className="text-muted-foreground text-sm">This ledger wasn&apos;t found.</p>;
    case "error":
      return (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-destructive text-sm">
            The liability report could not be loaded.
          </p>
          <Button variant="outline" size="sm" onClick={state.onRetry}>
            Retry
          </Button>
        </div>
      );
    case "ready":
      return <LiabilityFigures report={state.report} />;
  }
}

function LiabilityFigures({ report }: { report: ProgramLedgerLiabilityReport }): ReactNode {
  // The API sends value fields only when the currency has a cost per point.
  const currency = report.costCurrencyCode;
  const money = (value: number | undefined) =>
    currency && value !== undefined ? formatMoney(value, currency) : undefined;
  const method = report.breakageMethod
    ? (BREAKAGE_METHOD_LABELS[report.breakageMethod] ?? report.breakageMethod)
    : undefined;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <Figure
          label="Opening liability"
          value={formatPoints(report.openingLiability)}
          money={money(report.openingValue)}
        />
        <Figure label="Issued" value={formatPoints(report.issued)} />
        <Figure label="Redeemed" value={formatPoints(report.redeemed)} />
        <Figure label="Adjusted" value={formatPoints(report.adjusted)} />
        <Figure label="Expired" value={formatPoints(report.expired)} />
        <Figure
          label="Closing liability"
          value={formatPoints(report.closingLiability)}
          money={money(report.closingValue)}
          emphasis
        />
        <Figure label="Pending (in closing)" value={formatPoints(report.closingPending)} />
        <Figure
          label="Breakage"
          value={formatPoints(report.breakage)}
          money={money(report.breakageValue)}
        />
      </dl>
      {method && (
        <p className="text-muted-foreground text-xs">
          Breakage method: <span className="text-foreground">{method}</span>
        </p>
      )}
      {currency && report.costPerPoint !== undefined && (
        <p className="text-muted-foreground text-xs">
          Valued at {formatMoney(report.costPerPoint, currency, true)} per point.
        </p>
      )}
    </div>
  );
}

interface FigureProps {
  label: string;
  value: string;
  money?: string;
  emphasis?: boolean;
}

function Figure({ label, value, money, emphasis }: FigureProps): ReactNode {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={
          emphasis ? "text-foreground text-base font-semibold" : "text-foreground font-medium"
        }
      >
        {value}
      </dd>
      {money && <dd className="text-muted-foreground text-xs">{money}</dd>}
    </div>
  );
}
