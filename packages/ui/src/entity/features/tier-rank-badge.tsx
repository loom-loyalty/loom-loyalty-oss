"use client";

import { cn } from "../../lib/utils";

export interface TierRankBadgeProps {
  /** The rank number (1 = 1st place, 2 = 2nd place, etc.) */
  rank: number;
  /** Optional tier name for enhanced aria-label */
  tierName?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
}

/**
 * Converts a number to its ordinal form (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0] ?? "th";
  return `${n}${suffix}`;
}

/**
 * Medal styling based on rank
 * Uses semantic tier tokens for consistent theming.
 * - 1st: Gold styling (tier-gold-*)
 * - 2nd: Silver styling (tier-silver-*)
 * - 3rd: Bronze styling (tier-bronze-*)
 * - 4th+: Default styling (tier-default-*)
 */
const rankStyles: Record<number | "default", { badge: string; icon: string }> = {
  1: {
    badge:
      "bg-gradient-to-r from-tier-gold-from to-tier-gold-to text-tier-gold-foreground ring-tier-gold-ring",
    icon: "text-tier-gold-foreground",
  },
  2: {
    badge:
      "bg-gradient-to-r from-tier-silver-from to-tier-silver-to text-tier-silver-foreground ring-tier-silver-ring",
    icon: "text-tier-silver-foreground",
  },
  3: {
    badge:
      "bg-gradient-to-r from-tier-bronze-from to-tier-bronze-to text-tier-bronze-foreground ring-tier-bronze-ring",
    icon: "text-tier-bronze-foreground",
  },
  default: {
    badge:
      "bg-gradient-to-r from-tier-default-from to-tier-default-to text-tier-default-foreground ring-tier-default-ring",
    icon: "text-tier-default-foreground",
  },
};

const sizeStyles = {
  sm: {
    badge: "px-2 py-0.5 text-xs gap-1",
    icon: "h-3 w-3",
  },
  md: {
    badge: "px-2.5 py-1 text-sm gap-1.5",
    icon: "h-4 w-4",
  },
  lg: {
    badge: "px-3 py-1.5 text-base gap-2",
    icon: "h-5 w-5",
  },
};

/**
 * Medal icon component using CSS for simple medal shape
 */
function MedalIcon({ className, rank }: { className?: string; rank: number }) {
  // Only show medal icons for top 3
  if (rank > 3) {
    return null;
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {/* Medal ribbon */}
      <path d="M12 2L8 8H16L12 2Z" opacity="0.8" />
      {/* Medal circle */}
      <circle cx="12" cy="15" r="7" />
      {/* Medal number */}
      <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">
        {rank}
      </text>
    </svg>
  );
}

/**
 * Badge component for displaying tier rankings (1st, 2nd, 3rd, 4th, etc.).
 * Shows medal icon for top 3 positions with gold/silver/bronze styling.
 * Includes ARIA attributes for accessibility (WCAG 2.1 AA).
 */
export function TierRankBadge({ rank, tierName, size = "md", className }: TierRankBadgeProps) {
  const style = rankStyles[rank] || rankStyles.default;
  const sizeStyle = sizeStyles[size];
  const ordinal = getOrdinal(rank);

  const ariaLabel = tierName ? `${tierName} tier, ranked ${ordinal}` : `Ranked ${ordinal}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full font-semibold ring-1 ring-inset",
        style.badge,
        sizeStyle.badge,
        className
      )}
    >
      {rank <= 3 && <MedalIcon className={cn(sizeStyle.icon, style.icon)} rank={rank} />}
      <span>{ordinal}</span>
    </span>
  );
}
