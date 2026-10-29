/**
 * Metadata Type Column Definitions
 *
 * Column definitions for the MetadataTypes DataTable.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { MetadataType } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { CategoryBadge } from "./category-badge.js";

/**
 * Extended columns for the metadata types table
 */
export function getMetadataTypeColumnsExtended(): Column<MetadataType>[] {
  return [
    {
      key: "name",
      header: "Metadata Type",
      render: (item) => (
        <div>
          <p className="text-foreground font-medium">{item.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{item.code}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (item) => <CategoryBadge category={item.category} />,
    },
    {
      key: "searchable",
      header: "Searchable",
      render: (item) => (
        <span
          className={
            item.searchable ? "text-success-dark text-sm" : "text-muted-foreground text-sm"
          }
        >
          {item.searchable ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "children",
      header: "Children",
      render: (item) => (
        <span className="text-muted-foreground text-sm">{item.children?.length ?? 0}</span>
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
