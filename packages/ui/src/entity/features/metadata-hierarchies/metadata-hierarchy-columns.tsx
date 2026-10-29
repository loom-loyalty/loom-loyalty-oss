/**
 * Metadata Hierarchy Column Definitions for the DataTable.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { MetadataHierarchyView } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { formatHierarchyLevels } from "./format-hierarchy-levels.js";

/**
 * @param typeNames metadata type code → display name, used to render levels.
 */
export function getMetadataHierarchyColumns(
  typeNames: Readonly<Record<string, string>> = {}
): Column<MetadataHierarchyView>[] {
  return [
    {
      key: "name",
      header: "Metadata Hierarchy",
      render: (view) => (
        <div>
          <p className="text-foreground font-medium">{view.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{view.code}</p>
        </div>
      ),
    },
    {
      key: "levels",
      header: "Levels",
      render: (view) => {
        const text = formatHierarchyLevels(view.levels, typeNames);
        return (
          <p className="text-foreground text-sm" title={text}>
            {text || "—"}
          </p>
        );
      },
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (view) =>
        view.modifiedDateTime ? (
          <time dateTime={view.modifiedDateTime} className="text-muted-foreground text-sm">
            {formatShortDate(view.modifiedDateTime) ?? "—"}
          </time>
        ) : (
          <span className="text-muted-foreground text-sm">{"—"}</span>
        ),
    },
  ];
}
