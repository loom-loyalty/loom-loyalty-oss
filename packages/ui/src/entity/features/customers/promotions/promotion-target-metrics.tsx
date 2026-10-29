/**
 * Promotion Target Metrics
 *
 * Renders type-specific inline progress for a CustomerPromotionTarget.
 * Supports counter (single/multi/tracking), completion, milestone, and X of Y.
 */

"use client";

import { Layers, Target } from "lucide-react";

import { Progress } from "../../../../primitives/progress";
import type { CustomerPromotionTarget } from "./types";

export interface PromotionTargetMetricsProps {
  /** The target to display metrics for */
  target: CustomerPromotionTarget | null;
  /** Message shown when target is null */
  emptyMessage?: string;
}

/**
 * Inline progress display for a promotion target.
 *
 * Renders type-specific metrics:
 * - **Counter (tracking):** "Current value: X"
 * - **Counter (single-cycle):** progress bar + "X / Y (Z%)"
 * - **Counter (multi-cycle):** dual progress bars (overall cycles + current cycle)
 * - **Completion:** "Status: Completed / Not Complete"
 * - **Milestone:** "X of Y milestones complete" + progress bar
 * - **X of Y:** "X of Y activities complete" + progress bar
 */
export function PromotionTargetMetrics({
  target,
  emptyMessage = "Not yet registered for this customer",
}: PromotionTargetMetricsProps) {
  if (!target) {
    return <p className="text-muted-foreground text-sm italic">{emptyMessage}</p>;
  }

  switch (target.targetType) {
    case "COUNTER":
      return <CounterMetrics target={target} />;
    case "COMPLETION":
      return <CompletionMetrics target={target} />;
    case "MILESTONE":
      return <MilestoneMetrics target={target} />;
    case "X_OF_Y":
      return <XOfYMetrics target={target} />;
    default:
      return (
        <p className="text-muted-foreground text-sm italic">
          Unknown target type: {target.targetType}
        </p>
      );
  }
}

// ─── Counter ────────────────────────────────────────────────────────────────

function CounterMetrics({ target }: { target: CustomerPromotionTarget }) {
  const current = target.currentValue ?? 0;
  const goal = target.targetValue;

  // Tracking counter (no achievement goal)
  if (!goal || goal === 0) {
    return (
      <p className="text-muted-foreground text-sm">Current value: {current.toLocaleString()}</p>
    );
  }

  const isMultiCycle =
    target.totalCycles !== undefined && target.totalCycles !== null && target.totalCycles > 1;

  if (isMultiCycle) {
    const cyclesCompleted = target.cyclesCompleted ?? 0;
    const totalCycles = target.totalCycles!;
    const overallPct = totalCycles > 0 ? Math.round((cyclesCompleted / totalCycles) * 100) : 0;
    const cyclePct = goal > 0 ? Math.round((current / goal) * 100) : 0;

    return (
      <div className="space-y-2">
        {/* Overall cycles */}
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex w-20 shrink-0 items-center gap-1.5 text-xs font-medium">
            <Layers className="h-3 w-3" />
            <span>Overall</span>
          </div>
          <Progress
            value={Math.min(100, overallPct)}
            className="h-2 min-w-0 flex-1"
            variant="default"
            aria-label={`Overall cycle progress: ${cyclesCompleted} of ${totalCycles} cycles (${overallPct}%)`}
          />
          <div className="text-muted-foreground w-36 shrink-0 text-right text-xs">
            {cyclesCompleted} / {totalCycles} cycles ({overallPct}%)
          </div>
        </div>
        {/* Current cycle */}
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex w-20 shrink-0 items-center gap-1.5 text-xs font-medium">
            <Target className="h-3 w-3" />
            <span>Current</span>
          </div>
          <Progress
            value={Math.min(100, cyclePct)}
            className="h-2 min-w-0 flex-1"
            variant="accent"
            aria-label={`Current cycle progress: ${current.toLocaleString()} of ${goal.toLocaleString()} (${cyclePct}%)`}
          />
          <div className="text-muted-foreground w-36 shrink-0 text-right text-xs">
            {current.toLocaleString()} / {goal.toLocaleString()} ({cyclePct}%)
          </div>
        </div>
      </div>
    );
  }

  // Single-cycle counter
  const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground flex w-20 shrink-0 items-center gap-1.5 text-xs font-medium">
        <Target className="h-3 w-3" />
        <span>Progress</span>
      </div>
      <Progress
        value={Math.min(100, pct)}
        className="h-2 min-w-0 flex-1"
        variant="default"
        aria-label={`Progress: ${current.toLocaleString()} of ${goal.toLocaleString()} (${pct}%)`}
      />
      <div className="text-muted-foreground w-36 shrink-0 text-right text-xs">
        {current.toLocaleString()} / {goal.toLocaleString()} ({pct}%)
      </div>
    </div>
  );
}

// ─── Completion ─────────────────────────────────────────────────────────────

function CompletionMetrics({ target }: { target: CustomerPromotionTarget }) {
  return (
    <p className="text-muted-foreground text-sm">
      Status: {target.achieved || target.status === "ACHIEVED" ? "Completed" : "Not Complete"}
    </p>
  );
}

// ─── Milestone ──────────────────────────────────────────────────────────────

function MilestoneMetrics({ target }: { target: CustomerPromotionTarget }) {
  const completed = target.milestoneIndex ?? 0;
  const total = target.totalMilestones ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-sm">
        {completed} of {total} milestones complete | Progress: {pct}%
      </p>
      <Progress
        value={Math.min(100, pct)}
        className="h-2"
        variant="default"
        aria-label={`Milestone progress: ${completed} of ${total} milestones (${pct}%)`}
      />
    </div>
  );
}

// ─── X of Y ─────────────────────────────────────────────────────────────────

function XOfYMetrics({ target }: { target: CustomerPromotionTarget }) {
  const completed = target.completedItemIds?.length ?? target.currentValue ?? 0;
  const needed = target.itemsNeeded ?? target.targetValue ?? 0;
  const pct = needed > 0 ? Math.round((completed / needed) * 100) : 0;

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-sm">
        {completed} of {needed} activities complete | Progress: {pct}%
      </p>
      <Progress
        value={Math.min(100, pct)}
        className="h-2"
        variant="default"
        aria-label={`Items progress: ${completed} of ${needed} activities (${pct}%)`}
      />
    </div>
  );
}
