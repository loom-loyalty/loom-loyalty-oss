"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";
import type { TargetCardInput, TargetProgress } from "./types";
import { getStatusBadgeClasses, getStatusLabel } from "./types";

export interface XOfYTargetCardProps {
  /** The X of Y target configuration */
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
 * XOfYTargetCard displays an X of Y target with dot matrix visualization.
 *
 * Features:
 * - Dot matrix grid showing completed vs remaining items
 * - "X of Y" progress text
 * - Success styling when achieved
 * - Compact variant with progress bar
 * - WCAG 2.1 AA accessible
 */
export function XOfYTargetCard({
  target,
  progress,
  onClick,
  variant = "default",
  className,
}: XOfYTargetCardProps): ReactNode {
  const status = progress?.status ?? "not_started";
  const isAchieved = status === "achieved";

  // Calculate progress values
  const completedItemIds = progress?.completedItemIds ?? [];
  const completedCount = completedItemIds.length;
  const totalItems = progress?.totalItems ?? target.items?.length ?? 0;
  const itemsNeeded = progress?.itemsNeeded ?? target.targetValue ?? 0;

  // Calculate percentage (based on items needed, not total items)
  const percentage =
    itemsNeeded === 0 ? 0 : Math.min(100, Math.round((completedCount / itemsNeeded) * 100));

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

  // For dot matrix, we show up to maxDots dots
  const maxDots = 20;
  const showDotMatrix = totalItems <= maxDots;

  if (variant === "compact") {
    return (
      <div
        role="article"
        aria-label={`${target.name} target - ${completedCount} of ${itemsNeeded} completed - ${getStatusLabel(status)}`}
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
            {completedCount}/{itemsNeeded}
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", isAchieved && "text-success-dark")}>
            {target.name}
          </p>
          <p className="text-muted-foreground text-sm">
            {completedCount} of {itemsNeeded} needed
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
      aria-label={`${target.name} target - ${completedCount} of ${itemsNeeded} completed - ${getStatusLabel(status)}`}
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

        {/* Progress badge */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full px-3 py-1 text-sm font-semibold",
            isAchieved
              ? "bg-success text-success-foreground"
              : completedCount >= itemsNeeded * 0.75
                ? "bg-primary/10 text-primary-dark"
                : "bg-muted text-foreground"
          )}
        >
          {completedCount}/{itemsNeeded}
        </div>
      </div>

      {/* Dot matrix or progress bar */}
      <div className="mt-4">
        {showDotMatrix ? (
          <div
            role="group"
            aria-label={`Progress: ${completedCount} of ${totalItems} items completed, ${itemsNeeded} needed`}
            className="flex flex-wrap gap-2"
          >
            {Array.from({ length: totalItems }).map((_, index) => {
              const isCompleted = index < completedCount;
              const isNeeded = index < itemsNeeded;
              return (
                <div
                  key={index}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    isCompleted && "bg-success text-success-foreground",
                    !isCompleted && isNeeded && "border-border bg-card border-2",
                    !isCompleted && !isNeeded && "border-border bg-muted border border-dashed"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isNeeded ? "text-muted-foreground" : "text-border"
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // For large numbers, show progress bar
          <div>
            <div
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={itemsNeeded}
              aria-label={`Progress: ${completedCount} of ${itemsNeeded} items completed`}
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
            <p className="text-muted-foreground mt-2 text-sm">
              {completedCount} of {totalItems} items ({itemsNeeded} needed to complete)
            </p>
          </div>
        )}
      </div>

      {/* Progress summary */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {completedCount} of {itemsNeeded} activities completed
        </span>
        {!isAchieved && completedCount < itemsNeeded && (
          <span className="text-muted-foreground">{itemsNeeded - completedCount} more needed</span>
        )}
      </div>

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
