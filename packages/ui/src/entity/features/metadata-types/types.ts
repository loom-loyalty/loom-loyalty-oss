/**
 * Metadata Type Feature Types
 *
 * Centralized type definitions for the metadata types feature.
 */

import type { CreateMetadataType, MetadataType, UpdateMetadataType } from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Form data for metadata type creation/editing.
 */
export interface MetadataTypeFormData {
  name: string;
  code: string;
  category: string;
  description: Record<string, string>;
  searchable: boolean;
}

/**
 * Props for the MetadataTypeFormSheet component.
 */
export interface MetadataTypeFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing */
  initialData?: MetadataType;
  /** Submit handler */
  onSubmit: (data: CreateMetadataType | UpdateMetadataType) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/**
 * Filter state for the metadata types list.
 */
export interface MetadataTypeListFilters {
  search: string;
  category: string;
}

/**
 * Standard metadata type fields
 */
export const METADATA_TYPE_STANDARD_FIELDS = [
  "name",
  "code",
  "description",
  "category",
  "searchable",
  "children",
  "parents",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * Category options for metadata types
 */
export const METADATA_TYPE_CATEGORY_OPTIONS = [
  { value: "METADATA", label: "Metadata" },
  { value: "LOCATION", label: "Location" },
  { value: "ITEM", label: "Item" },
  { value: "DATA_TYPE", label: "Data Type" },
] as const;

/**
 * Category display labels
 */
export const METADATA_TYPE_CATEGORY_LABELS: Record<string, string> = {
  METADATA: "Metadata",
  LOCATION: "Location",
  ITEM: "Item",
  DATA_TYPE: "Data Type",
};
