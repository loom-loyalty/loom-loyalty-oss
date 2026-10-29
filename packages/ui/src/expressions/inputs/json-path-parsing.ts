/**
 * Low-level JSONPath segment parsing shared by `use-json-path-schema.ts`,
 * `property-picker.tsx`, and `action-schema-field-names.ts` — three
 * independent path walkers that previously each carried their own copy of
 * this exact logic (adversarial review finding: primitive-type set and
 * array-suffix splitting had drifted into three places to keep in sync by
 * hand). Root-section resolution stays separate per file, since each caller
 * needs a different return shape for it (breadcrumb-building vs. a plain
 * model-code string) and `use-json-path-schema.ts`'s stateful browsing/
 * caching logic around it is deliberately not touched here.
 */

import { dataModelCodeKey } from "../../entity/features/data-models/code-key.js";

// Not exported: the only correct way to check membership is isPrimitiveTypeCode()
// below, which folds both sides. Comparing a raw code against this Set directly
// (as three call sites used to, via .toUpperCase()) is the exact bug this file
// exists to prevent — see the PR that added isPrimitiveTypeCode for the history.
const PRIMITIVE_TYPES = new Set([
  "STRING",
  "LOCALIZED_STRING",
  "TEXT",
  "INTEGER",
  "LONG",
  "DOUBLE",
  "FLOAT",
  "DECIMAL",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATE_TIME",
  "DATE_TIME_LOCAL",
  "LOCAL_DATE_TIME",
  "DATE_TIME_PERIOD",
  "TIME",
  "TIME_ZONE",
  "EMAIL",
  "URL",
  "UUID",
  "ENTITY_ID",
  "JSON",
  "METADATA",
  "ANY",
  "COUNTRY",
  "COORDINATES",
]);

// Several PRIMITIVE_TYPES entries are multi-segment (DATE_TIME,
// LOCAL_DATE_TIME, DATE_TIME_LOCAL, ...) and are part of DataModelType's
// resource-code migration, so the API now returns e.g. "date-time" instead of
// "DATE_TIME". A bare .toUpperCase() check turns that back into "DATE-TIME"
// (hyphen, not underscore), which matches neither spelling. Fold both sides
// through dataModelCodeKey instead.
const PRIMITIVE_TYPE_KEYS = new Set([...PRIMITIVE_TYPES].map((code) => dataModelCodeKey(code)));

/** True when `typeCode` names a primitive (non-referential) data model type, in either spelling. */
export function isPrimitiveTypeCode(typeCode: string): boolean {
  return PRIMITIVE_TYPE_KEYS.has(dataModelCodeKey(typeCode));
}

export interface RawPathSegment {
  attribute: string;
  isArray: boolean;
}

/** Splits off a trailing array-index suffix (e.g. `[*]`, `[0]`) from a path segment. */
export function splitArraySuffix(segment: string): RawPathSegment {
  const match = /^(.*?)\[.*?\]$/.exec(segment);
  return match ? { attribute: match[1]!, isArray: true } : { attribute: segment, isArray: false };
}
