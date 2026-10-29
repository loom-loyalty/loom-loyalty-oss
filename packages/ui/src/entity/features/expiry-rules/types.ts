/**
 * Expiry Rules Feature Types
 *
 * Centralized type definitions for the expiry rules feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type {
  CreateExpiryRule,
  ExpiryRule,
  ExpiryRuleExpiryPeriod,
  ExpiryRuleType,
  UpdateExpiryRule,
} from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for expiry rule creation/editing.
 */
export interface ExpiryRuleFormData {
  name: string;
  code: string;
  description: LocalizedString;
  programIds: string[];
  type: ExpiryRuleType | "";
  expiryPeriod?: ExpiryRuleExpiryPeriod | "";
  expiryPeriodValue?: number;
  expiryDate?: string;
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the ExpiryRuleFormSheet component.
 */
export interface ExpiryRuleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: ExpiryRule;
  onSubmit: (data: CreateExpiryRule | UpdateExpiryRule) => Promise<void>;
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  schema?: UIEntitySchema;
  extendedFields?: string[];
}

/**
 * Standard expiry rule fields - these have rich UI components
 */
export const EXPIRY_RULE_STANDARD_FIELDS = [
  "name",
  "code",
  "type",
  "description",
  "expiryRuleId",
  "programIds",
  "expiryPeriod",
  "expiryPeriodValue",
  "expiryDate",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * Filter state for the expiry rules list.
 */
export interface ExpiryRuleListFilters {
  search: string;
  typeFilter: string | null;
}

/**
 * Expiry rule type display options.
 */
export const EXPIRY_TYPE_OPTIONS = [
  { value: "FIXED_DATE", label: "Fixed Date" },
  { value: "FIXED_PERIOD", label: "Fixed Period" },
  { value: "ROLLING_PERIOD", label: "Rolling Period" },
] as const;

/**
 * Expiry period unit options.
 */
export const EXPIRY_PERIOD_OPTIONS = [
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "MONTHS", label: "Months" },
  { value: "YEARS", label: "Years" },
] as const;

/**
 * Human-readable labels for expiry types.
 */
export const EXPIRY_TYPE_LABELS: Record<string, string> = {
  FIXED_DATE: "Fixed Date",
  FIXED_PERIOD: "Fixed Period",
  ROLLING_PERIOD: "Rolling Period",
};

/**
 * Human-readable labels for expiry periods (lowercase for inline display).
 */
export const EXPIRY_PERIOD_LABELS: Record<string, string> = {
  DAYS: "days",
  WEEKS: "weeks",
  MONTHS: "months",
  YEARS: "years",
};
