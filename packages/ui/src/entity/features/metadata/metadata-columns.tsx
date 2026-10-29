/**
 * Metadata Column Definitions
 *
 * Column definitions for the Metadata DataTable.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Metadata } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";

/**
 * Extended columns for the metadata table
 */
export function getMetadataColumnsExtended(): Column<Metadata>[] {
  return [
    {
      key: "name",
      header: "Metadata",
      render: (item) => (
        <div>
          <p className="text-foreground font-medium">{item.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{item.code}</p>
        </div>
      ),
    },
    {
      key: "typeCode",
      header: "Type",
      render: (item) => (
        <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2.5 py-0.5 font-mono text-xs">
          {item.typeCode}
        </span>
      ),
    },
    {
      key: "parentCode",
      header: "Parent",
      render: (item) => (
        <span className="text-muted-foreground text-sm">{item.parentCode ?? "\u2014"}</span>
      ),
    },
    {
      key: "createdDateTime",
      header: "Created",
      render: (item) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(item.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (item) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(item.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
