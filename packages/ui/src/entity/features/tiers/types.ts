/**
 * Tier Feature Types
 *
 * Centralized type definitions for the tiers feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { CreateTier, Tier, UpdateTier } from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 * Used for multi-language descriptions.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for tier creation/editing.
 * Represents the shape of data submitted by the form.
 */
export interface TierFormData {
  name: string;
  code: string;
  description: LocalizedString;
  rank: number;
  programIds: string[];
  subscription: boolean;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the TierFormSheet component.
 */
export interface TierFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: Tier;
  /** Submit handler */
  onSubmit: (data: CreateTier | UpdateTier) => Promise<void>;
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
 * Filter state for the tiers list.
 */
export interface TierListFilters {
  search: string;
}

/**
 * Standard tier fields - these have rich UI components
 */
export const TIER_STANDARD_FIELDS = [
  "name",
  "code",
  "description",
  "rank",
  "programIds",
  "durationPeriod",
  "subscription",
  "tierExpiryDowngradeTierId",
  "tierExpiryDowngradeDurationPeriod",
  "createdDateTime",
  "modifiedDateTime",
] as const;
