/**
 * Entity Components
 *
 * Schema-driven components for entity data display and management.
 */

export {
  EntityList,
  type EntityListProps,
  type EntityRecord,
  type PaginationState,
  type RowAction,
  type SortState,
} from "./entity-list.js";

export {
  EntityDetail,
  EntityDetailFields,
  type DetailAction,
  type EntityDetailFieldsProps,
  type EntityDetailProps,
} from "./entity-detail.js";

export { EntityEdit, type EntityEditProps, type FieldErrors } from "./entity-edit.js";

export { EntityField, type EntityFieldProps } from "./entity-field.js";

export {
  ExtendedFieldsInline,
  ExtendedFieldsSection,
  type ExtendedFieldsInlineProps,
  type ExtendedFieldsSectionProps,
} from "./extended-fields-section.js";

// Environment Workflow components
export {
  AI_VERIFICATION_COPY,
  AI_VERIFICATION_ENTITY_TYPES,
  AiVerificationCheckbox,
  ENVIRONMENT_COLUMN_HEADER,
  EnvironmentEnablementList,
  EnvironmentStatusColumn,
  RequestEnableDialog,
  formatEnablementPeriod,
  getEnvironmentColumn,
  getEnvironmentStatus,
  isAiVerificationRequiredEntityType,
  isEnabledNow,
  type AiVerificationCheckboxProps,
  type EnabledInEnvironment,
  type EnvironmentEnablementListProps,
  type EnvironmentOption,
  type EnvironmentStatus,
  type EnvironmentStatusColumnProps,
  type RequestEnableDialogProps,
  type RequestEnableFormData,
} from "./environment-workflow/index.js";

// Entity field utilities (extended field access)
export { extractExtendedFields } from "./entity-field-utils.js";

// Shared status pill for a record's lifecycle/status state
export {
  StatusIndicatorBadge,
  type StatusIndicatorBadgeConfig,
  type StatusIndicatorBadgeProps,
} from "./status-indicator-badge.js";

// Feature entity components (specialized views, forms, columns, skeletons)
export * from "./features/index.js";
