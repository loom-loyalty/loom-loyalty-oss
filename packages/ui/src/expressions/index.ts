/**
 * Expression Builder - Barrel Export
 *
 * Public API for the visual expression builder feature.
 */

// Main components
export { getActionCategoryColor } from "./action-category-colors.js";
export { ActionList } from "./action-list.js";
export { ActionRow, type ActionRowProps } from "./action-row.js";
export { getActionSummary, missing, schemaVal, val } from "./action-summaries.js";
export { useActionSummaryLookups, type ActionSummaryLookups } from "./action-summary-lookups.js";
export { ActionTypePicker, type ActionTypePickerProps } from "./action-type-picker.js";
export { AiDraftedChip } from "./ai-drafted-chip.js";
export { FieldsetLegend, type FieldsetLegendProps } from "./components/fieldset-legend.js";
export { SchemaValueChip, type SchemaValueChipProps } from "./components/schema-value-chip.js";
export { SectionRule, type SectionRuleProps } from "./components/section-rule.js";
export {
  SegmentedSwitch,
  type SegmentedSwitchOption,
  type SegmentedSwitchProps,
} from "./components/segmented-switch.js";
export { ExpressionAiBuilder, type ExpressionAiBuilderProps } from "./expression-ai-builder.js";
export { ExpressionBuilder, type ExpressionBuilderProps } from "./expression-builder.js";
export {
  ExpressionMigrationNotice,
  type ExpressionMigrationNoticeProps,
} from "./expression-migration-notice.js";
export { ExpressionModal, useExpressionPathValidation } from "./expression-modal.js";
export { ExpressionNode } from "./expression-node.js";
export { ExpressionSummary, type ExpressionSummaryProps } from "./expression-summary.js";
export {
  ExpressionTemplatePicker,
  type ExpressionTemplatePickerProps,
} from "./expression-template-picker.js";
export { ExpressionTypeSelector } from "./expression-type-selector.js";
export { ExpressionValidation } from "./expression-validation.js";
export { JsonPathBreadcrumb, type JsonPathBreadcrumbProps } from "./inputs/json-path-breadcrumb.js";
export { PathOrValueField, type PathOrValueFieldProps } from "./inputs/path-or-value-field.js";
export {
  PreOperationSelector,
  type PreOperationSelectorProps,
} from "./inputs/pre-operation-selector.js";
export { PropertyPicker, type PropertyPickerProps } from "./inputs/property-picker.js";

// Types
export type {
  ActionComponentProps,
  ActionListProps,
  Expression,
  ExpressionAction,
  ExpressionComponentProps,
  ExpressionModalAiBarProps,
  ExpressionModalAiBridge,
  ExpressionModalAiProposal,
  ExpressionModalAiStepApi,
  ExpressionModalHeader,
  ExpressionModalProps,
  ExpressionMode,
  ExpressionNodeProps,
  ExpressionPresentation,
  ExpressionTemplate,
  PreOperation,
} from "./types.js";

// Expression context (schema-aware path browsing)
export {
  ExpressionContextProvider,
  useExpressionContext,
  type DataModelLike,
  type ExpressionContextValue,
} from "./expression-context.js";

// Utilities
export {
  ACTION_CATEGORIES,
  ACTION_TYPE_NAMES,
  EXPRESSION_CATEGORIES,
  EXPRESSION_TYPE_NAMES,
  countExpressionNodes,
  createDefaultAction,
  createDefaultExpression,
  getActionData,
  getActionType,
  getExpressionActions,
  getExpressionChildren,
  getExpressionData,
  getExpressionDepth,
  getExpressionType,
  isCompositeExpression,
  validateExpressionTree,
  type ValidationError,
} from "./utils.js";

// Read-time migration for persisted (legacy-shaped) expressions.
export { detectCorruptedNodes, normalizeExpression, type CorruptedNode } from "./migrate.js";
