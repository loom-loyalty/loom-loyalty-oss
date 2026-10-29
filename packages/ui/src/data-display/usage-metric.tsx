"use client";

import { AlertTriangle, Infinity as InfinityIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Card, CardContent } from "../primitives/card";
import { Progress } from "../primitives/progress";

export interface UsageMetricProps {
  /** Metric display label */
  label: string;
  /** Current usage value */
  current: number;
  /** Usage limit (null/undefined = unlimited) */
  limit?: number | null;
  /** Unit of measurement (e.g., "calls", "MB", "members") */
  unit: string;
  /** Percentage of limit used (0-100+) */
  percentUsed: number;
  /** Number of units over the limit */
  overageCount: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Determines the progress bar variant based on percentage used.
 */
function getProgressVariant(
  percentUsed: number
): "default" | "warning" | "destructive" | "success" {
  if (percentUsed >= 100) return "destructive";
  if (percentUsed >= 80) return "warning";
  return "default";
}

/**
 * Formats a number with locale-aware thousands separators.
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Usage metric card component for displaying billing usage.
 * Shows current usage vs limit with a progress bar and overage indicator.
 *
 * @example
 * ```tsx
 * <UsageMetric
 *   label="API Calls"
 *   current={1500}
 *   limit={5000}
 *   unit="calls"
 *   percentUsed={30}
 *   overageCount={0}
 * />
 * ```
 */
export function UsageMetric({
  label,
  current,
  limit,
  unit,
  percentUsed,
  overageCount,
  className,
}: UsageMetricProps) {
  const isUnlimited = limit === null || limit === undefined;
  const variant = isUnlimited ? "default" : getProgressVariant(percentUsed);
  const isOverLimit = overageCount > 0;

  // Build accessible label
  const statusLabel = isOverLimit
    ? `over limit by ${formatNumber(overageCount)} ${unit}`
    : isUnlimited
      ? "unlimited"
      : `${percentUsed.toFixed(0)}% used`;
  const ariaLabel = `${label}: ${formatNumber(current)} ${unit}${isUnlimited ? "" : ` of ${formatNumber(limit!)} limit`}, ${statusLabel}`;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-foreground text-sm font-medium">{label}</h3>
          {isOverLimit && (
            <Badge variant="error" className="flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              <span>+{formatNumber(overageCount)} over</span>
            </Badge>
          )}
        </div>

        <div className="mb-2">
          <Progress
            value={isUnlimited ? current : Math.min(percentUsed, 100)}
            max={100}
            variant={variant}
            aria-label={ariaLabel}
          />
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {formatNumber(current)}
            </span>
            {isUnlimited ? (
              <span className="ml-1 inline-flex items-center gap-1">
                <InfinityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">unlimited</span>
              </span>
            ) : (
              <span>
                {" "}
                / {formatNumber(limit!)} {unit}
              </span>
            )}
          </p>
          {!isUnlimited && (
            <span
              className={cn(
                "text-xs font-medium",
                variant === "destructive" && "text-destructive",
                variant === "warning" && "text-warning-foreground",
                variant === "default" && "text-muted-foreground"
              )}
            >
              {percentUsed.toFixed(0)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
