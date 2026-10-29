/**
 * OfferTypeBadge
 *
 * Visual indicator for offer type (COUPON or EXTERNAL).
 * WCAG 2.1 AA compliant with proper ARIA attributes.
 */

import { ExternalLink, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";

export interface OfferTypeBadgeProps {
  /** Offer type value */
  type: string;
  /** Additional className */
  className?: string;
}

/** Type configuration mapping */
const TYPE_CONFIG: Record<string, { label: string; icon: typeof Ticket; classes: string }> = {
  COUPON: {
    label: "Coupon",
    icon: Ticket,
    classes: "bg-primary/10 text-primary border-primary/30",
  },
  EXTERNAL: {
    label: "External",
    icon: ExternalLink,
    classes: "bg-accent/10 text-accent border-accent/30",
  },
};

/**
 * Badge displaying the offer type
 */
export function OfferTypeBadge({ type, className }: OfferTypeBadgeProps): ReactNode {
  const config = TYPE_CONFIG[type];

  if (!config) {
    return (
      <Badge
        variant="outline"
        role="img"
        aria-label={`Type: ${type}`}
        className={cn("bg-muted text-muted-foreground", className)}
      >
        {type}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      role="img"
      aria-label={`Type: ${config.label}`}
      className={cn("gap-1 border font-medium", config.classes, className)}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}
