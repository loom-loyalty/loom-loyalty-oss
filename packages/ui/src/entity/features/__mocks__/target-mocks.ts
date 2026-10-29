/**
 * Mock Target data for testing and Storybook stories.
 *
 * Uses the SDK Target types and UI-specific TargetProgress type.
 */

import type {
  CompletionTarget,
  CounterTarget,
  Metadata,
  MilestoneTarget,
  ResponseTargetData,
  XOfYTarget,
} from "@loom-loyalty/sdk";
import type { TargetProgress } from "../target-cards/types";

// ============================================================
// COMPLETION TARGETS
// ============================================================

export const mockCompletionTarget: CompletionTarget = {
  type: "COMPLETION",
  targetId: "targ_abc123def456ghi789jkl012mno1",
  code: "first-purchase",
  name: "First Purchase",
  description: { en: "Complete your first purchase" },
  programIds: ["prog-001"],
  scope: "GLOBAL",
  completionTargetType: {
    typeCode: "completion-type",
    code: "first-purchase-type",
    name: "First Purchase Type",
  } as Metadata,
  createdDateTime: "2024-01-01T00:00:00Z",
  modifiedDateTime: "2024-06-15T10:30:00Z",
};

export const mockCompletionProgress: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno1",
  customerId: "cust_123",
  status: "achieved",
  isComplete: true,
  completedDateTime: "2024-06-20T14:30:00Z",
};

export const mockCompletionProgressNotStarted: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno1",
  customerId: "cust_456",
  status: "not_started",
  isComplete: false,
};

// ============================================================
// COUNTER TARGETS
// ============================================================

export const mockCounterTarget: CounterTarget = {
  type: "COUNTER",
  targetId: "targ_abc123def456ghi789jkl012mno2",
  code: "spend-500",
  name: "Spend $500",
  description: { en: "Spend $500 to earn bonus points" },
  programIds: ["prog-001"],
  scope: "GLOBAL",
  targetValue: 500,
  counterTargetType: {
    typeCode: "counter-type",
    code: "spend-type",
    name: "Spend Target Type",
  } as Metadata,
  numberOfCycles: 4,
  numberOfCyclesToAchieve: 3,
  durationPeriod: {
    durationPeriodType: "SLIDING",
    durationPeriod: "MONTHS",
    durationPeriodValue: 3,
  },
  createdDateTime: "2024-01-01T00:00:00Z",
  modifiedDateTime: "2024-06-15T10:30:00Z",
};

export const mockCounterProgress: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno2",
  customerId: "cust_123",
  status: "in_progress",
  currentValue: 350,
  targetValue: 500,
  cyclesCompleted: 2,
  totalCycles: 4,
};

export const mockCounterProgressComplete: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno2",
  customerId: "cust_789",
  status: "achieved",
  currentValue: 500,
  targetValue: 500,
  cyclesCompleted: 4,
  totalCycles: 4,
  completedDateTime: "2024-06-25T09:00:00Z",
};

export const mockCounterProgressZero: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno2",
  customerId: "cust_101",
  status: "not_started",
  currentValue: 0,
  targetValue: 500,
  cyclesCompleted: 0,
  totalCycles: 4,
};

// ============================================================
// MILESTONE TARGETS
// ============================================================

export const mockMilestoneTarget: MilestoneTarget = {
  type: "MILESTONE",
  targetId: "targ_abc123def456ghi789jkl012mno3",
  code: "loyalty-journey",
  name: "Loyalty Journey",
  description: { en: "Progress through 5 milestones to unlock rewards" },
  programIds: ["prog-001"],
  scope: "GLOBAL",
  milestoneTargetType: {
    typeCode: "milestone-type",
    code: "journey-type",
    name: "Journey Milestone Type",
  } as Metadata,
  items: [
    { targetId: "targ_milestone1_00000000000000001", order: 1 },
    { targetId: "targ_milestone2_00000000000000002", order: 2 },
    { targetId: "targ_milestone3_00000000000000003", order: 3 },
    { targetId: "targ_milestone4_00000000000000004", order: 4 },
    { targetId: "targ_milestone5_00000000000000005", order: 5 },
  ],
  createdDateTime: "2024-01-01T00:00:00Z",
  modifiedDateTime: "2024-06-15T10:30:00Z",
};

export const mockMilestoneProgress: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno3",
  customerId: "cust_123",
  status: "in_progress",
  currentMilestoneIndex: 2,
  totalMilestones: 5,
  completedMilestoneIds: ["targ_milestone1_00000000000000001", "targ_milestone2_00000000000000002"],
  currentMilestoneName: "Regular",
};

export const mockMilestoneProgressComplete: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno3",
  customerId: "cust_789",
  status: "achieved",
  currentMilestoneIndex: 5,
  totalMilestones: 5,
  completedMilestoneIds: [
    "targ_milestone1_00000000000000001",
    "targ_milestone2_00000000000000002",
    "targ_milestone3_00000000000000003",
    "targ_milestone4_00000000000000004",
    "targ_milestone5_00000000000000005",
  ],
  completedDateTime: "2024-06-30T16:00:00Z",
};

export const mockMilestoneProgressNotStarted: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno3",
  customerId: "cust_101",
  status: "not_started",
  currentMilestoneIndex: 0,
  totalMilestones: 5,
  completedMilestoneIds: [],
};

// ============================================================
// X OF Y TARGETS
// ============================================================

export const mockXOfYTarget: XOfYTarget = {
  type: "X_OF_Y",
  targetId: "targ_abc123def456ghi789jkl012mno4",
  code: "try-3-products",
  name: "Product Explorer",
  description: { en: "Try 3 out of 5 featured products" },
  programIds: ["prog-001"],
  scope: "GLOBAL",
  xofYTargetType: {
    typeCode: "xofy-type",
    code: "product-explorer-type",
    name: "Product Explorer Type",
  } as Metadata,
  items: ["product-a", "product-b", "product-c", "product-d", "product-e"],
  targetValue: 3,
  createdDateTime: "2024-01-01T00:00:00Z",
  modifiedDateTime: "2024-06-15T10:30:00Z",
};

export const mockXOfYProgress: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno4",
  customerId: "cust_123",
  status: "in_progress",
  completedItemIds: ["product-a", "product-c"],
  totalItems: 5,
  itemsNeeded: 3,
};

export const mockXOfYProgressComplete: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno4",
  customerId: "cust_789",
  status: "achieved",
  completedItemIds: ["product-a", "product-b", "product-c"],
  totalItems: 5,
  itemsNeeded: 3,
  completedDateTime: "2024-07-01T11:30:00Z",
};

export const mockXOfYProgressNotStarted: TargetProgress = {
  targetId: "targ_abc123def456ghi789jkl012mno4",
  customerId: "cust_101",
  status: "not_started",
  completedItemIds: [],
  totalItems: 5,
  itemsNeeded: 3,
};

// ============================================================
// COLLECTIONS
// ============================================================

/**
 * All mock targets as ResponseTargetData union
 */
export const mockAllTargets: ResponseTargetData[] = [
  mockCompletionTarget,
  mockCounterTarget,
  mockMilestoneTarget,
  mockXOfYTarget,
];

/**
 * All mock progress records
 */
export const mockAllProgress: TargetProgress[] = [
  mockCompletionProgress,
  mockCounterProgress,
  mockMilestoneProgress,
  mockXOfYProgress,
];

/**
 * Empty targets array for testing empty state
 */
export const mockEmptyTargets: ResponseTargetData[] = [];
