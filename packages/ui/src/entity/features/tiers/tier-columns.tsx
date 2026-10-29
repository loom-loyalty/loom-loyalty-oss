/**
 * Tier Column Definitions
 *
 * Column definitions for the Tiers DataTable using SDK Tier type directly.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Tier } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";
import { TierRankBadge } from "../tier-rank-badge.js";

/**
 * Extract description from Tier's description object
 * Handles the unknown value type by checking for common locale keys
 */
export function getDescription(description?: { [key: string]: unknown }): string {
  if (!description) return "";
  const enUS = description["en-US"];
  const en = description["en"];
  if (typeof enUS === "string") return enUS;
  if (typeof en === "string") return en;
  return "";
}

/**
 * Format a duration period object into a human-readable string
 */
function formatDuration(durationPeriod?: {
  durationPeriodValue?: number;
  durationPeriod?: string;
}): string {
  if (!durationPeriod?.durationPeriodValue || !durationPeriod?.durationPeriod) return "";
  const value = durationPeriod.durationPeriodValue;
  const unit = durationPeriod.durationPeriod;
  // Capitalize first letter, lowercase rest
  const formatted = unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
  return `${value} ${formatted}`;
}

/**
 * Extended columns for the tiers table
 * Shows all relevant data for efficient tier management
 */
export function getTierColumnsExtended(): Column<Tier>[] {
  return [
    {
      key: "name",
      header: "Tier",
      render: (tier) => (
        <div>
          <p className="text-foreground font-medium">{tier.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{tier.code}</p>
        </div>
      ),
    },
    {
      key: "rank",
      header: "Rank",
      render: (tier) =>
        tier.rank != null ? (
          <TierRankBadge rank={tier.rank} tierName={tier.name} size="sm" />
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (tier) => {
        const desc = getDescription(tier.description);
        return (
          <p className="text-muted-foreground truncate text-sm" title={desc}>
            {desc || "\u2014"}
          </p>
        );
      },
    },
    {
      key: "subscription",
      header: "Subscription",
      render: (tier) => (
        <span className="text-muted-foreground text-sm">{tier.subscription ? "Yes" : "No"}</span>
      ),
    },
    {
      key: "durationPeriod",
      header: "Duration",
      render: (tier) => {
        const duration = formatDuration(tier.durationPeriod);
        return <span className="text-muted-foreground text-sm">{duration || "\u2014"}</span>;
      },
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (tier) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(tier.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (tier) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(tier.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
