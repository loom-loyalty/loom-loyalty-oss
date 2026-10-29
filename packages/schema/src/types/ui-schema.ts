/**
 * UI Schema Types
 *
 * Types for defining how entities should be rendered in the UI.
 */

import type { FieldDataType } from "./schema.js";

/**
 * Widget types for form fields
 */
export type WidgetType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "percentage"
  | "checkbox"
  | "switch"
  | "select"
  | "multi-select"
  | "radio"
  | "date"
  | "datetime"
  | "time"
  | "email"
  | "url"
  | "password"
  | "color"
  | "file"
  | "image"
  | "json"
  | "code"
  | "markdown"
  | "rich-text"
  | "reference"
  | "reference-multi"
  | "metadata-select"
  | "locale-tabbed-input"
  | "tags"
  | "hidden"
  | "readonly"
  | "custom";

/**
 * Display format for list/table columns and detail views
 */
export type DisplayFormat =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "datetime"
  | "relative-time"
  | "boolean"
  | "badge"
  | "status"
  | "link"
  | "email"
  | "image"
  | "avatar"
  | "reference"
  | "tags"
  | "json"
  | "rich-text"
  | "custom";

/**
 * UI field configuration
 */
export interface UIFieldConfig {
  /** Field name */
  name: string;
  /** Display label */
  label: string;
  /** Help text/description */
  helpText?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Widget type for forms */
  widget: WidgetType;
  /** Display format for lists/details */
  displayFormat: DisplayFormat;
  /** Whether field is visible in list view */
  showInList: boolean;
  /** Whether field is visible in detail view */
  showInDetail: boolean;
  /** Whether field is visible in create form */
  showInCreate: boolean;
  /** Whether field is visible in edit form */
  showInEdit: boolean;
  /** Column width hint (for tables) */
  columnWidth?: "auto" | "sm" | "md" | "lg" | "xl";
  /** Whether column is sortable */
  sortable?: boolean;
  /** Whether column is filterable */
  filterable?: boolean;
  /** Whether column is searchable */
  searchable?: boolean;
  /** Custom component name (if widget is 'custom') */
  customComponent?: string;
  /** Additional widget props */
  widgetProps?: Record<string, unknown>;
  /** Field group/section */
  group?: string;
  /** Display order within group */
  order?: number;
  /** Referenced entity code (when widget is 'reference' / 'reference-multi') */
  entityCode?: string;
  /** Metadata type code (when widget is 'metadata-select') */
  metadataType?: string;
  /** Metadata category (when widget is 'metadata-select') */
  metadataTypeCategory?: string;
  /** Original BE typeReference — used for fallback rendering of unknown types */
  originalTypeReference?: string;
}

/**
 * Field group for organizing form sections
 */
export interface UIFieldGroup {
  /** Group identifier */
  id: string;
  /** Group label */
  label: string;
  /** Optional description */
  description?: string;
  /** Whether group is collapsible */
  collapsible?: boolean;
  /** Whether group is initially collapsed */
  defaultCollapsed?: boolean;
  /** Fields in this group */
  fields: string[];
  /** Display order */
  order: number;
  /** Layout mode for the group */
  layout?: "stacked" | "inline" | "grid";
}

/**
 * List view configuration
 */
export interface UIListConfig {
  /** Columns to display */
  columns: string[];
  /** Default sort field */
  defaultSort?: string;
  /** Default sort direction */
  defaultSortDirection?: "asc" | "desc";
  /** Whether to show search */
  searchable?: boolean;
  /** Fields to search */
  searchFields?: string[];
  /** Available filters */
  filters?: UIFilterConfig[];
  /** Page size options */
  pageSizes?: number[];
  /** Default page size */
  defaultPageSize?: number;
  /** Enable row selection */
  selectable?: boolean;
  /** Row click action */
  rowClickAction?: "view" | "edit" | "none";
  /** Available bulk actions */
  bulkActions?: UIBulkAction[];
}

/**
 * Filter configuration
 */
export interface UIFilterConfig {
  /** Field to filter */
  field: string;
  /** Filter type */
  type: "text" | "select" | "multi-select" | "date-range" | "number-range" | "boolean";
  /** Filter label */
  label: string;
  /** Options for select filters */
  options?: { value: string | number; label: string }[];
}

/**
 * Bulk action configuration
 */
export interface UIBulkAction {
  /** Action identifier */
  id: string;
  /** Action label */
  label: string;
  /** Icon name */
  icon?: string;
  /** Confirmation message */
  confirmMessage?: string;
  /** Whether action is destructive */
  destructive?: boolean;
}

/**
 * Detail view configuration
 */
export interface UIDetailConfig {
  /** Field groups to display */
  groups: UIFieldGroup[];
  /** Show timestamps section */
  showTimestamps?: boolean;
  /** Show metadata section */
  showMetadata?: boolean;
  /** Related entities to display */
  relatedEntities?: UIRelatedEntityConfig[];
}

/**
 * Related entity configuration
 */
export interface UIRelatedEntityConfig {
  /** Entity code */
  entityCode: string;
  /** Relationship field */
  field: string;
  /** Display label */
  label: string;
  /** Columns to show */
  columns: string[];
  /** Max items to show */
  limit?: number;
}

/**
 * Form configuration (create/edit)
 */
export interface UIFormConfig {
  /** Field groups */
  groups: UIFieldGroup[];
  /** Validation mode */
  validationMode?: "onChange" | "onBlur" | "onSubmit";
  /** Show cancel button */
  showCancel?: boolean;
  /** Cancel button label */
  cancelLabel?: string;
  /** Submit button label */
  submitLabel?: string;
  /** Show reset button */
  showReset?: boolean;
}

/**
 * Complete UI schema for an entity
 */
export interface UIEntitySchema {
  /** Entity code */
  entityCode: string;
  /** Entity display name (singular) */
  singularName: string;
  /** Entity display name (plural) */
  pluralName: string;
  /** Entity description */
  description?: string;
  /** Entity icon name */
  icon?: string;
  /** Display field (for showing entity name/title) */
  displayField?: string;
  /** Field configurations */
  fields: Record<string, UIFieldConfig>;
  /** List view configuration */
  list: UIListConfig;
  /** Detail view configuration */
  detail: UIDetailConfig;
  /** Create form configuration */
  create: UIFormConfig;
  /** Edit form configuration */
  edit: UIFormConfig;
  /** Whether entity supports create */
  canCreate: boolean;
  /** Whether entity supports edit */
  canEdit: boolean;
  /** Whether entity supports delete */
  canDelete: boolean;
}

/**
 * Field type to widget mapping
 */
export interface FieldTypeMapping {
  /** Widget for form input */
  widget: WidgetType;
  /** Format for display */
  displayFormat: DisplayFormat;
  /** Default column width */
  columnWidth?: UIFieldConfig["columnWidth"];
  /** Default sortable */
  sortable?: boolean;
  /** Default filterable */
  filterable?: boolean;
}

/**
 * Field type registry type
 */
export type FieldTypeRegistry = Record<FieldDataType, FieldTypeMapping>;
