"use client";

import { Check, Circle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";
import type { TargetCardInput, TargetProgress } from "./types";
import { calculateProgressPercentage, getStatusBadgeClasses, getStatusLabel } from "./types";

export interface CounterTargetCardProps {
  /** The counter target configuration */
  target: TargetCardInput;
  /** Customer's progress on this target (optional) */
  progress?: TargetProgress;
  /** Callback when the card is clicked */
  onClick?: () => void;
  /** Visual variant */
  variant?: "default" | "compact";
  /** Additional className */
  className?: string;
}

/**
 * CounterTargetCard displays a numeric counter target with progress visualization.
 *
 * Features:
 * - Progress bar showing current/target value
 * - Percentage badge
 * - Cycle tracking when applicable
 * - Success styling when achieved
 * - Compact variant for lists
 * - WCAG 2.1 AA accessible
 */
export function CounterTargetCard({
  target,
  progress,
  onClick,
  variant = "default",
  className,
}: CounterTargetCardProps): ReactNode {
  const status = progress?.status ?? "not_started";
  const isAchieved = status === "achieved";

  // Calculate progress values
  const currentValue = progress?.currentValue ?? 0;
  const targetValue = progress?.targetValue ?? target.targetValue ?? 0;
  const percentage = calculateProgressPercentage({
    targetId: target.targetId ?? "",
    customerId: progress?.customerId ?? "",
    status,
    currentValue,
    targetValue,
  });

  // Format numbers with commas
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Extract description from localized object
  const getDescription = (): string | null => {
    if (!target.description || typeof target.description !== "object") {
      return null;
    }
    const descObj = target.description as Record<string, unknown>;
    if (typeof descObj.en === "string") {
      return descObj.en;
    }
    const firstValue = Object.values(descObj)[0];
    return typeof firstValue === "string" ? firstValue : null;
  };

  const description = getDescription();

  // Calculate cycles
  const cyclesCompleted = progress?.cyclesCompleted ?? 0;
  const totalCycles = progress?.totalCycles ?? target.numberOfCycles;
  const hasCycles = totalCycles !== undefined && totalCycles > 0;

  if (variant === "compact") {
    return (
      <div
        role="article"
        aria-label={`${target.name} target - ${formatNumber(currentValue)} of ${formatNumber(targetValue)} - ${getStatusLabel(status)}`}
        className={cn(
          "bg-card flex items-center gap-3 rounded-lg border p-3 transition-all",
          "border-border hover:border-primary/30",
          isAchieved && "border-success/30 bg-success/5",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        tabIndex={onClick ? 0 : undefined}
      >
        {/* Progress indicator */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <svg className="h-10 w-10 -rotate-90 transform" viewBox="0 0 36 36">
            {/* Background circle */}
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-border"
            />
            {/* Progress circle */}
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${percentage}, 100`}
              className={cn(isAchieved ? "text-success-dark" : "text-primary")}
            />
          </svg>
          <span
            className={cn(
              "absolute text-xs font-semibold",
              isAchieved ? "text-success-dark" : "text-foreground"
            )}
          >
            {percentage}%
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", isAchieved && "text-success-dark")}>
            {target.name}
          </p>
          <p className="text-muted-foreground text-sm">
            {formatNumber(currentValue)} / {formatNumber(targetValue)}
          </p>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            getStatusBadgeClasses(status)
          )}
        >
          {getStatusLabel(status)}
        </span>
      </div>
    );
  }

  return (
    <div
      role="article"
      aria-label={`${target.name} target - ${formatNumber(currentValue)} of ${formatNumber(targetValue)} - ${getStatusLabel(status)}`}
      className={cn(
        "group bg-card rounded-xl border p-6 transition-all",
        "border-border hover:border-primary/30 hover:shadow-sm",
        isAchieved && "border-success/30 bg-success/5",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-lg font-semibold", isAchieved && "text-success-dark")}>
            {target.name}
          </h3>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>

        {/* Percentage badge */}
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            isAchieved
              ? "bg-success text-success-foreground"
              : percentage >= 75
                ? "bg-primary/10 text-primary-dark"
                : percentage >= 50
                  ? "bg-status-pending-bg text-status-pending-fg"
                  : "bg-muted text-muted-foreground"
          )}
        >
          {percentage}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuenow={currentValue}
          aria-valuemin={0}
          aria-valuemax={targetValue}
          aria-label={`Progress: ${formatNumber(currentValue)} of ${formatNumber(targetValue)}`}
          className="bg-muted h-3 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isAchieved ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {formatNumber(currentValue)} / {formatNumber(targetValue)}
          </span>
          {!isAchieved && targetValue > currentValue && (
            <span className="text-muted-foreground text-sm">
              {formatNumber(targetValue - currentValue)} to go
            </span>
          )}
        </div>
      </div>

      {/* Cycles indicator */}
      {hasCycles && (
        <div className="border-border mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Cycles completed</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalCycles }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    index < cyclesCompleted
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < cyclesCompleted ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3 w-3" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {cyclesCompleted} of {totalCycles} cycles
          </p>
        </div>
      )}

      {/* Footer with code and status */}
      <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
        <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-xs">
          {target.code}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            getStatusBadgeClasses(status)
          )}
        >
          {getStatusLabel(status)}
        </span>
      </div>
    </div>
  );
}
