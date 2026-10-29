/**
 * Metadata Group Column Definitions
 *
 * Column definitions for the Metadata Groups DataTable.
 * Uses extended columns for data-dense display.
 */

import { extractLocalizedString, formatShortDate } from "@loom-loyalty/core";
import type { MetadataGroup } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";

/**
 * Extended columns for the metadata groups table
 */
export function getMetadataGroupColumnsExtended(): Column<MetadataGroup>[] {
  return [
    {
      key: "name",
      header: "Metadata Group",
      render: (group) => (
        <div>
          <p className="text-foreground font-medium">{group.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{group.code}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (group) => {
        const desc = extractLocalizedString(group.description);
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
      render: (group) =>
        group.typeCode ? (
          <Badge variant="secondary" className="font-normal">
            {group.typeCode}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    {
      key: "createdDateTime",
      header: "Created",
      render: (group) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(group.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (group) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(group.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
