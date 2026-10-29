"use client";

import { cn } from "../lib/utils";

export interface InlineStat {
  /** Display label */
  label: string;
  /** Stat value */
  value: string | number;
}

export interface InlineStatsProps {
  /** Stats to display */
  stats: InlineStat[];
  /** Separator between stats */
  separator?: string;
  /** Additional className */
  className?: string;
}

/**
 * Inline stats display for footer or subtle summary information.
 * Used in minimal layouts to show stats without taking up space.
 */
export function InlineStats({ stats, separator = "\u2022", className }: InlineStatsProps) {
  return (
    <div
      className={cn("text-muted-foreground flex flex-wrap items-center gap-2 text-sm", className)}
      role="status"
      aria-label="Statistics summary"
    >
      {stats.map((stat, index) => (
        <span key={stat.label} className="inline-flex items-center gap-1">
          {index > 0 && (
            <span className="text-muted-foreground/50 mr-2" aria-hidden="true">
              {separator}
            </span>
          )}
          <span className="text-foreground font-mono font-medium tabular-nums">{stat.value}</span>
          <span>{stat.label}</span>
        </span>
      ))}
    </div>
  );
}
