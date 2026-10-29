/**
 * Metadata Group Feature Types
 *
 * Centralized type definitions for the metadata-groups feature.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { CreateMetadataGroup, MetadataGroup, UpdateMetadataGroup } from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for metadata group creation/editing.
 */
export interface MetadataGroupFormData {
  name: string;
  code: string;
  description: LocalizedString;
  typeCode: string;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the MetadataGroupFormSheet component.
 */
export interface MetadataGroupFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: MetadataGroup;
  /** Submit handler */
  onSubmit: (data: CreateMetadataGroup | UpdateMetadataGroup) => Promise<void>;
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
  /** Type supplied by the caller when create mode must not offer a choice. */
  lockedTypeCode?: string;
  /** Context shown above the form fields, such as the membership being added. */
  summary?: string;
}

/**
 * Filter state for the metadata groups list.
 */
export interface MetadataGroupListFilters {
  search: string;
  typeFilter: string | null;
}

/**
 * Standard metadata group fields - these have rich UI components
 */
export const METADATA_GROUP_STANDARD_FIELDS = [
  "name",
  "code",
  "typeCode",
  "description",
  "metadataGroupId",
  "dateTimePeriod",
  "createdDateTime",
  "modifiedDateTime",
] as const;
