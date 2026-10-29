/**
 * Pre-Operation schemas — the value transforms applied before a leaf operator
 * compares (e.g. multiply an extracted amount, take a substring, coerce epoch).
 *
 * Each pre-operation serializes as a wrapper object:
 * `{ "<preOpName>": { ...fields } }`. (12 pre-operations total.)
 *
 * This is the single source of truth — `packages/ui/src/expressions/types.ts`
 * re-exports the inferred types so the builder and the validator can never drift.
 */

import { z } from "zod";

/**
 * Calendar field a `datetime` pre-op extracts. Wire value = enum name.
 */
export const DATE_TIME_OPERANDS = [
  "monthOfYear",
  "weekOfYear",
  "weekOfMonth",
  "dayOfYear",
  "dayOfMonth",
  "dayOfWeek",
  "hourOfDay",
  "minuteOfHour",
  "year",
] as const;
export type DateTimeOperand = (typeof DATE_TIME_OPERANDS)[number];

// A numeric pre-op operand. The operand field is `operand` (was `value` in the
// drifted FE types).
const operandField = z.object({ operand: z.number() });

const addOperationSchema = z.object({ add: operandField });
const subtractOperationSchema = z.object({ subtract: operandField });
const multiplyOperationSchema = z.object({ multiply: operandField });
const divideOperationSchema = z.object({ divide: operandField });
const moduloOperationSchema = z.object({ modulo: operandField });

const lengthOperationSchema = z.object({ length: z.object({}) });

// The key is `subString` (capital S); indices are `beginIndex`/`endIndex`
// (was `substring` / `startIndex` / `endIndex`). `suppressExceptions` guards
// out-of-range indices.
const subStringOperationSchema = z.object({
  subString: z.object({
    beginIndex: z.number().int(),
    endIndex: z.number().int(),
    suppressExceptions: z.boolean().optional(),
  }),
});

const sizeOperationSchema = z.object({ size: z.object({}) });
const epochOperationSchema = z.object({ epoch: z.object({}) });

// The key is `datetime` (all lowercase); the format string field is `pattern`
// (was `dateTime` / `format`). `operand` selects the calendar field;
// `zoneOffSet` (capital S, verbatim) is the tz offset.
const datetimeOperationSchema = z.object({
  datetime: z.object({
    operand: z.enum(DATE_TIME_OPERANDS).optional(),
    zoneOffSet: z.string().optional(),
    pattern: z.string().optional(),
  }),
});

const diffFromCurrentEpochOperationSchema = z.object({
  diffFromCurrentEpoch: z.object({}),
});

// New pre-op — one of the audience-compilable pre-ops (with the numeric ones).
// Used as `equals(path, preOperation: matchesCurrentDate, value: true)`.
// `timeZone` is a tz zone-id (default ORGANIZATION); `pattern` is the date format.
const matchesCurrentDateOperationSchema = z.object({
  matchesCurrentDate: z.object({
    timeZone: z.string().optional(),
    pattern: z.string().optional(),
  }),
});

/**
 * PreOperation — union of the 12 backend pre-operation subtypes.
 */
export const preOperationSchema = z.union([
  addOperationSchema,
  subtractOperationSchema,
  multiplyOperationSchema,
  divideOperationSchema,
  moduloOperationSchema,
  lengthOperationSchema,
  subStringOperationSchema,
  sizeOperationSchema,
  epochOperationSchema,
  datetimeOperationSchema,
  diffFromCurrentEpochOperationSchema,
  matchesCurrentDateOperationSchema,
]);

export type PreOperation = z.infer<typeof preOperationSchema>;

/** Pre-op names, for allowlists and prompt grounding. */
export const PRE_OPERATION_NAMES = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "modulo",
  "length",
  "subString",
  "size",
  "epoch",
  "datetime",
  "diffFromCurrentEpoch",
  "matchesCurrentDate",
] as const;

export type PreOperationName = (typeof PRE_OPERATION_NAMES)[number];

/**
 * Numeric pre-operations. Their operand field is `operand`; used by read-time
 * migration to know which pre-ops carry a numeric operand.
 */
export const NUMERIC_PRE_OPERATIONS = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "modulo",
] as const satisfies readonly PreOperationName[];

/**
 * Pre-ops valid for audience (customer-surface) segmentation. Only these may
 * appear under a customer-surface expression; the rest are event-runtime only.
 */
export const SEGMENT_COMPILABLE_PRE_OPERATIONS: readonly PreOperationName[] = [
  ...NUMERIC_PRE_OPERATIONS,
  "matchesCurrentDate",
] as const;
