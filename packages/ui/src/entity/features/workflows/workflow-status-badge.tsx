/**
 * WorkflowStatusBadge
 *
 * Visual indicator for workflow request status.
 * WCAG 2.1 AA compliant with proper ARIA attributes.
 */

import { Ban, CheckCircle, Circle, Clock, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";
import { REQUEST_STATUS_LABELS, type WorkflowRequestStatus } from "./types.js";

const statusIcons: Record<WorkflowRequestStatus, typeof Clock> = {
  P: Clock,
  I: Circle,
  A: CheckCircle,
  R: XCircle,
  C: Ban,
};

const statusStyles: Record<WorkflowRequestStatus, string> = {
  P: "bg-status-pending-bg text-status-pending-fg",
  I: "bg-primary/10 text-primary",
  A: "bg-success/10 text-success-dark",
  R: "bg-destructive/10 text-destructive",
  C: "bg-muted text-muted-foreground",
};

export interface WorkflowStatusBadgeProps {
  status: WorkflowRequestStatus;
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

/**
 * Badge displaying the current workflow request status
 */
export function WorkflowStatusBadge({
  status,
  showIcon = true,
  showLabel = true,
  className,
}: WorkflowStatusBadgeProps): ReactNode {
  const Icon = statusIcons[status];
  const label = REQUEST_STATUS_LABELS[status] ?? status;

  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={`Status: ${label}`}
      className={cn(statusStyles[status], className)}
    >
      {showIcon && Icon && <Icon className="mr-1 h-3 w-3" aria-hidden="true" />}
      {showLabel && <span>{label}</span>}
    </Badge>
  );
}
