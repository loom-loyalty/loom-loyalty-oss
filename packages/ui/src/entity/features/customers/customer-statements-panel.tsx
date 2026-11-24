/**
 * Customer Statements Panel
 *
 * A member's statements for one currency (api#2695 slice 4b): the newest
 * statement, and the statements wholly inside a date range. The API writes a
 * member's statement once a month for the previous UTC calendar month; every
 * figure comes from the API, and this component only lays them out. Days are
 * UTC days.
 */

import { formatDateRange, toISODateUTC } from "@loom-loyalty/core";
import type { ProgramLedgerStatement } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";

import { DateRangePicker } from "../../../analytics/date-range-picker.js";
import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import { ToggleGroup, ToggleGroupItem } from "../../../primitives/toggle-group.js";
import { statementRangePresets, type StatementRange } from "./statement-range.js";

/** One of the member's currencies, by its program ledger. */
export interface StatementCurrencyOption {
  ledgerId: string;
  label: string;
}

/** The newest statement for the selected currency. */
export type LatestStatementState =
  | { status: "loading" }
  | { status: "ready"; statement: ProgramLedgerStatement }
  /** The API answered 404: no statement written for this account and currency yet. */
  | { status: "none" }
  | { status: "forbidden" }
  | { status: "error"; onRetry: () => void };

/** One page of the range's statements, as the API paged it. */
export type StatementListState =
  | { status: "loading" }
  | {
      status: "ready";
      statements: ProgramLedgerStatement[];
      /** 1-indexed page. */
      page: number;
      totalPages: number;
      onPageChange: (page: number) => void;
    }
  | { status: "forbidden" }
  | { status: "error"; onRetry: () => void };

/** The member's program account, which names the currencies. */
export type StatementAccountState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; onRetry: () => void };

export interface CustomerStatementsPanelProps {
  /** Defaults to ready. */
  account?: StatementAccountState;
  /** The member's currencies; empty when the member has no program account. */
  currencies: StatementCurrencyOption[];
  selectedLedgerId: string | undefined;
  onLedgerChange: (ledgerId: string) => void;
  /** The listed range (inclusive UTC days). */
  range: StatementRange;
  onRangeChange: (range: StatementRange) => void;
  /** Why the picked range can't be listed, shown in place of the list. */
  rangeError?: string | null;
  latest: LatestStatementState;
  list: StatementListState;
  /** Clock for the picker's presets (tests pass a fixed one). */
  now?: Date;
}

const NO_STATEMENT_YET =
  "No statement yet. Statements appear after the first monthly run, on the 1st shortly after 3 AM UTC.";

function formatAmount(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/**
 * A statement's period as UTC days. The period end is the exclusive midnight,
 * so the last day shown is the day before it.
 */
function statementPeriod(statement: ProgramLedgerStatement): string {
  const start = toISODateUTC(new Date(statement.periodStartDateTime));
  const end = toISODateUTC(new Date(new Date(statement.periodEndDateTime).getTime() - 1));
  return formatDateRange(start, end);
}

function newestFirst(statements: ProgramLedgerStatement[]): ProgramLedgerStatement[] {
  return [...statements].sort(
    (a, b) => Date.parse(b.periodStartDateTime) - Date.parse(a.periodStartDateTime)
  );
}

export function CustomerStatementsPanel({
  account = { status: "ready" },
  currencies,
  selectedLedgerId,
  onLedgerChange,
  range,
  onRangeChange,
  rangeError,
  latest,
  list,
  now = new Date(),
}: CustomerStatementsPanelProps): ReactNode {
  if (account.status === "loading") {
    return (
      <div role="status" aria-label="Loading statements" className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (account.status === "error") {
    return <InlineError message="Statements could not be loaded." onRetry={account.onRetry} />;
  }

  if (currencies.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This member has no points account yet, so there are no statements.
      </p>
    );
  }

  if (latest.status === "forbidden" || list.status === "forbidden") {
    return (
      <p className="text-muted-foreground text-sm">
        You don&apos;t have access to statements. Ask an organization admin.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {currencies.length > 1 && (
        <ToggleGroup
          type="single"
          aria-label="Currency"
          value={selectedLedgerId ?? ""}
          // Radix sends "" when the active item is clicked again; keep the selection.
          onValueChange={(value) => value && onLedgerChange(value)}
          className="flex-wrap"
        >
          {currencies.map((c) => (
            <ToggleGroupItem key={c.ledgerId} value={c.ledgerId} className="min-h-11">
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <section className="space-y-3" aria-labelledby="latest-statement-heading">
        <h3
          id="latest-statement-heading"
          className="text-foreground text-sm font-semibold tracking-wide uppercase"
        >
          Latest statement
        </h3>
        <LatestStatement state={latest} />
      </section>

      <section className="space-y-3" aria-labelledby="statements-range-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="statements-range-heading"
            className="text-foreground text-sm font-semibold tracking-wide uppercase"
          >
            Statements
          </h3>
          <DateRangePicker
            value={{
              startDate: range.start,
              endDate: range.end,
              preset: "",
              label: formatDateRange(range.start, range.end),
            }}
            onChange={(r) => onRangeChange({ start: r.startDate, end: r.endDate })}
            presets={statementRangePresets(now)}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Monthly statements that fall wholly inside the range. Days are UTC days.
        </p>
        <p
          role="status"
          aria-live="polite"
          data-testid="statement-range-reason"
          className="text-muted-foreground text-sm empty:hidden"
        >
          {rangeError ?? ""}
        </p>
        {!rangeError && <StatementList state={list} latestMissing={latest.status === "none"} />}
      </section>
    </div>
  );
}

function LatestStatement({ state }: { state: LatestStatementState }): ReactNode {
  switch (state.status) {
    case "loading":
      return (
        <div role="status" aria-label="Loading latest statement">
          <Skeleton className="h-20 w-full" />
        </div>
      );
    case "none":
      return <p className="text-muted-foreground text-sm">{NO_STATEMENT_YET}</p>;
    case "forbidden":
      return null;
    case "error":
      return (
        <InlineError message="The latest statement could not be loaded." onRetry={state.onRetry} />
      );
    case "ready": {
      const s = state.statement;
      return (
        <div className="border-border space-y-3 rounded-lg border p-4">
          <p className="text-foreground text-sm font-medium">{statementPeriod(s)}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Figure label="Credits" value={formatAmount(s.periodCreditAmount)} />
            <Figure label="Debits" value={formatAmount(s.periodDebitAmount)} />
            <Figure label="Closing available" value={formatAmount(s.closingAvailable)} emphasis />
            <Figure label="Pending" value={formatAmount(s.closingPending)} />
            <Figure label="Expired (to date)" value={formatAmount(s.closingExpired)} />
          </dl>
        </div>
      );
    }
  }
}

function StatementList({
  state,
  latestMissing,
}: {
  state: StatementListState;
  latestMissing: boolean;
}): ReactNode {
  switch (state.status) {
    case "loading":
      return (
        <div role="status" aria-label="Loading statements" className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      );
    case "forbidden":
      return null;
    case "error":
      return <InlineError message="Statements could not be loaded." onRetry={state.onRetry} />;
    case "ready":
      break;
  }

  if (state.statements.length === 0) {
    // With no statement at all, the latest section already explains when the first one comes.
    return latestMissing ? null : (
      <p className="text-muted-foreground text-sm">No statements in this range.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table aria-label="Statements in range" className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-xs">
              <th scope="col" className="py-2 pr-4 font-medium">
                Period
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Credits
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Debits
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Closing available
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Pending
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Expired (to date)
              </th>
            </tr>
          </thead>
          <tbody>
            {newestFirst(state.statements).map((s) => (
              <tr key={s.programLedgerStatementId} className="border-border border-b last:border-0">
                <td className="text-foreground py-2 pr-4">{statementPeriod(s)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatAmount(s.periodCreditAmount)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatAmount(s.periodDebitAmount)}
                </td>
                <td className="text-foreground py-2 pr-4 text-right font-medium tabular-nums">
                  {formatAmount(s.closingAvailable)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatAmount(s.closingPending)}
                </td>
                <td className="py-2 text-right tabular-nums">{formatAmount(s.closingExpired)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.totalPages > 1 && (
        <nav aria-label="Statement pages" className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={state.page <= 1}
            onClick={() => state.onPageChange(state.page - 1)}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <span aria-live="polite" className="text-muted-foreground text-xs">
            Page {state.page} of {state.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={state.page >= state.totalPages}
            onClick={() => state.onPageChange(state.page + 1)}
            aria-label="Next page"
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <p role="alert" className="text-destructive text-sm">
        {message}
      </p>
      <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}): ReactNode {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("text-foreground tabular-nums", emphasis && "text-base font-semibold")}>
        {value}
      </dd>
    </div>
  );
}
