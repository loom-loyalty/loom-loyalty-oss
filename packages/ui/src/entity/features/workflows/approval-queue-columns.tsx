/**
 * Approval Queue Column Definitions
 *
 * Column definitions for the Approval Queue DataTable.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Column } from "../../../data-display/data-table.js";
import type { WorkflowRequest } from "./types.js";
import { WorkflowStatusBadge } from "./workflow-status-badge.js";

/**
 * Extended columns for the approval queue table
 */
export function getApprovalQueueColumnsExtended(): Column<WorkflowRequest>[] {
  return [
    {
      key: "entities",
      header: "Entity",
      render: (request) => {
        const primary = request.entities?.find((e) => e.primaryEntity);
        return (
          <div>
            <p className="text-foreground font-medium">{primary?.entityName ?? "Unknown"}</p>
            <p className="text-muted-foreground text-xs">{primary?.entityType ?? "\u2014"}</p>
          </div>
        );
      },
    },
    {
      key: "environmentWorkflow",
      header: "Workflow",
      render: (request) => (
        <span className="text-muted-foreground text-sm">
          {request.environmentWorkflow?.name ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (request) => <WorkflowStatusBadge status={request.status} />,
    },
    {
      key: "requestedDateTime",
      header: "Requested",
      render: (request) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(request.requestedDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "approvedDateTime",
      header: "Resolved",
      render: (request) => {
        const resolvedDate = request.approvedDateTime ?? request.rejectedDateTime;
        return (
          <span className="text-muted-foreground text-sm">
            {resolvedDate ? (formatShortDate(resolvedDate) ?? "\u2014") : "\u2014"}
          </span>
        );
      },
    },
  ];
}
