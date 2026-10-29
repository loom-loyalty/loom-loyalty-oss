/**
 * Target Feature Types
 *
 * Centralized type definitions for the targets feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { CreateTarget, ResponseTargetData } from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for target creation/editing.
 * Uses a flat structure with conditional fields based on target type.
 */
export interface TargetFormData {
  name: string;
  code: string;
  description: LocalizedString;
  programIds: string[];
  type: string;
  scope: string;

  // Completion-specific
  completionTargetTypeCode: string;

  // Counter-specific
  counterTargetTypeCode: string;
  targetValue?: number;
  cappingTarget: boolean;
  numberOfCycles?: number;
  numberOfCyclesToAchieve?: number;
  cyclesMustBeConsecutive: boolean;
  carryOverToNextCycle: boolean;
  growthTargetOperator: string;
  growthTargetOperand?: number;
  growthTargetAlgorithm: string;

  // Milestone-specific
  milestoneTargetTypeCode: string;
  milestoneItems: Array<{ targetId: string; order: number }>;

  // X of Y-specific
  xofYTargetTypeCode: string;
  xofYTargetValue?: number;
  xofYItemTargetIds: string[];

  // Extended
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the TargetFormSheet component.
 */
export interface TargetFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: ResponseTargetData;
  onSubmit: (data: CreateTarget) => Promise<void>;
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  schema?: UIEntitySchema;
  extendedFields?: string[];
  /** All targets for sub-target resolution in milestone/xofy pickers */
  allTargets?: ResponseTargetData[];
  /** Whether all targets are still loading for milestone/xofy pickers */
  allTargetsLoading?: boolean;
  /** Whether loading all targets failed before milestone/xofy pickers received every target */
  allTargetsError?: boolean;
  /**
   * Keep the code from `initialData` in create mode, for a target something
   * else already refers to by code (a drafted rule's addCounterData).
   */
  lockCode?: boolean;
}

/**
 * Standard target fields - these have rich UI components
 */
export const TARGET_STANDARD_FIELDS = [
  "name",
  "code",
  "type",
  "description",
  "targetId",
  "programIds",
  "scope",
  "durationPeriod",
  "completionTargetType",
  "completionTargetTypeCode",
  "counterTargetType",
  "counterTargetTypeCode",
  "targetValue",
  "cappingTarget",
  "numberOfCycles",
  "numberOfCyclesToAchieve",
  "cyclesMustBeConsecutive",
  "cycleDurationPeriod",
  "carryOverToNextCycle",
  "growthTargetOperator",
  "growthTargetOperand",
  "growthTargetAlgorithm",
  "milestoneTargetType",
  "milestoneTargetTypeCode",
  "items",
  "xofYTargetType",
  "xofYTargetTypeCode",
  "itemTargetIds",
  "enabledInEnvironments",
  "requiresRegistration",
  "retroAfterRegistration",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * Filter state for the targets list.
 */
export interface TargetListFilters {
  search: string;
  typeFilter: string | null;
  scopeFilter: string | null;
}

/**
 * Target type options for select dropdowns and filters.
 */
export const TARGET_TYPE_OPTIONS = [
  { value: "COMPLETION", label: "Completion" },
  { value: "COUNTER", label: "Counter" },
  { value: "MILESTONE", label: "Milestone" },
  { value: "X_OF_Y", label: "X of Y" },
] as const;

/**
 * Human-readable labels for target types.
 */
export const TARGET_TYPE_LABELS: Record<string, string> = {
  COMPLETION: "Completion",
  COUNTER: "Counter",
  MILESTONE: "Milestone",
  X_OF_Y: "X of Y",
};

/**
 * Target scope options for select dropdowns and filters.
 */
export const TARGET_SCOPE_OPTIONS = [
  { value: "GLOBAL", label: "Global" },
  { value: "PROGRAM", label: "Program" },
  { value: "RULE", label: "Rule" },
  { value: "EVENT", label: "Event" },
] as const;

/**
 * Human-readable labels for target scopes.
 */
export const TARGET_SCOPE_LABELS: Record<string, string> = {
  GLOBAL: "Global",
  PROGRAM: "Program",
  RULE: "Rule",
  EVENT: "Event",
};

/**
 * Growth target operator options.
 */
export const GROWTH_OPERATOR_OPTIONS = [
  { value: "ADD", label: "Add" },
  { value: "SUBTRACT", label: "Subtract" },
  { value: "MULTIPLY", label: "Multiply" },
  { value: "DIVIDE", label: "Divide" },
] as const;

/**
 * Growth target algorithm options.
 */
export const GROWTH_ALGORITHM_OPTIONS = [
  { value: "MIN_LAST_CYCLE", label: "Minimum of Last Cycle" },
] as const;
