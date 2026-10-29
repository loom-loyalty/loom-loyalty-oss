/**
 * Promotion Rule Types
 *
 * Hierarchical types for the Promotions panel: event rules are the
 * primary entity with targets nested as children.
 */

// ─── Target Status ──────────────────────────────────────────────────────────

export type PromotionTargetStatus =
  | "NOT_REGISTERED"
  | "IN_PROGRESS"
  | "ACHIEVED"
  | "EXPIRED"
  | "CANCELLED";

// ─── Target Types ───────────────────────────────────────────────────────────

export type PromotionTargetType = "COMPLETION" | "COUNTER" | "MILESTONE" | "X_OF_Y";

// ─── Promotion Target ───────────────────────────────────────────────────────

/** Counter target cycle with contributing events. */
export interface PromotionTargetCycle {
  cycleId: string;
  cycleNumber: number;
  currentValue: number;
  targetValue: number;
  achieved: boolean;
  achievedDateTime?: string;
  startDateTime?: string;
  endDateTime?: string;
  /** Events that contributed to this cycle */
  details?: PromotionTargetEventDetail[];
}

/** An event that contributed to target progress. */
export interface PromotionTargetEventDetail {
  eventId: string;
  eventDateTime: string;
  value?: number;
  description?: string;
}

/** Milestone/X-of-Y item with achievement state. */
export interface PromotionTargetItem {
  itemId: string;
  targetId: string;
  targetName: string;
  targetCode: string;
  achieved: boolean;
  achievedDateTime?: string;
}

/** Promotion target with progress data. */
export interface CustomerPromotionTarget {
  entityTargetId: string;
  targetId: string;
  targetName: string;
  targetCode: string;
  targetType: PromotionTargetType;
  status: PromotionTargetStatus;
  // Progress fields
  currentValue?: number;
  targetValue?: number;
  cyclesCompleted?: number;
  totalCycles?: number;
  completedItemIds?: string[];
  totalItems?: number;
  itemsNeeded?: number;
  milestoneIndex?: number;
  totalMilestones?: number;
  /** Whether target is achieved (completion targets) */
  achieved?: boolean;
  // Event links
  registeredEventId?: string;
  achievedEventId?: string;
  cancelledEventId?: string;
  // Dates
  startDateTime?: string;
  endDateTime?: string;
  achievedDateTime?: string;
  /** Counter target cycles (counter type only) */
  cycles?: PromotionTargetCycle[];
  /** Milestone steps or X-of-Y items */
  items?: PromotionTargetItem[];
  /** Number of cycles configured */
  numberOfCycles?: number;
  /** Number of cycles required to achieve */
  numberOfCyclesToAchieve?: number;
  /** Whether cycles must be consecutive */
  cycleMustBeConsecutive?: boolean;
  /** Whether value carries over between cycles */
  carryOverToNextCycle?: boolean;
}

// ─── Promotion Rule ─────────────────────────────────────────────────────────

/** Entity event rule with nested target data for the Promotions panel. */
export interface CustomerPromotionRule {
  eventRuleId: string;
  eventRuleName: string;
  eventRuleCode: string;
  category: string;
  description?: string;
  eventTypeCode: string;
  eventTypeName?: string;
  /** The main promotion target (null = not yet registered for this customer) */
  promotionTarget: CustomerPromotionTarget | null;
  /** Sub-targets that fire on each occurrence */
  occurrenceTargets: CustomerPromotionTarget[];
  /** Targets tracking currency issuance */
  currencyTargets: CustomerPromotionTarget[];
  /** Human-readable action summaries (e.g., "Issue 10 Points per $1") */
  actionSummaries: string[];
}

// ─── Status Filter ──────────────────────────────────────────────────────────

export type PromotionStatusFilter =
  | "ALL"
  | "NOT_REGISTERED"
  | "IN_PROGRESS"
  | "ACHIEVED"
  | "CANCELLED"
  | "EXPIRED";
