/**
 * Program Feature Types
 *
 * Centralized type definitions for the programs feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { CodeGenInformation, CreateProgram, Program, UpdateProgram } from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 * Used for multi-language descriptions.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for program creation/editing.
 * Represents the shape of data submitted by the form.
 */
export interface ProgramFormData {
  name: string;
  code: string;
  description: LocalizedString;
  typeCode: string;
  /** Primary partner associated with this program */
  partnerId?: string;
  createAccountOnCustomerCreation: boolean;
  programAccountIdInformation?: CodeGenInformation;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the ProgramFormSheet component.
 */
export interface ProgramFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: Program;
  /** Submit handler */
  onSubmit: (data: CreateProgram | UpdateProgram) => Promise<void>;
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
 * Standard program fields - these have rich UI components
 */
export const PROGRAM_STANDARD_FIELDS = [
  "name",
  "code",
  "typeCode",
  "description",
  "programId",
  "type",
  "partner",
  "createAccountOnCustomerCreation",
  "programAccountIdInformation",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * Filter state for the programs list.
 */
export interface ProgramListFilters {
  search: string;
  typeFilter: string | null;
  partnerFilter: string | null;
}
