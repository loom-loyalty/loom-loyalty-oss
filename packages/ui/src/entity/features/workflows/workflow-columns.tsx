/**
 * Workflow Column Definitions
 *
 * Column definitions for the Workflows DataTable.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import type { Workflow } from "./types.js";

/**
 * Extract description text from localized description object
 */
function getDescription(description?: Record<string, unknown>): string {
  if (!description) return "";
  const enUS = description["en-US"];
  const en = description["en"];
  if (typeof enUS === "string") return enUS;
  if (typeof en === "string") return en;
  return "";
}

/**
 * Extended columns for the workflows table
 */
export function getWorkflowColumnsExtended(): Column<Workflow>[] {
  return [
    {
      key: "name",
      header: "Workflow",
      render: (workflow) => (
        <div>
          <p className="text-foreground font-medium">{workflow.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{workflow.code}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (workflow) => {
        const desc = getDescription(workflow.description);
        return (
          <p className="text-muted-foreground truncate text-sm" title={desc}>
            {desc || "\u2014"}
          </p>
        );
      },
    },
    {
      key: "steps",
      header: "Steps",
      render: (workflow) => (
        <span className="text-muted-foreground text-sm">
          {workflow.steps?.length ?? 0} {(workflow.steps?.length ?? 0) === 1 ? "step" : "steps"}
        </span>
      ),
    },
    {
      key: "active",
      header: "Status",
      render: (workflow) => (
        <Badge
          variant={workflow.active ? "success" : "secondary"}
          role="status"
          aria-label={workflow.active ? "Active" : "Inactive"}
        >
          {workflow.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdDateTime",
      header: "Created",
      render: (workflow) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(workflow.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (workflow) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(workflow.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
