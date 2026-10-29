"use client";

import { cn } from "../lib/utils";

export interface TierBadgeProps {
  /** Tier name */
  tier: string;
  /** Additional className */
  className?: string;
}

const tierStyles: Record<string, string> = {
  platinum:
    "bg-gradient-to-r from-tier-platinum-from to-tier-platinum-to text-tier-platinum-foreground",
  gold: "bg-gradient-to-r from-tier-gold-from to-tier-gold-to text-tier-gold-foreground",
  silver: "bg-gradient-to-r from-tier-silver-from to-tier-silver-to text-tier-silver-foreground",
  bronze: "bg-gradient-to-r from-tier-bronze-from to-tier-bronze-to text-tier-bronze-foreground",
  // Default for unknown tiers
  default:
    "bg-gradient-to-r from-tier-default-from to-tier-default-to text-tier-default-foreground",
};

/**
 * Badge component for displaying tier levels (Platinum, Gold, Silver, Bronze).
 * Uses gradient styling matching the Loom design system.
 * Includes ARIA attributes for accessibility (WCAG 2.1 AA).
 */
export function TierBadge({ tier, className }: TierBadgeProps) {
  const tierKey = tier.toLowerCase();
  const style = tierStyles[tierKey] || tierStyles.default;

  return (
    <span
      role="img"
      aria-label={`Membership tier: ${tier}`}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        style,
        className
      )}
    >
      {tier}
    </span>
  );
}
