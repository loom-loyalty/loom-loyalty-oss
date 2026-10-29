"use client";

import { formatShortDate } from "@loom-loyalty/core";
import { Check, Circle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";
import type { TargetCardInput, TargetProgress } from "./types";
import { getStatusBadgeClasses, getStatusLabel } from "./types";

export interface CompletionTargetCardProps {
  /** The completion target configuration */
  target: TargetCardInput;
  /** Customer's progress on this target (optional) */
  progress?: TargetProgress;
  /** Callback when the card is clicked */
  onClick?: () => void;
  /** Callback when celebration animation completes */
  onCelebrate?: () => void;
  /** Visual variant */
  variant?: "default" | "compact";
  /** Additional className */
  className?: string;
}

/**
 * CompletionTargetCard displays a binary completion target.
 *
 * Features:
 * - Achievement badge style with checkmark
 * - Success styling when achieved
 * - Compact variant for lists
 * - WCAG 2.1 AA accessible
 */
export function CompletionTargetCard({
  target,
  progress,
  onClick,
  variant = "default",
  className,
}: CompletionTargetCardProps): ReactNode {
  const isComplete = progress?.isComplete ?? progress?.status === "achieved";
  const status = progress?.status ?? "not_started";

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

  if (variant === "compact") {
    return (
      <div
        role="article"
        aria-label={`${target.name} target - ${getStatusLabel(status)}`}
        className={cn(
          "bg-card flex items-center gap-3 rounded-lg border p-3 transition-all",
          "border-border hover:border-primary/30",
          isComplete && "border-success/30 bg-success/5",
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
        {/* Completion badge */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isComplete
              ? "bg-success text-success-foreground"
              : "border-border text-muted-foreground border-2"
          )}
        >
          {isComplete ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Circle className="h-4 w-4" aria-hidden="true" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", isComplete && "text-success-dark")}>
            {target.name}
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
      aria-label={`${target.name} target - ${getStatusLabel(status)}`}
      className={cn(
        "group bg-card rounded-xl border p-6 transition-all",
        "border-border hover:border-primary/30 hover:shadow-sm",
        isComplete && "border-success/30 bg-success/5",
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
      {/* Header with badge */}
      <div className="flex items-start gap-4">
        {/* Achievement badge */}
        <div
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition-all",
            isComplete
              ? "bg-success shadow-success/25 text-success-foreground shadow-lg"
              : "border-border text-muted-foreground border-4"
          )}
        >
          {isComplete ? (
            <Check className="h-8 w-8" aria-hidden="true" />
          ) : (
            <Circle className="h-8 w-8" aria-hidden="true" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-lg font-semibold", isComplete && "text-success-dark")}>
            {target.name}
          </h3>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}

          {/* Code badge */}
          <span className="bg-muted text-muted-foreground mt-2 inline-block rounded px-2 py-0.5 font-mono text-xs">
            {target.code}
          </span>
        </div>
      </div>

      {/* Footer with status */}
      <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            getStatusBadgeClasses(status)
          )}
        >
          {getStatusLabel(status)}
        </span>

        {/* Completion date */}
        {progress?.completedDateTime && (
          <span className="text-muted-foreground text-sm">
            Completed {formatShortDate(progress.completedDateTime)}
          </span>
        )}
      </div>
    </div>
  );
}
