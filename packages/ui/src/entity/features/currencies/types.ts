/**
 * Currency Feature Types
 *
 * Centralized type definitions for the currencies feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type {
  CreateProgramCurrency,
  ProgramCurrency,
  UpdateProgramCurrency,
} from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 * Used for multi-language descriptions.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for currency creation/editing.
 * Represents the shape of data submitted by the form.
 */
export interface CurrencyFormData {
  name: string;
  code: string;
  description: LocalizedString;
  currencyTypeCode: string;
  programIds: string[];
  pendingRuleId?: string;
  expiryRuleId?: string;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Currency form data type — SDK create/update types extended with
 * arbitrary additional fields from data model extensions.
 */
export type CurrencyFormPayload =
  | (CreateProgramCurrency & Record<string, unknown>)
  | (UpdateProgramCurrency & Record<string, unknown>);

/**
 * Props for the CurrencyFormSheet component.
 */
export interface CurrencyFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: ProgramCurrency;
  /** Submit handler — payload includes SDK fields plus any extended fields */
  onSubmit: (data: CurrencyFormPayload) => Promise<void>;
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
  /** Callback to create an expiry rule inline (replaces useCreateEntity) */
  onCreateExpiryRule?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Callback to create a program inline (replaces useCreateEntity) */
  onCreateProgram?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * Filter state for the currencies list.
 */
export interface CurrencyListFilters {
  search: string;
  typeFilter: string | null;
}

/**
 * Standard currency fields - these have rich UI components
 */
export const CURRENCY_STANDARD_FIELDS = [
  "name",
  "code",
  "currencyTypeCode",
  "description",
  "programCurrencyId",
  "currencyType",
  "programIds",
  "pendingRule",
  "expiryRule",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;
