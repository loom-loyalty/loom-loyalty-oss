/**
 * @loom-loyalty/program-builder
 *
 * Shared program executor, spec types, linter, and shape-diff for Loom
 * Loyalty program creation flows. Both the Hub wizard and the AI onboarding
 * agent import from this package so they share the same execution logic
 * and cannot drift.
 *
 * Public surface:
 * - `ProgramSpec` and nested spec types (`SelectedFeatures`, `WizardTier`, etc.)
 * - Zod schemas for each step (`programStepSchema`, `tiersStepSchema`, etc.)
 * - Linter (`validateProgramSpec`, `validateProgramSpecPartial`)
 * - Shape-diff (`computeEntityShapeDiff`, `hasFatalDiff`, `SHAPE_FIELDS`)
 * - Executor (`runProgramExecutor`, output types `ExecutorResult` /
 *   `ExecutionResults` / `ExecutorError`)
 * - Promotion-diff (`computePromotionDiff`) — read-only dry-run for the
 *   PromotionDiff UI
 * - Template-doc helpers (`hydrateForExecution`, `setAtPath`, `markdownFormat`)
 * - Standard PROGRAM_TYPE / CURRENCY_TYPE registries
 *   (`STANDARD_*_TYPE_CODES`, `getStandard*TypeName`, `isStandard*TypeCode`)
 * - Selected `execution-helpers` re-exports (`getErrorMessage`,
 *   `ignoreIfExists`, `isExistsError`, `sanitizeProgramCodeForEventType`,
 *   `getSortedTiers`, `getNonBaseTiers`). `wrapApiCall` lives in
 *   `execution-helpers` but is intentionally NOT re-exported — it's an
 *   internal utility used by the executor's stage implementations.
 */

// Spec (inputs to the executor)
export {
  MAX_BADGES_PER_PROGRAM,
  MAX_METADATA_RECORDS_PER_PROGRAM,
  MAX_PROMOTIONS_PER_PROGRAM,
  MAX_TIERS_PER_PROGRAM,
  awardRuleStepSchema,
  badgeSchema,
  badgesStepSchema,
  bonusConfigSchema,
  currencyStepSchema,
  customerStepSchema,
  eventDataFieldSchema,
  eventTypeSchema,
  expiryRuleSchema,
  metadataRecordSchema,
  pendingRuleSchema,
  programStepSchema,
  promotionSchema,
  selectedFeaturesSchema,
  tierSchema,
  tiersStepSchema,
  type AwardRuleStepData,
  type BadgeData,
  type BadgesStepData,
  type BonusConfig,
  type BonusConfigData,
  type CreateCustomer,
  type CreateEventRule,
  type CreateEventRuleCategory,
  type CreateExpiryRule,
  type CreateExpiryRuleExpiryPeriod,
  type CreateExpiryRuleType,
  type CreatePendingRule,
  type CreatePendingRulePendingPeriod,
  type CreatePendingRuleType,
  type CreateProgram,
  type CreateProgramCurrency,
  type CurrencyStepData,
  type CustomerStepData,
  type EventTypeData,
  type ExpiryRuleData,
  type MetadataRecord,
  type MetadataRecordData,
  type PendingRuleData,
  type ProgramSpec,
  type ProgramStepData,
  type ProgramType,
  type PromotionData,
  type SelectedFeatures,
  type SelectedFeaturesData,
  type TierData,
  type TiersStepData,
  type TransactionalRuleType,
  type WizardBadge,
  type WizardEventType,
  type WizardPromotion,
  type WizardPromotionEventRule,
  type WizardPromotionTarget,
  type WizardTier,
} from "./spec";

// Output types (used by the linter, shape-diff, and future executor)
export {
  ExecutorError,
  NeedsTypePickError,
  type ConflictEntry,
  type EntityRef,
  type EntityType,
  type EnvName,
  type ExecutionResults,
  type ExecutionStage,
  type ExecutorContext,
  type ExecutorResult,
  type LintViolation,
  type ProgressEvent,
  type ShapeDiff,
  type ShapeFieldDiff,
} from "./types";

// Linter
export {
  LINTER_RULE_CODES,
  validateProgramSpec,
  validateProgramSpecPartial,
  type LinterRuleCode,
  type ValidateProgramSpecOptions,
} from "./linter";

// Shape diff
export { SHAPE_FIELDS, computeEntityShapeDiff, hasFatalDiff } from "./shape-diff";

// Execution helpers (pure utilities shared with the executor)
//
// `toResourceCode` / `RESOURCE_CODE_PATTERN` are exported for the same reason
// `sanitizeProgramCodeForEventType` is: any surface that GENERATES a code the
// platform validates needs the one canonical converter, not its own `.replace()`
// chain. `apps/hub`'s data-model builder is the second such consumer.
export {
  RESOURCE_CODE_PATTERN,
  getErrorMessage,
  getNonBaseTiers,
  getSortedTiers,
  ignoreIfExists,
  isExistsError,
  sanitizeProgramCodeForEventType,
  toResourceCode,
} from "./execution-helpers";

// Award rule templates (6 static templates + utility functions)
export {
  AWARD_RULE_TEMPLATES,
  getDefaultConfig,
  getTemplateById,
  getTemplateCategories,
  getTemplatesByCategory,
  validateTemplateConfig,
  type AwardRuleTemplate,
} from "./templates";

// API payload builders (ProgramSpec → SDK payloads)
export {
  buildCurrencyPayload,
  buildCustomerPayload,
  buildEventRulePayload,
  buildExpiryRulePayload,
  buildPendingRulePayload,
  buildProgramPayload,
  buildTestEventData,
  calculateExpectedPoints,
  generateCode,
  generateCurrencyFields,
  generateEventRuleFields,
  generateExpiryRuleFields,
  generatePendingRuleFields,
} from "./api-converters";

// Executor (the main entry point)
export { checkProgramSpec, computeActiveStages, runProgramExecutor } from "./executor";

// Promotion diff (read-only dry-run API)
export {
  computePromotionDiff,
  type PromotionDiffContext,
  type PromotionDiffResult,
} from "./promotion-diff";

// Template document system
export {
  DuplicateCodeError,
  EmptyUploadError,
  FREEFORM_LOW_CONFIDENCE_THRESHOLD,
  FrontmatterParseError,
  STANDARD_CURRENCY_TYPE_CODES,
  STANDARD_PROGRAM_TYPE_CODES,
  SchemaVersionMismatchError,
  SchemaVersionMissingError,
  TEMPLATE_SCHEMA_VERSION,
  TEMPLATE_UPLOAD_MAX_BYTES,
  TableShapeError,
  TemplateParseError,
  buildApplyOperations,
  classifyDelta,
  emitProgramSpecFrontmatterSchema,
  excelFormat,
  frontmatterSchema,
  getStandardCurrencyTypeName,
  getStandardProgramTypeName,
  hydrateForExecution,
  isApplyType,
  isStandardCurrencyTypeCode,
  isStandardProgramTypeCode,
  markdownFormat,
  setAtPath,
} from "./template-doc/index.js";
export type {
  ApplyEntityType,
  ApplyOperation,
  ApplyUpdateResult,
  BreakingDelta,
  DataLossDelta,
  DeepPartial,
  DeltaClassification,
  DocumentFormat,
  DocumentFormatId,
  EntityIdsMap,
  FailedApplyOperation,
  FreeformExtractionRequest,
  FreeformExtractionResult,
  ParseOptions,
  ParseResult,
  ProgramSpecFrontmatter,
  RenderOptions,
  RenderResult,
  SafeDelta,
  TemplateParseErrorLocation,
  Warning,
} from "./template-doc/index.js";
