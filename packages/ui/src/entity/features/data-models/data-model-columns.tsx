/**
 * Data Model Column Definitions
 *
 * Column definitions for the DataModels DataTable.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { DataModel } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";
import type { Column } from "../../../data-display/data-table.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";
import { ClassificationBadge, getTypeClassification } from "./classification.js";
import { VersionStatusBadge } from "./detail/version-status-badge.js";
import type { DataModelVersionStatus } from "./types.js";

/**
 * Version status rendering — shows version number + status badge.
 */
function renderVersion(item: DataModel): ReactNode {
  const version = item.version;
  const status = item.versionStatus;

  if (version === undefined || version === null) {
    return <span className="text-muted-foreground text-sm">\u2014</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground font-mono text-xs">v{version}</span>
      {status && <VersionStatusBadge status={status as DataModelVersionStatus} />}
    </div>
  );
}

/**
 * Extended columns for the data models table
 */
export function getDataModelColumnsExtended(): Column<DataModel>[] {
  return [
    {
      key: "type",
      header: "Data Model",
      render: (item) => (
        <div>
          <p className="text-foreground font-medium">{item.type?.name ?? "\u2014"}</p>
          <p className="text-muted-foreground font-mono text-xs">{item.type?.code ?? "\u2014"}</p>
        </div>
      ),
    },
    {
      key: "classification",
      header: "Class",
      render: (item) => (
        <ClassificationBadge classification={getTypeClassification(item.type)} size="sm" />
      ),
    },
    {
      key: "elements",
      header: "Elements",
      render: (item) => {
        const count = item.elements?.length ?? 0;
        const isEmpty = count === 0;
        return (
          <span
            className={
              isEmpty
                ? "text-warning font-mono text-sm tabular-nums"
                : "text-muted-foreground font-mono text-sm tabular-nums"
            }
            title={isEmpty ? "No elements defined" : undefined}
          >
            {count}
          </span>
        );
      },
    },
    {
      key: "version",
      header: "Version",
      render: renderVersion,
    },
    {
      key: "childTypeReferences",
      header: "Child Types",
      render: (item) => (
        <span className="text-muted-foreground font-mono text-sm tabular-nums">
          {item.childTypeReferences?.length ?? 0}
        </span>
      ),
    },
    getEnvironmentColumn(),
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
