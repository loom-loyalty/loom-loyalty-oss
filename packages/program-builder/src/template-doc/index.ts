export type {
  ApplyEntityType,
  ApplyOperation,
  ApplyUpdateResult,
  DeepPartial,
  DocumentFormat,
  DocumentFormatId,
  EntityIdsMap,
  FailedApplyOperation,
  FreeformExtractionRequest,
  FreeformExtractionResult,
  ParseOptions,
  ParseResult,
  RenderOptions,
  RenderResult,
  Warning,
} from "./types.js";

export {
  DuplicateCodeError,
  EmptyUploadError,
  FrontmatterParseError,
  SchemaVersionMismatchError,
  SchemaVersionMissingError,
  TableShapeError,
  TemplateParseError,
  type TemplateParseErrorLocation,
} from "./errors.js";
export { excelFormat } from "./excel.js";
export { markdownFormat } from "./markdown.js";
export {
  TEMPLATE_SCHEMA_VERSION,
  emitProgramSpecFrontmatterSchema,
  frontmatterSchema,
  type ProgramSpecFrontmatter,
} from "./schema.js";

/** Shared upload ceiling. Changing this here changes both ai-server and the hub Dropzone. */
export const TEMPLATE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Confidence threshold below which a freeform extraction is flagged as
 * low-confidence and requires explicit user acknowledgment before the UI
 * will let them create the program. Shared between the ai-server extractor
 * (which emits the `low-confidence` warning) and the hub banner (which
 * decides chip state + which chips block the Create gate). Changing this
 * in one place without the other silently desynchronizes the two.
 */
export const FREEFORM_LOW_CONFIDENCE_THRESHOLD = 0.7;

export { buildApplyOperations, isApplyType } from "./build-apply-operations.js";
export { hydrateForExecution } from "./hydrate-for-execution.js";
export { setAtPath } from "./set-at-path.js";
export {
  STANDARD_CURRENCY_TYPE_CODES,
  STANDARD_PROGRAM_TYPE_CODES,
  getStandardCurrencyTypeName,
  getStandardProgramTypeName,
  isStandardCurrencyTypeCode,
  isStandardProgramTypeCode,
} from "./standard-types.js";
export { classifyDelta } from "./update-delta.js";
export type {
  BreakingDelta,
  DataLossDelta,
  DeltaClassification,
  SafeDelta,
} from "./update-delta.js";
