/**
 * Partner Column Definitions
 *
 * Column definitions for the Partners DataTable using SDK Partner type directly.
 * Uses extended columns for data-dense display.
 */

import { extractLocalizedString, formatShortDate } from "@loom-loyalty/core";
import type { Partner } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

/**
 * Extended columns for the partners table
 * Shows all relevant data for efficient partner management
 */
export function getPartnerColumnsExtended(): Column<Partner>[] {
  return [
    {
      key: "name",
      header: "Partner",
      render: (partner) => (
        <div>
          <p className="text-foreground font-medium">{partner.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{partner.code}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (partner) => {
        const desc = extractLocalizedString(partner.description);
        return (
          <p className="text-muted-foreground truncate text-sm" title={desc}>
            {desc || "\u2014"}
          </p>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (partner) =>
        partner.type ? (
          <Badge variant="secondary" className="font-normal">
            {partner.type.name ?? partner.type.code}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (partner) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(partner.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (partner) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(partner.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
