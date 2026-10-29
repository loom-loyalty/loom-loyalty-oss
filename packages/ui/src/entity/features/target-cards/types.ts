/**
 * Target Card Types
 *
 * These types represent target card configuration and customer progress on targets.
 * Progress data comes from the customer-target endpoint, separate from the target configuration.
 * These are UI-specific types not present in the SDK.
 */
import type { ReactNode } from "react";

/**
 * A looser alternative to the SDK's ResponseTargetData.
 * Consumers can pass either SDK target objects or plain objects matching this shape.
 */
export interface TargetCardInput {
  type: "COMPLETION" | "COUNTER" | "MILESTONE" | "X_OF_Y";
  targetId?: string;
  code: string;
  name: string;
  programIds?: string[];
  scope?: string;
  description?: Record<string, string>;
  targetValue?: number;
  numberOfCycles?: number;
  items?: unknown[];
}

/**
 * Status of a customer's progress on a target
 */
export type TargetProgressStatus =
  | "not_started"
  | "in_progress"
  | "achieved"
  | "expired"
  | "cancelled";

/**
 * Customer's progress on a target.
 * This type is used across all target card components to show progress visualization.
 */
export interface TargetProgress {
  /** The target this progress is for */
  targetId: string;
  /** The customer this progress belongs to */
  customerId: string;
  /** Current status of the target progress */
  status: TargetProgressStatus;

  // ========== Completion progress ==========
  /** Whether the target is complete (for COMPLETION type) */
  isComplete?: boolean;
  /** When the target was completed */
  completedDateTime?: string;

  // ========== Counter progress ==========
  /** Current numeric value achieved (for COUNTER type) */
  currentValue?: number;
  /** Target value to achieve */
  targetValue?: number;
  /** Number of cycles completed (for cyclic counters) */
  cyclesCompleted?: number;
  /** Total number of cycles */
  totalCycles?: number;

  // ========== Milestone progress ==========
  /** Index of the current milestone (0-based) */
  currentMilestoneIndex?: number;
  /** Total number of milestones */
  totalMilestones?: number;
  /** IDs of completed milestones */
  completedMilestoneIds?: string[];
  /** Current milestone name (for display) */
  currentMilestoneName?: string;

  // ========== X of Y progress ==========
  /** IDs of completed items */
  completedItemIds?: string[];
  /** Total number of items (Y) */
  totalItems?: number;
  /** Number needed to achieve (X) */
  itemsNeeded?: number;

  // ========== Common metadata ==========
  /** When progress was started */
  startedDateTime?: string;
  /** When progress was last updated */
  lastUpdatedDateTime?: string;
  /** When the target expires for this customer */
  expiresDateTime?: string;
}

/**
 * Get the Tailwind classes for a target status badge.
 */
export function getStatusBadgeClasses(status: TargetProgressStatus): string {
  switch (status) {
    case "achieved":
      return "bg-success/10 text-success-dark";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    case "expired":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Calculate progress percentage for any target type
 */
export function calculateProgressPercentage(progress: TargetProgress): number {
  if (progress.status === "achieved") return 100;
  if (progress.status === "not_started" || progress.status === "cancelled") return 0;

  // Counter progress
  if (progress.currentValue !== undefined && progress.targetValue !== undefined) {
    if (progress.targetValue === 0) return 0;
    return Math.min(100, Math.round((progress.currentValue / progress.targetValue) * 100));
  }

  // Milestone progress
  if (progress.currentMilestoneIndex !== undefined && progress.totalMilestones !== undefined) {
    if (progress.totalMilestones === 0) return 0;
    return Math.round((progress.currentMilestoneIndex / progress.totalMilestones) * 100);
  }

  // X of Y progress
  if (progress.completedItemIds !== undefined && progress.itemsNeeded !== undefined) {
    if (progress.itemsNeeded === 0) return 0;
    return Math.min(
      100,
      Math.round((progress.completedItemIds.length / progress.itemsNeeded) * 100)
    );
  }

  return 0;
}

/**
 * Get a human-readable status label
 */
export function getStatusLabel(status: TargetProgressStatus): string {
  switch (status) {
    case "not_started":
      return "Not Started";
    case "in_progress":
      return "In Progress";
    case "achieved":
      return "Achieved";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

/**
 * Props for the EntityTargetCard discriminator component.
 * Routes to the correct target card subtype based on target type.
 */
export interface EntityTargetCardProps {
  /** The target configuration */
  target: TargetCardInput;
  /** Customer's progress on this target (optional) */
  progress?: TargetProgress;
  /** Callback when the card is clicked */
  onClick?: () => void;
  /** Callback when celebration animation completes (for completion targets) */
  onCelebrate?: () => void;
  /** Visual variant */
  variant?: "default" | "compact";
  /** Extension point for custom rendering */
  renderCard?: (
    target: TargetCardInput,
    progress: TargetProgress | undefined,
    defaultRender: ReactNode
  ) => ReactNode;
  /** Additional className */
  className?: string;
}
