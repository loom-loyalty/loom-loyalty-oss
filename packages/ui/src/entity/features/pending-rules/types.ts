/**
 * Pending Rules Feature Types
 *
 * Centralized type definitions for the pending-rules feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type {
  CreatePendingRule,
  PendingRule,
  PendingRulePendingPeriod,
  PendingRuleType,
  UpdatePendingRule,
} from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 * Used for multi-language descriptions.
 */
export type LocalizedString = Record<string, string>;

/**
 * Re-export SDK enum values for use in form components
 */
export { PendingRulePendingPeriod, PendingRuleType } from "@loom-loyalty/sdk";

/**
 * Form data for pending rule creation/editing.
 */
export interface PendingRuleFormData {
  name: string;
  code: string;
  description: LocalizedString;
  programIds: string[];
  type: PendingRuleType | "";
  pendingPeriod?: PendingRulePendingPeriod | "";
  pendingPeriodValue?: number;
  pendingDate?: string;
  extendedFields?: Record<string, unknown>;
}

/**
 * Pending rule type display options.
 */
export const PENDING_TYPE_OPTIONS = [
  { value: "FIXED_DATE", label: "Fixed Date" },
  { value: "FIXED_PERIOD", label: "Fixed Period" },
  { value: "ROLLING_PERIOD", label: "Rolling Period" },
  { value: "MANUAL", label: "Manual" },
  { value: "PENDING_ON_ITEM", label: "Pending on Item" },
] as const;

/**
 * Pending period unit options.
 */
export const PENDING_PERIOD_OPTIONS = [
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "MONTHS", label: "Months" },
  { value: "YEARS", label: "Years" },
] as const;

/**
 * Human-readable labels for PendingRuleType
 */
export const PENDING_RULE_TYPE_LABELS: Record<string, string> = {
  FIXED_DATE: "Fixed Date",
  FIXED_PERIOD: "Fixed Period",
  ROLLING_PERIOD: "Rolling Period",
  MANUAL: "Manual",
  PENDING_ON_ITEM: "Pending on Item",
};

/**
 * Human-readable descriptions for PendingRuleType
 */
export const PENDING_RULE_TYPE_DESCRIPTIONS: Record<string, string> = {
  FIXED_DATE: "Points pend until a specific date",
  FIXED_PERIOD: "Points pend for a fixed time period",
  ROLLING_PERIOD: "Points pend for a rolling time period from acquisition",
  MANUAL: "Points require manual approval",
  PENDING_ON_ITEM: "Points pend based on item status",
};

/**
 * Human-readable labels for pending periods (lowercase for inline display).
 */
export const PENDING_PERIOD_LABELS: Record<string, string> = {
  DAYS: "days",
  WEEKS: "weeks",
  MONTHS: "months",
  YEARS: "years",
};

/**
 * Props for the PendingRuleFormSheet component.
 */
export interface PendingRuleFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: PendingRule;
  /** Submit handler */
  onSubmit: (data: CreatePendingRule | UpdatePendingRule) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /** Schema for rendering extended fields (optional) */
  schema?: UIEntitySchema;
  /** Extended field names to render (beyond standard fields) */
  extendedFields?: string[];
}

/**
 * Filter state for the pending rules list.
 */
export interface PendingRuleListFilters {
  search: string;
  typeFilter: string | null;
}

/**
 * Standard pending rule fields - these have rich UI components
 */
export const PENDING_RULE_STANDARD_FIELDS = [
  "name",
  "code",
  "description",
  "pendingRuleId",
  "type",
  "programIds",
  "pendingPeriod",
  "pendingPeriodValue",
  "pendingDate",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;
