/**
 * Pending Rule Column Definitions
 *
 * Column definitions for the Pending Rules DataTable using SDK PendingRule type directly.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { PendingRule } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

import { PENDING_PERIOD_LABELS, PENDING_RULE_TYPE_LABELS } from "./types.js";

/**
 * Format the pending configuration for display
 * Returns a human-readable string based on type/period/date
 */
export function formatPendingConfig(rule: PendingRule): string {
  const type = rule.type;

  if (
    (type === "FIXED_PERIOD" || type === "ROLLING_PERIOD") &&
    rule.pendingPeriod &&
    rule.pendingPeriodValue
  ) {
    const periodLabel = PENDING_PERIOD_LABELS[rule.pendingPeriod] ?? rule.pendingPeriod;
    return `${rule.pendingPeriodValue} ${periodLabel}`;
  }

  if (type === "FIXED_DATE" && rule.pendingDate) {
    return formatShortDate(rule.pendingDate) ?? rule.pendingDate;
  }

  if (type === "MANUAL") return "Manual approval";
  if (type === "PENDING_ON_ITEM") return "Based on item";

  return "—";
}

/**
 * Extended columns for the pending rules table
 * Shows all relevant data for efficient pending rule management
 */
export function getPendingRuleColumnsExtended(): Column<PendingRule>[] {
  return [
    {
      key: "name",
      header: "Pending Rule",
      render: (rule) => (
        <div>
          <p className="text-foreground font-medium">{rule.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{rule.code}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (rule) => (
        <Badge variant="secondary" className="font-normal">
          {PENDING_RULE_TYPE_LABELS[rule.type] ?? rule.type}
        </Badge>
      ),
    },
    {
      key: "config",
      header: "Configuration",
      render: (rule) => (
        <span className="text-muted-foreground text-sm">{formatPendingConfig(rule)}</span>
      ),
    },
    {
      key: "programs",
      header: "Programs",
      render: (rule) => {
        const count = rule.programIds?.length ?? 0;
        if (count === 0) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return (
          <Badge variant="outline" className="font-normal">
            {count} {count === 1 ? "program" : "programs"}
          </Badge>
        );
      },
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (rule) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(rule.createdDateTime) ?? "—"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (rule) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(rule.modifiedDateTime) ?? "—"}
        </span>
      ),
    },
  ];
}
