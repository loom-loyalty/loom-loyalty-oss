"use client";

import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";

export interface MetricItem {
  /** Unique key */
  key: string;
  /** Display label */
  label: string;
  /** Metric value */
  value: string | number;
  /** Optional icon */
  icon?: LucideIcon;
}

export interface MetricsBarProps {
  /** Metrics to display */
  metrics: MetricItem[];
  /** LocalStorage key for collapsed state persistence */
  storageKey?: string;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Collapsible metrics bar for displaying summary statistics.
 * Used in data-dense layouts to save vertical space.
 */
export function MetricsBar({
  metrics,
  storageKey,
  defaultCollapsed = false,
  className,
}: MetricsBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey);
        return stored !== null ? stored === "true" : defaultCollapsed;
      } catch {
        // localStorage may be unavailable in private browsing or quota exceeded
        return defaultCollapsed;
      }
    }
    return defaultCollapsed;
  });

  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, String(isCollapsed));
      } catch {
        // localStorage may be unavailable in private browsing or quota exceeded
      }
    }
  }, [isCollapsed, storageKey]);

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);

  return (
    <div
      className={cn(
        "border-border bg-card overflow-hidden rounded-lg border transition-all",
        isCollapsed ? "py-2" : "py-3",
        className
      )}
    >
      <div className="flex items-center justify-between px-4">
        {/* Metrics */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-6 gap-y-2 transition-all",
            isCollapsed ? "gap-x-4" : "gap-x-6"
          )}
          role="group"
          aria-label="Summary metrics"
        >
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.key}
                className={cn(
                  "flex items-center gap-2",
                  index > 0 && "border-border border-l pl-6",
                  isCollapsed && "gap-1.5"
                )}
                role="status"
                aria-label={`${metric.label}: ${metric.value}`}
              >
                {Icon && (
                  <Icon
                    className={cn("text-muted-foreground", isCollapsed ? "h-3.5 w-3.5" : "h-4 w-4")}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "text-foreground font-mono font-semibold tabular-nums",
                    isCollapsed ? "text-sm" : "text-lg"
                  )}
                >
                  {metric.value}
                </span>
                <span className={cn("text-muted-foreground", isCollapsed ? "text-xs" : "text-sm")}>
                  {metric.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand metrics" : "Collapse metrics"}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="ml-1 text-xs">{isCollapsed ? "Show" : "Hide"}</span>
        </Button>
      </div>
    </div>
  );
}
