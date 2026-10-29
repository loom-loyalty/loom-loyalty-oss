"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "../lib/utils";

export interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional subtitle text */
  subtitle?: string;
  /** Icon to display */
  icon: LucideIcon;
  /** Trend information */
  trend?: {
    /** Trend value (e.g., "12.5%") */
    value: string;
    /** Trend direction */
    direction: "up" | "down" | "neutral";
  };
  /** Color variant */
  variant?: "primary" | "secondary" | "success" | "accent";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Additional className */
  className?: string;
}

const gradients = {
  primary: "from-primary to-primary-dark",
  secondary: "from-secondary-dark to-primary-dark",
  success: "from-success-dark to-success-darker",
  accent: "from-accent-darker to-accent-darkest",
};

const sizeClasses = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

/**
 * Gradient stat card component for displaying metrics.
 * Used for dashboard statistics across both Dashboard and Hub.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "primary",
  size = "md",
  isLoading,
  className,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label={`Loading ${title}`}
        className={cn(
          "overflow-hidden rounded-lg bg-gradient-to-r shadow-sm",
          gradients[variant],
          sizeClasses[size],
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="h-6 w-6 animate-pulse rounded bg-white/20" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-7 w-24 animate-pulse rounded bg-white/20" />
          <div className="h-4 w-20 animate-pulse rounded bg-white/15" />
        </div>
      </div>
    );
  }

  // Build descriptive label for screen readers
  const trendLabel =
    trend && trend.direction !== "neutral"
      ? `, ${trend.direction === "up" ? "increased" : "decreased"} by ${trend.value}`
      : "";
  const ariaLabel = `${title}: ${value}${trendLabel}`;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "overflow-hidden rounded-lg bg-gradient-to-r shadow-sm",
        gradients[variant],
        sizeClasses[size],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <Icon className="h-6 w-6 text-white/90" aria-hidden="true" />
        {trend && (
          <span
            className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-xs font-medium text-white"
            aria-hidden="true"
          >
            {trend.direction === "up" ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : trend.direction === "down" ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : null}
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p
          className={cn(
            "font-mono font-bold text-white tabular-nums",
            size === "lg" ? "text-3xl" : "text-2xl"
          )}
        >
          {value}
        </p>
        <p className="text-sm text-white/95">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-white/95">{subtitle}</p>}
      </div>
    </div>
  );
}
