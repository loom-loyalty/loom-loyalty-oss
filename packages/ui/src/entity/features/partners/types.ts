/**
 * Partner Feature Types
 *
 * Centralized type definitions for the partners feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { CreatePartner, Partner, UpdatePartner } from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 * Used for multi-language descriptions.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for partner creation/editing.
 * Represents the shape of data submitted by the form.
 */
export interface PartnerFormData {
  name: string;
  code: string;
  description: LocalizedString;
  typeCode: string;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the PartnerFormSheet component.
 */
export interface PartnerFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: Partner;
  /** Submit handler */
  onSubmit: (data: CreatePartner | UpdatePartner) => Promise<void>;
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
 * Filter state for the partners list.
 */
export interface PartnerListFilters {
  search: string;
  typeFilter: string | null;
}

/**
 * Standard partner fields - these have rich UI components
 */
export const PARTNER_STANDARD_FIELDS = [
  "name",
  "code",
  "typeCode",
  "description",
  "partnerId",
  "type",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;

export const PARTNER_EDITABLE_FIELDS = ["name", "code", "typeCode", "description"] as const;
