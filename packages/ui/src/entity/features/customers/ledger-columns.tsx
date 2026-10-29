/**
 * Ledger Table Column Definitions
 *
 * Extracted to avoid cross-import coupling between customer-view and
 * ledger-history-sheet. Both siblings import from this shared module.
 */

import { formatDate } from "@loom-loyalty/core";
import type { Column } from "../../../data-display/data-table";
import { StatusBadge } from "../../../data-display/status-badge";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import type { LedgerEntry } from "./types";

export const ledgerColumns: Column<LedgerEntry>[] = [
  {
    key: "date",
    header: "Date",
    render: (entry) => (
      <time dateTime={entry.eventDateTime} className="text-foreground text-sm whitespace-nowrap">
        {formatDate(entry.eventDateTime, "MMM d")}
      </time>
    ),
  },
  {
    key: "currency",
    header: "Currency",
    render: (entry) => (
      <Badge variant="outline" className="text-xs whitespace-nowrap">
        {entry.currencyName}
      </Badge>
    ),
  },
  {
    key: "description",
    header: "Description",
    render: (entry) => (
      <span className="text-foreground text-sm font-medium">{entry.description}</span>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (entry) => (
      <Badge variant={entry.type === "CREDIT" ? "success" : "warning"}>{entry.type}</Badge>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    render: (entry) => (
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          entry.type === "CREDIT" ? "text-success-dark" : "text-destructive"
        )}
      >
        {entry.type === "CREDIT" ? "+" : "-"}
        {Math.abs(entry.amount).toLocaleString()}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (entry) => <StatusBadge status={entry.status} />,
  },
];
