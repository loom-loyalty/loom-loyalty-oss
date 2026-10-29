"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";
import type { TargetCardInput, TargetProgress } from "./types";
import { getStatusBadgeClasses, getStatusLabel } from "./types";

export interface MilestoneTargetCardProps {
  /** The milestone target configuration */
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
 * MilestoneTargetCard displays a milestone-based target with stepped progress.
 *
 * Features:
 * - Stepped progress indicator
 * - Milestone completion circles
 * - Current milestone highlighting
 * - Success styling when all achieved
 * - Compact variant for lists
 * - WCAG 2.1 AA accessible
 */
export function MilestoneTargetCard({
  target,
  progress,
  onClick,
  variant = "default",
  className,
}: MilestoneTargetCardProps): ReactNode {
  const status = progress?.status ?? "not_started";
  const isAchieved = status === "achieved";

  // Calculate milestone progress
  const currentMilestoneIndex = progress?.currentMilestoneIndex ?? 0;
  const totalMilestones = progress?.totalMilestones ?? target.items?.length ?? 0;
  const currentMilestoneName = progress?.currentMilestoneName;

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

  // Get milestone status for each step
  const getMilestoneStatus = (index: number): "completed" | "current" | "pending" => {
    if (index < currentMilestoneIndex) return "completed";
    if (index === currentMilestoneIndex && !isAchieved) return "current";
    if (isAchieved && index < totalMilestones) return "completed";
    return "pending";
  };

  if (variant === "compact") {
    return (
      <div
        role="article"
        aria-label={`${target.name} target - Milestone ${currentMilestoneIndex} of ${totalMilestones} - ${getStatusLabel(status)}`}
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
        {/* Mini step indicator */}
        <div className="flex shrink-0 items-center gap-0.5">
          {Array.from({ length: Math.min(totalMilestones, 5) }).map((_, index) => {
            const milestoneStatus = getMilestoneStatus(index);
            return (
              <div
                key={index}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  milestoneStatus === "completed" && "bg-success",
                  milestoneStatus === "current" && "bg-primary animate-pulse",
                  milestoneStatus === "pending" && "bg-border"
                )}
              />
            );
          })}
          {totalMilestones > 5 && (
            <span className="text-muted-foreground ml-1 text-xs">+{totalMilestones - 5}</span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", isAchieved && "text-success-dark")}>
            {target.name}
          </p>
          <p className="text-muted-foreground text-sm">
            {currentMilestoneIndex} of {totalMilestones}
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
      aria-label={`${target.name} target - Milestone ${currentMilestoneIndex} of ${totalMilestones} - ${getStatusLabel(status)}`}
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
            isAchieved ? "bg-success text-success-foreground" : "bg-muted text-foreground"
          )}
        >
          {currentMilestoneIndex}/{totalMilestones}
        </div>
      </div>

      {/* Stepped progress indicator */}
      <div className="mt-6" role="list" aria-label="Milestone progress">
        <div className="flex items-center">
          {Array.from({ length: totalMilestones }).map((_, index) => {
            const milestoneStatus = getMilestoneStatus(index);
            const isLast = index === totalMilestones - 1;

            return (
              <div
                key={index}
                role="listitem"
                aria-label={`Milestone ${index + 1} - ${milestoneStatus}`}
                className="flex flex-1 items-center"
              >
                {/* Step circle */}
                <div
                  className={cn(
                    "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                    milestoneStatus === "completed" && "bg-success text-success-foreground",
                    milestoneStatus === "current" &&
                      "bg-primary ring-primary/20 text-primary-foreground ring-4",
                    milestoneStatus === "pending" &&
                      "border-border bg-card text-muted-foreground border-2"
                  )}
                >
                  {milestoneStatus === "completed" ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                  {milestoneStatus === "current" && (
                    <span className="bg-primary/30 absolute inset-0 animate-ping rounded-full" />
                  )}
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-all",
                      index < currentMilestoneIndex ? "bg-success" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current milestone info */}
      {currentMilestoneName && !isAchieved && (
        <div className="mt-4 text-center">
          <span className="text-muted-foreground text-sm">Current: </span>
          <span className="text-primary-dark font-medium">{currentMilestoneName}</span>
        </div>
      )}

      {/* Footer with code and status */}
      <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
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
