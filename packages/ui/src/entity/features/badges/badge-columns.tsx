/**
 * Badge Column Definitions
 *
 * Column definitions for the Badges DataTable using SDK Badge type directly.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Badge as BadgeEntity, DataType } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

/**
 * Extract badge type from the Badge entity.
 */
export function getBadgeType(badge: BadgeEntity): DataType | undefined {
  return badge.type;
}

/**
 * Extract description from Badge's description object
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
 * Extended columns for the badges table
 * Shows all relevant data for efficient badge management
 */
export function getBadgeColumnsExtended(): Column<BadgeEntity>[] {
  return [
    {
      key: "name",
      header: "Badge",
      render: (badge) => (
        <div>
          <p className="text-foreground font-medium">{badge.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{badge.code}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (badge) => {
        const desc = getDescription(badge.description);
        return (
          <p className="text-muted-foreground truncate text-sm" title={desc}>
            {desc || "\u2014"}
          </p>
        );
      },
    },
    {
      key: "typeCode",
      header: "Type",
      render: (badge) => {
        const badgeType = getBadgeType(badge);
        return badgeType?.name || badgeType?.code ? (
          <Badge variant="secondary" className="font-normal">
            {badgeType.name || badgeType.code}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        );
      },
    },
    {
      key: "rank",
      header: "Rank",
      render: (badge) => (
        <span className="text-muted-foreground text-sm">
          {badge.rank != null ? badge.rank : "\u2014"}
        </span>
      ),
    },
    {
      key: "programIds",
      header: "Programs",
      render: (badge) => (
        <span className="text-muted-foreground text-sm">{badge.programIds?.length ?? 0}</span>
      ),
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (badge) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(badge.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (badge) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(badge.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
