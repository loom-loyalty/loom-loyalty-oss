/**
 * Expiry Rule Column Definitions
 *
 * Column definitions for the Expiry Rules DataTable using SDK ExpiryRule type.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { ExpiryRule } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

import { EXPIRY_PERIOD_LABELS, EXPIRY_TYPE_LABELS } from "./types.js";

/**
 * Format the expiry configuration for display.
 * Shows "12 months" for period types, "Jan 15, 2025" for fixed date, or "—" if not configured.
 */
export function formatExpiryConfig(rule: ExpiryRule): string {
  if (rule.type === "FIXED_DATE" && rule.expiryDate) {
    return formatShortDate(rule.expiryDate) ?? rule.expiryDate;
  }

  if (
    (rule.type === "FIXED_PERIOD" || rule.type === "ROLLING_PERIOD") &&
    rule.expiryPeriodValue &&
    rule.expiryPeriod
  ) {
    const periodLabel = EXPIRY_PERIOD_LABELS[rule.expiryPeriod] ?? rule.expiryPeriod.toLowerCase();
    return `${rule.expiryPeriodValue} ${periodLabel}`;
  }

  return "—";
}

/**
 * Extended columns for the expiry rules table
 */
export function getExpiryRuleColumnsExtended(): Column<ExpiryRule>[] {
  return [
    {
      key: "name",
      header: "Expiry Rule",
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
          {EXPIRY_TYPE_LABELS[rule.type] ?? rule.type}
        </Badge>
      ),
    },
    {
      key: "config",
      header: "Configuration",
      render: (rule) => (
        <span className="text-muted-foreground text-sm">{formatExpiryConfig(rule)}</span>
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
