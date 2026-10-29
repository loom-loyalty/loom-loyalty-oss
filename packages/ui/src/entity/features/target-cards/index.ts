/**
 * Target Card Components
 *
 * Specialized card components for displaying target progress.
 * Supports four target types: Completion, Counter, Milestone, and X of Y.
 */

export {
  calculateProgressPercentage,
  getStatusBadgeClasses,
  getStatusLabel,
  type EntityTargetCardProps,
  type TargetCardInput,
  type TargetProgress,
  type TargetProgressStatus,
} from "./types";

export { CompletionTargetCard, type CompletionTargetCardProps } from "./completion-target-card";

export { CounterTargetCard, type CounterTargetCardProps } from "./counter-target-card";

export { MilestoneTargetCard, type MilestoneTargetCardProps } from "./milestone-target-card";

export { XOfYTargetCard, type XOfYTargetCardProps } from "./x-of-y-target-card";

export { EntityTargetCard } from "./entity-target-card";
