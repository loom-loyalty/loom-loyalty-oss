"use client";

import { cn } from "../lib/utils";

export interface StatusBadgeProps {
  /** Status value */
  status: string;
  /** Additional className */
  className?: string;
}

const statusStyles: Record<string, string> = {
  active: "bg-status-active-bg text-status-active-fg",
  inactive: "bg-status-inactive-bg text-status-inactive-fg",
  pending: "bg-status-pending-bg text-status-pending-fg",
  success: "bg-success/10 text-status-active-fg",
  failed: "bg-status-error-bg text-status-error-fg",
  suspended: "bg-status-error-bg text-status-error-fg",
  trial: "bg-status-trial-bg text-status-trial-fg",
  expired: "bg-status-error-bg text-status-error-fg",
  cancelled: "bg-status-inactive-bg text-status-inactive-fg",
  // Promotion-specific statuses (display labels lowercased)
  "in progress": "bg-status-active-bg text-status-active-fg",
  achieved: "bg-success/10 text-status-active-fg",
  "not registered": "bg-status-inactive-bg text-status-inactive-fg",
  "not started": "bg-status-pending-bg text-status-pending-fg",
  // Explicit "nothing happened" state — muted/inactive, deliberately distinct
  // from success/warning/error/info so it never reads as a confirmed outcome.
  // Reuses the inactive pair (not bg-muted/text-muted-foreground) since that
  // combination falls below the 4.5:1 WCAG AA contrast ratio at this size.
  "no effect recorded": "bg-status-inactive-bg text-status-inactive-fg",
  // Default for unknown statuses
  default: "bg-status-inactive-bg text-status-inactive-fg",
};

/**
 * Badge component for displaying status indicators.
 * Uses color-coded styling for different status types.
 * Includes ARIA attributes for accessibility (WCAG 2.1 AA).
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusKey = status.toLowerCase();
  const style = statusStyles[statusKey] || statusStyles.default;

  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        style,
        className
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
