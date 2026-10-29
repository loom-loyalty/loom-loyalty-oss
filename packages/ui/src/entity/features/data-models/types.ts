/**
 * Data Model Feature Types
 *
 * Centralized type definitions for data model types, data models, and elements.
 */

import type {
  CreateDataModel,
  CreateDataModelElement,
  CreateDataModelType,
  DataModel,
  DataModelElement,
  DataModelType,
  UpdateDataModel,
  UpdateDataModelType,
} from "@loom-loyalty/sdk";

import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";
import type { DataModelElementOperations } from "./element-changes.js";

/**
 * Lifecycle status of a DataModel version.
 *
 * Backend enum values (from VersionStatus.java):
 * - DRAFT (D): Editable, not yet published
 * - PUBLISHED (P): Immutable, in use by entities
 * - PAUSED (S): Temporarily disabled
 * - ARCHIVED (A): Retired
 *
 * The SDK types `versionStatus` as plain `string` because the OpenAPI spec
 * doesn't declare an enum constraint. This local union narrows it for UI use.
 */
export type DataModelVersionStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";

/**
 * Form data shape for editing a DataModelElement in the element sub-dialog.
 *
 * Mirrors the API's CreateUpdateDataModelElementData but uses optional fields
 * for form-only state. The form sheet collects these and converts to the API
 * payload on submit.
 */
export interface DataModelElementFormData {
  /**
   * Client-side stable identifier used as a React `key` in editable element lists.
   *
   * The server's DataModelElement has no unique id — only `name` and optional
   * `inputAttribute`. Those can collide (two rows both named "Email" before the
   * user fills in attributes, or a bulk-import paste with duplicate names), and
   * collisions produce mis-keyed rows that leak edit state between them.
   *
   * Assigned once at the moment an element enters form state (load, add,
   * bulk import) and preserved across edits. Stripped by `formDataToElement`
   * since it's never part of the API payload.
   */
  _rowKey?: string;
  /**
   * Server id of an element loaded from an existing model. Absent on elements
   * added in the form; the edit flow uses it to route per-element PUT/DELETE.
   */
  dataModelElementId?: string;
  /**
   * Platform-managed element (e.g. `code`, `createdDateTime` on a system model).
   * Rendered read-only: the platform refuses to update or delete it.
   */
  system?: boolean;
  /** Display name for the element (e.g., "Email Address") */
  name: string;
  /** Attribute name for input (e.g., "emailAddress"). Auto-generated from name. */
  inputAttribute?: string;
  /** Attribute name for output. Defaults to inputAttribute. */
  outputAttribute?: string;
  /** Type code reference (e.g., "STRING", "CUSTOMER") */
  typeCode: string;
  /** Whether this is an array/list */
  isArray?: boolean;
  /** Required field */
  required?: boolean;
  /** Sensitive data (PII, credentials, etc.) */
  sensitive?: boolean;
  /** Only used for input operations */
  inputOnly?: boolean;
  /** Only used for output operations */
  outputOnly?: boolean;
  /** Only settable on create, not update */
  createOnly?: boolean;
  /** Metadata category for METADATA-typed elements */
  metadataTypeCategory?: string;
  /** Metadata type for METADATA-typed elements */
  metadataType?: string;
  /**
   * Tags this element as a financial metric (REVENUE, COST, MARGIN) so analytics
   * such as the customer revenue-decile can read it off captured events. Only
   * valid on numeric attribute types (INTEGER / NUMBER).
   */
  metricRole?: "REVENUE" | "COST" | "MARGIN";
}

/** Type codes that may carry a `metricRole` tag. */
export const METRIC_ROLE_ELIGIBLE_TYPE_CODES = ["INTEGER", "NUMBER"] as const;

/** Whether `typeCode` is numeric and therefore eligible for a `metricRole` tag. */
export function isMetricRoleEligibleType(typeCode: string): boolean {
  return (METRIC_ROLE_ELIGIBLE_TYPE_CODES as readonly string[]).includes(typeCode.toUpperCase());
}

/**
 * Generate a stable `_rowKey` for a new form element. Uses `crypto.randomUUID`
 * when available (all modern browsers + Node >=19 in tests); falls back to a
 * time+random composite so SSR/older environments still get unique keys.
 */
export function newElementRowKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Convert a DataModelElement (from API response) to form data.
 */
export function elementToFormData(element: DataModelElement): DataModelElementFormData {
  return {
    _rowKey: newElementRowKey(),
    dataModelElementId: element.dataModelElementId,
    system: element.system ?? false,
    name: element.name,
    inputAttribute: element.inputAttribute,
    outputAttribute: element.outputAttribute,
    typeCode: element.typeReference,
    isArray: element.array ?? false,
    required: element.required ?? false,
    sensitive: element.sensitive ?? false,
    inputOnly: element.inputOnly ?? false,
    outputOnly: element.outputOnly ?? false,
    createOnly: element.createOnly ?? false,
    metadataTypeCategory: element.metadataTypeCategory,
    metadataType: element.metadataType,
    metricRole: element.metricRole,
  };
}

/**
 * Convert form element data to the API create/update shape.
 * outputAttribute defaults to inputAttribute when unset. Metadata fields are
 * only forwarded when the element's typeCode is METADATA.
 *
 * `typeCode` is forwarded verbatim. It used to be uppercased, which is safe for
 * the primitive palette (`STRING`, `DATE_TIME`) but silently corrupts the other
 * thing an element's typeCode can be: a reference to another DataModelType. Those
 * codes are lowercase-hyphenated under the resource-code convention,
 * so `order-line-item` was being sent as
 * `ORDER-LINE-ITEM` and resolved to nothing. Every caller supplies the code from
 * a select backed by the palette or by fetched types, so there is nothing to
 * normalize here. The two case-sensitive comparisons below fold case themselves.
 */
export function formDataToElement(data: DataModelElementFormData): CreateDataModelElement {
  const inputAttr = data.inputAttribute?.trim() ?? "";
  const outputAttr = data.outputAttribute?.trim() || inputAttr;

  const element: CreateDataModelElement = {
    name: data.name.trim(),
    typeCode: data.typeCode.trim(),
    array: data.isArray ?? false,
    required: data.required ?? false,
    sensitive: data.sensitive ?? false,
    inputOnly: data.inputOnly ?? false,
    outputOnly: data.outputOnly ?? false,
    createOnly: data.createOnly ?? false,
  };

  if (inputAttr) element.inputAttribute = inputAttr;
  if (outputAttr) element.outputAttribute = outputAttr;

  if (data.typeCode.toUpperCase() === "METADATA") {
    if (data.metadataTypeCategory?.trim()) {
      element.metadataTypeCategory = data.metadataTypeCategory.trim();
    }
    if (data.metadataType?.trim()) {
      element.metadataType = data.metadataType.trim();
    }
  }

  if (data.metricRole && isMetricRoleEligibleType(data.typeCode)) {
    element.metricRole = data.metricRole;
  }

  return element;
}

/**
 * Generate a camelCase inputAttribute from a display name.
 *
 * "Email Address"      -> "emailAddress"
 * "First name"         -> "firstName"
 * "Customer-id"        -> "customerId"
 * "Email (primary)"    -> "emailPrimary"
 * "Phone.Number"       -> "phoneNumber"
 *
 * Splits on any run of non-alphanumeric characters (matching the server's
 * attribute pattern of `^[a-zA-Z][a-zA-Z0-9]*$`). Without this, names with
 * parens, dots, commas, or non-ASCII chars would slip through and produce
 * an opaque 400 on submit.
 */
export function nameToInputAttribute(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/**
 * Props for the DataModelTypeFormSheet component.
 */
export interface DataModelTypeFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing */
  initialData?: DataModelType;
  /** Submit handler */
  onSubmit: (data: CreateDataModelType | UpdateDataModelType) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/**
 * Initial data for DataModelFormSheet. In edit mode this is a full DataModel;
 * in create mode it's optionally a template (used by "Duplicate", which strips
 * identity fields). Only `type` and `elements` are consumed by the form.
 */
export type DataModelFormInitialData = Pick<DataModel, "elements"> & {
  type?: DataModelType;
};

/**
 * Props for the DataModelFormSheet component.
 */
export interface DataModelFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing, or a template for create-mode "Duplicate" */
  initialData?: DataModelFormInitialData;
  /** Available DataModelTypes for the type selector */
  availableTypes?: DataModelType[];
  /** Whether available types are loading */
  typesLoading?: boolean;
  /** Handler to create a new DataModelType inline (returns the created type) */
  onCreateType?: (data: CreateDataModelType) => Promise<DataModelType>;
  /**
   * Whole-model submit handler, used in create mode (and in edit mode when
   * `elementOperations` is not provided).
   */
  onSubmit?: (data: CreateDataModel | UpdateDataModel) => Promise<void>;
  /**
   * Edit mode: persist element changes one element at a time (add, update,
   * delete) instead of sending an element list through the whole-model PUT,
   * which the platform ignores. System elements are read-only and never sent.
   */
  elementOperations?: DataModelElementOperations;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/**
 * Props for the ElementDialog component.
 */
export interface ElementDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing */
  initialData?: DataModelElementFormData;
  /** Available DataModelTypes for the type reference selector */
  availableTypes?: DataModelType[];
  /** Submit handler */
  onSubmit: (data: DataModelElementFormData) => void;
  /** Error message to display */
  error?: string | null;
}

/**
 * Props for the BulkElementImportDialog.
 */
export interface BulkElementImportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Submit handler — receives parsed elements */
  onImport: (elements: DataModelElementFormData[]) => void;
}

/**
 * A single parsed bulk import row with validation status.
 */
export interface BulkImportRow {
  /** Original line text (for error display) */
  raw: string;
  /** Parsed element data (null if parse failed) */
  parsed: DataModelElementFormData | null;
  /** Error message if parse failed */
  error: string | null;
}

/**
 * Cross-entity impact entry — a data model that references the current type.
 */
export interface CrossEntityImpactEntry {
  /** The referencing model */
  dataModel: DataModel;
  /** Element names within that model that reference the current type */
  referencingElements: string[];
}
