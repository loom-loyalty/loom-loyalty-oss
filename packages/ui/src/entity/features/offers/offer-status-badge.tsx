/**
 * OfferStatusBadge
 *
 * Visual indicator for offer status (active/inactive based on environments).
 * WCAG 2.1 AA compliant with proper ARIA attributes.
 */

import { CheckCircle, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";

export interface OfferStatusBadgeProps {
  /** Whether the offer has enabled environments (active) */
  active: boolean;
  /** Additional className */
  className?: string;
}

/** Status configuration mapping */
const STATUS_CONFIG = {
  active: {
    label: "Active",
    icon: CheckCircle,
    classes: "bg-success/10 text-success-dark border-success/30",
  },
  inactive: {
    label: "Inactive",
    icon: Clock,
    classes: "bg-muted text-muted-foreground border-border",
  },
} as const;

/**
 * Badge displaying the current offer status
 */
export function OfferStatusBadge({ active, className }: OfferStatusBadgeProps): ReactNode {
  const config = active ? STATUS_CONFIG.active : STATUS_CONFIG.inactive;
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
