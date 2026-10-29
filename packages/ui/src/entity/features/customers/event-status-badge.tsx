/**
 * Event Status Badge
 *
 * Displays a semantic status badge for customer event processing states.
 */

import { AlertCircle, AlertTriangle, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import type { CustomerEventStatus } from "./types";

export interface EventStatusBadgeProps {
  status: CustomerEventStatus;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_CONFIG: Record<
  CustomerEventStatus,
  { label: string; icon: typeof CheckCircle; classes: string; spin?: boolean }
> = {
  PROCESSED: {
    label: "Processed",
    icon: CheckCircle,
    classes: "bg-success/10 text-success-dark border-success/30",
  },
  QUEUED: {
    label: "Queued",
    icon: Clock,
    classes: "bg-primary/10 text-primary border-primary/30",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    classes: "bg-destructive/10 text-destructive border-destructive/30",
  },
  NO_CUSTOMER_ENTITY: {
    label: "No Customer",
    icon: AlertCircle,
    classes: "bg-accent/10 text-accent border-accent/30",
  },
  NO_EVENT_RULES: {
    label: "No Rules",
    icon: AlertTriangle,
    classes: "bg-accent/10 text-accent-dark border-accent/30",
  },
  PROCESSING: {
    label: "Processing",
    icon: Loader2,
    classes: "bg-primary/10 text-primary-dark border-primary/30",
    spin: true,
  },
};

export function EventStatusBadge({ status, size = "sm", className }: EventStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        config.classes,
        className
      )}
      role="status"
      aria-label={`Event status: ${config.label}`}
    >
      <Icon
        size={iconSize}
        className={cn(config.spin && "motion-safe:animate-spin")}
        aria-hidden="true"
      />
      {config.label}
    </Badge>
  );
}
