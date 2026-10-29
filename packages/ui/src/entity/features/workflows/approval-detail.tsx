/**
 * Approval Detail Sheet Content
 *
 * Displays workflow request details with Approve/Reject actions.
 */

import { formatDateTime } from "@loom-loyalty/core";
import { CheckCircle, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import type { WorkflowRequest } from "./types.js";
import { WorkflowStatusBadge } from "./workflow-status-badge.js";

export interface ApprovalDetailProps {
  request: WorkflowRequest;
  onApprove?: () => void;
  onReject?: () => void;
  canApprove?: boolean;
}

/**
 * Approval request detail content for Sheet display
 */
export function ApprovalDetail({
  request,
  onApprove,
  onReject,
  canApprove = true,
}: ApprovalDetailProps): ReactNode {
  const primaryEntity = request.entities?.find((e) => e.primaryEntity);
  // "P" (pending) and "I" (in-progress, i.e. a still-pending step in a
  // multi-step request) are both actionable — matches the approval queue's
  // row-menu Approve/Reject, which has no status gate of its own and relies
  // on resolveActionableStepId to find the current step for either status.
  // Excluding "I" here used to hide these buttons for a request the row
  // menu could still act on.
  const isActionable = request.status === "P" || request.status === "I";

  return (
    <div className="space-y-6">
      {/* Request Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Request Information
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            <div className="mt-1">
              <WorkflowStatusBadge status={request.status} />
            </div>
          </div>
          <DetailRow label="Workflow" value={request.environmentWorkflow?.name ?? "\u2014"} />
          <DetailRow
            label="Requested"
            value={formatDateTime(request.requestedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* Entity Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Entity</h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={primaryEntity?.entityName ?? "\u2014"} />
          <DetailRow label="Type" value={primaryEntity?.entityType ?? "\u2014"} />
          <DetailRow label="ID" value={primaryEntity?.entityId ?? "\u2014"} mono />
        </div>

        {/* Additional entities */}
        {request.entities && request.entities.length > 1 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Related Entities ({request.entities.length - 1})
            </p>
            {request.entities
              .filter((e) => !e.primaryEntity)
              .map((entity) => (
                <Badge
                  key={entity.environmentWorkflowRequestEntityId}
                  variant="outline"
                  className="mr-1"
                >
                  {entity.entityName}
                </Badge>
              ))}
          </div>
        )}
      </section>

      {/* Resolution Details */}
      {(request.approvedDateTime || request.rejectedDateTime) && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Resolution
          </h3>
          <div className="space-y-3">
            {request.approvedDateTime && (
              <DetailRow
                label="Approved"
                value={formatDateTime(request.approvedDateTime) ?? "\u2014"}
              />
            )}
            {request.rejectedDateTime && (
              <>
                <DetailRow
                  label="Rejected"
                  value={formatDateTime(request.rejectedDateTime) ?? "\u2014"}
                />
                {request.rejectionReason && (
                  <DetailRow label="Rejection Reason" value={request.rejectionReason} />
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Action Buttons - only show for actionable requests */}
      {canApprove && isActionable && (
        <div className="border-border flex gap-2 border-t pt-4">
          {onReject && (
            <Button variant="outline" className="flex-1" onClick={onReject}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
          {onApprove && (
            <Button variant="primary-gradient" className="flex-1" onClick={onApprove}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium"}>
        {value}
      </p>
    </div>
  );
}
