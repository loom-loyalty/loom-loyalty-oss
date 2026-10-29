/**
 * Event Rule Category Badge
 *
 * Displays event rule categories with color-coding, icons,
 * and title tooltip showing descriptions and processing order.
 */

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";

import { CATEGORY_INFO, type EventRuleCategory } from "./types.js";

/**
 * Semantic color map for each category using design tokens.
 */
const CATEGORY_COLORS: Record<EventRuleCategory, string> = {
  BASE: "bg-primary/10 text-primary-dark border-primary/20",
  ORGANIZATION_DEFINED: "bg-accent/10 text-accent-dark border-accent/20",
  PARTNER: "bg-success/10 text-success-dark border-success/20",
  ADJUSTMENT: "bg-warning/10 text-warning-dark border-warning/20",
  TIER: "bg-info/10 text-info-dark border-info/20",
  PROMOTION: "bg-accent/15 text-accent-darker border-accent/25",
  TIER_AFTER_PROMOTION: "bg-primary/15 text-primary-darker border-primary/25",
  REDEMPTION: "bg-destructive/10 text-destructive border-destructive/20",
  COMMUNICATION: "bg-success/15 text-success-darker border-success/25",
};

export interface EventRuleCategoryBadgeProps {
  category: EventRuleCategory | string;
  showCode?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
} as const;

const ICON_SIZES = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
} as const;

export function EventRuleCategoryBadge({
  category,
  showCode = false,
  size = "md",
  className,
}: EventRuleCategoryBadgeProps): ReactNode {
  const info = CATEGORY_INFO[category as EventRuleCategory];

  if (!info) {
    return (
      <Badge variant="outline" className={className}>
        {category}
      </Badge>
    );
  }

  const Icon = info.icon;
  const colorClasses = CATEGORY_COLORS[category as EventRuleCategory] ?? "";

  return (
    <Badge
      variant="outline"
      role="img"
      aria-label={`Category: ${info.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        colorClasses,
        SIZE_CLASSES[size],
        className
      )}
      title={`${info.label}: ${info.description} (Order: ${String(info.order)})`}
    >
      <Icon className={ICON_SIZES[size]} aria-hidden="true" />
      <span>{showCode ? info.shortCode : info.label}</span>
    </Badge>
  );
}
