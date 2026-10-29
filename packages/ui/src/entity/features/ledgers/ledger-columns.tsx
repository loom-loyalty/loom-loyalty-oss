/**
 * Ledger Column Definitions
 *
 * Defines the columns for the ledger DataTable.
 * Extended columns show program, currency, and timestamps.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { ProgramLedger } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";

/**
 * Get extended column definitions for ledger list
 */
export function getLedgerColumnsExtended(): Column<ProgramLedger>[] {
  return [
    {
      key: "program",
      header: "Program",
      render: (ledger) => (
        <div>
          <p className="text-foreground font-medium">{ledger.program?.name ?? "\u2014"}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {ledger.program?.code ?? "\u2014"}
          </p>
        </div>
      ),
    },
    {
      key: "currency",
      header: "Currency",
      render: (ledger) => (
        <div>
          <p className="text-foreground font-medium">{ledger.programCurrency?.name ?? "\u2014"}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {ledger.programCurrency?.code ?? "\u2014"}
          </p>
        </div>
      ),
    },
    {
      key: "ledgerId",
      header: "Ledger ID",
      render: (ledger) => (
        <span className="text-muted-foreground font-mono text-xs">{ledger.programLedgerId}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (ledger) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(ledger.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modified",
      header: "Modified",
      render: (ledger) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(ledger.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
