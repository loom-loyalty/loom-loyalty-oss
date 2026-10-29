// Badge feature types.

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { Badge as BadgeEntity, CreateBadge, UpdateBadge } from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";
import type { LocalizedString } from "../../../forms/localized-string-input.js";

export type { LocalizedString };

/**
 * Form data for badge creation/editing.
 * Represents the shape of data submitted by the form.
 */
export interface BadgeFormData {
  name: string;
  code: string;
  description: LocalizedString;
  typeCode: string;
  rank?: number;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the BadgeFormSheet component.
 */
export interface BadgeFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: BadgeEntity;
  /** Submit handler */
  onSubmit: (data: CreateBadge | UpdateBadge) => Promise<void>;
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
 * Filter state for the badges list.
 */
export interface BadgeListFilters {
  search: string;
  typeFilter: string | null;
}

/**
 * Standard badge fields — base manifest shape + system-output fields.
 */
export const BADGE_STANDARD_FIELDS = [
  "name",
  "code",
  "typeCode",
  "description",
  "badgeId",
  "rank",
  "programIds",
  "durationPeriod",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * User-editable base fields rendered in BadgeFormSheet.
 * Excludes output-only system fields (badgeId, createdDateTime, modifiedDateTime).
 */
export const BADGE_EDITABLE_FIELDS = new Set([
  "name",
  "code",
  "typeCode",
  "description",
  "rank",
  "programIds",
  "durationPeriod",
] as const);
