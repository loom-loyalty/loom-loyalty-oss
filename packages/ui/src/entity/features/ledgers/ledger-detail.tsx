/**
 * Ledger Detail Sheet Content
 *
 * Displays all ProgramLedger fields in a read-only detail view.
 * Includes optional statements section for balance history.
 * No edit or delete actions since ledgers are system-managed.
 */

import { formatDateTime, formatShortDate } from "@loom-loyalty/core";
import type { ProgramLedger, ProgramLedgerStatement } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Skeleton } from "../../../primitives/skeleton.js";

export interface LedgerDetailProps {
  /** Ledger to display */
  ledger: ProgramLedger;
  /** Recent statements for this ledger (optional) */
  statements?: ProgramLedgerStatement[];
  /** Whether statements are loading */
  statementsLoading?: boolean;
}

/**
 * Ledger detail content for Sheet display
 */
export function LedgerDetail({
  ledger,
  statements,
  statementsLoading,
}: LedgerDetailProps): ReactNode {
  return (
    <div className="space-y-6">
      {/* Program Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Program</h3>
        <div className="space-y-3">
          <DetailRow label="Program Name" value={ledger.program?.name ?? "\u2014"} />
          <DetailRow label="Program Code" value={ledger.program?.code ?? "\u2014"} mono />
        </div>
      </section>

      {/* Currency Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Currency</h3>
        <div className="space-y-3">
          <DetailRow label="Currency Name" value={ledger.programCurrency?.name ?? "\u2014"} />
          <DetailRow label="Currency Code" value={ledger.programCurrency?.code ?? "\u2014"} mono />
        </div>
      </section>

      {/* Statements Section */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Recent Statements
        </h3>
        {statementsLoading ? (
          <div className="space-y-3" role="status" aria-label="Loading statements">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : statements && statements.length > 0 ? (
          <div className="space-y-3">
            {statements.map((stmt) => (
              <div
                key={stmt.programLedgerStatementId}
                className="border-border rounded-lg border p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-foreground text-sm font-medium">
                    {formatShortDate(stmt.periodStartDateTime) ?? "\u2014"} —{" "}
                    {formatShortDate(stmt.periodEndDateTime) ?? "\u2014"}
                  </span>
                  <Badge variant={stmt.status === "ACTIVE" ? "success" : "secondary"}>
                    {stmt.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Available</p>
                    <p className="text-foreground font-medium">
                      {(stmt.closingAvailable ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Earned</p>
                    <p className="text-foreground font-medium">
                      {(stmt.closingEarned ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Debited</p>
                    <p className="text-foreground font-medium">
                      {(stmt.closingDebited ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-muted-foreground mt-2 text-xs">
                  Credits: {stmt.periodCreditCount ?? 0} (
                  {(stmt.periodCreditAmount ?? 0).toLocaleString()}) · Debits:{" "}
                  {stmt.periodDebitCount ?? 0} ({(stmt.periodDebitAmount ?? 0).toLocaleString()})
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No statements available for this ledger.</p>
        )}
      </section>

      {/* System Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
        <div className="space-y-3">
          <DetailRow label="Ledger ID" value={ledger.programLedgerId} mono />
          <DetailRow label="Created" value={formatDateTime(ledger.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(ledger.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium"}>
        {value}
      </p>
    </div>
  );
}
