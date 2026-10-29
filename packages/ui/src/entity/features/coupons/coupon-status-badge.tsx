/**
 * CouponStatusBadge
 *
 * Visual indicator for coupon status.
 * WCAG 2.1 AA compliant with proper ARIA attributes.
 */

import { Ban, CheckCircle, Clock, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";

export interface CouponStatusBadgeProps {
  /** Coupon status value */
  status: string;
  /** Additional className */
  className?: string;
}

/** Status configuration mapping */
const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; classes: string }> =
  {
    ACTIVE: {
      label: "Active",
      icon: CheckCircle,
      classes: "bg-success/10 text-success-dark border-success/30",
    },
    INACTIVE: {
      label: "Inactive",
      icon: Clock,
      classes: "bg-muted text-muted-foreground border-border",
    },
    EXPIRED: {
      label: "Expired",
      icon: XCircle,
      classes: "bg-destructive/10 text-destructive border-destructive/30",
    },
    REDEEMED: {
      label: "Redeemed",
      icon: Ban,
      classes: "bg-accent/10 text-accent border-accent/30",
    },
    USED: {
      label: "Used",
      icon: Ban,
      classes: "bg-accent/10 text-accent border-accent/30",
    },
    CANCELLED: {
      label: "Cancelled",
      icon: Ban,
      classes: "bg-destructive/10 text-destructive border-destructive/30",
    },
  };

/**
 * Badge displaying the current coupon status
 */
export function CouponStatusBadge({ status, className }: CouponStatusBadgeProps): ReactNode {
  const config = STATUS_CONFIG[status];

  if (!config) {
    return (
      <Badge
        variant="outline"
        role="status"
        aria-label={`Status: ${status}`}
        className={cn("bg-muted text-muted-foreground", className)}
      >
        {status}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={`Status: ${config.label}`}
      className={cn("gap-1 border font-medium", config.classes, className)}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}
