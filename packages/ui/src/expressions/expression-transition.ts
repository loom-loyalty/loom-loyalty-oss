/**
 * Expression operator/type-transition function (KTD10).
 *
 * `ExpressionNode`'s existing `handleDataChange` writes `{ [currentType]: newData }`
 * — it can edit fields within a fixed operator but cannot change the AST's
 * top-level key. Sentence-mode operator switching (e.g. `greaterThan` ->
 * `lessThanEquals`) needs a new top-level key, so this pure function computes
 * the new operator's data from the old one, following the exact per-field
 * preservation/drop rules in KTD10.
 *
 * Scoped to the comparison-family types only (fix #12) — the ~13 specialized
 * types never pass through here; a leaf switching into/out of one of those
 * continues through the root-level `ExpressionTypeSelector`'s existing
 * full-reset path (`createDefaultExpression`), unchanged.
 */

export const COMPARISON_FAMILY_TYPES = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanEquals",
  "lessThan",
  "lessThanEquals",
  "between",
  "startsWith",
  "endsWith",
  "matches",
  "in",
  "notIn",
  "containsAny",
  "containsAll",
] as const;

export type ComparisonFamilyType = (typeof COMPARISON_FAMILY_TYPES)[number];

const COMPARISON_FAMILY_SET: ReadonlySet<string> = new Set(COMPARISON_FAMILY_TYPES);

/** Is this AST type key one of the 14 comparison-family types (R4/KTD10)? */
export function isComparisonFamilyType(type: string): type is ComparisonFamilyType {
  return COMPARISON_FAMILY_SET.has(type);
}

const EQUALITY_TYPES = new Set<ComparisonFamilyType>(["equals", "notEquals"]);
const NUMERIC_TYPES = new Set<ComparisonFamilyType>([
  "greaterThan",
  "greaterThanEquals",
  "lessThan",
  "lessThanEquals",
]);
const STRING_TYPES = new Set<ComparisonFamilyType>(["startsWith", "endsWith", "matches"]);
const COLLECTION_TYPES = new Set<ComparisonFamilyType>([
  "in",
  "notIn",
  "containsAny",
  "containsAll",
]);

export type ComparisonFamilyKind = "equality" | "numeric" | "string" | "between" | "collection";

/**
 * True for the anniversary-today shape — `equals`/`notEquals` with a
 * `matchesCurrentDate` preOperation compared to `true` (e.g. the birthday
 * segment `$.birthDate`). The compared value is a fixed engine detail, so the
 * sentence row and summary read it as "is today (month and day)" instead of
 * offering the raw `true` as an editable value.
 */
export function isAnniversaryMatch(type: string, data: Record<string, unknown>): boolean {
  if (type !== "equals" && type !== "notEquals") return false;
  const preOperation = data.preOperation;
  return (
    typeof preOperation === "object" &&
    preOperation !== null &&
    "matchesCurrentDate" in preOperation &&
    data.value === true
  );
}

/** Which value-editing shape a comparison-family type uses (drives sentence-mode layout). */
export function getComparisonFamilyKind(type: ComparisonFamilyType): ComparisonFamilyKind {
  if (type === "between") return "between";
  if (EQUALITY_TYPES.has(type)) return "equality";
  if (NUMERIC_TYPES.has(type)) return "numeric";
  if (STRING_TYPES.has(type)) return "string";
  return "collection";
}

/**
 * Natural-language sentence fragments for each comparison operator (design
 * reference: "Expression design modal redesign", turns 1a/2a/3a/3b). Shared
 * between the sentence-mode operator pill (`comparison-sentence.tsx`) and the
 * friendly plain-English preview (`expression-summary.tsx`) so the two never
 * drift. `needsIs` controls whether the plain connector word "is" precedes
 * the label — equality/numeric/between read naturally as "is more than"/"is
 * exactly", while string/collection operators already carry their own verb
 * ("starts with", "contains any of") and would double up on "is".
 */
export const OPERATOR_SENTENCE_LABELS: Record<
  ComparisonFamilyType,
  { needsIs: boolean; label: string }
> = {
  equals: { needsIs: true, label: "exactly" },
  notEquals: { needsIs: true, label: "not exactly" },
  greaterThan: { needsIs: true, label: "more than" },
  greaterThanEquals: { needsIs: true, label: "at least" },
  lessThan: { needsIs: true, label: "less than" },
  lessThanEquals: { needsIs: true, label: "at most" },
  between: { needsIs: true, label: "between" },
  startsWith: { needsIs: false, label: "starts with" },
  endsWith: { needsIs: false, label: "ends with" },
  matches: { needsIs: false, label: "matches" },
  in: { needsIs: false, label: "is one of" },
  notIn: { needsIs: false, label: "is not one of" },
  containsAny: { needsIs: false, label: "contains any of" },
  containsAll: { needsIs: false, label: "contains all of" },
};

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return String(value);
}

/**
 * Computes the new operator's data object when switching between two
 * comparison-family types, preserving `path` and carrying the scalar
 * value / bounds / collection contents across the switch per KTD10's
 * explicit per-field preservation/drop rules:
 *
 * - `path` is always preserved.
 * - Single-value operators (equality/numeric/string) carry the scalar
 *   `value` between each other.
 * - Entering `between` seeds `lowerBound` from the scalar `value` and
 *   leaves `upperBound` an empty placeholder; leaving `between` keeps
 *   `lowerBound` as the surviving scalar `value` and drops `upperBound`
 *   plus the inclusivity flags.
 * - Entering a collection operator wraps the scalar into a single-element
 *   `values` array with `extractValues: false`; leaving one unwraps the
 *   first `values` element back into the scalar `value`, dropping extras
 *   and `extractValues`/`valuesPath`.
 * - Ancillary fields (`extractValueFromPath`, `preOperation`,
 *   `defaultResult`, `ignoreCase`) are preserved only where the target
 *   type actually declares them.
 */
export function transitionExpressionData(
  fromType: ComparisonFamilyType,
  toType: ComparisonFamilyType,
  currentData: Record<string, unknown>
): Record<string, unknown> {
  if (fromType === toType) return currentData;

  const path = typeof currentData.path === "string" ? currentData.path : "$.";
  const hasDefaultResult = "defaultResult" in currentData;
  const defaultResult = (currentData as { defaultResult?: boolean }).defaultResult;

  // Collection -> collection is a special case: both sides use a `values`
  // array, so switching between them (e.g. `in` -> `notIn`) must carry the
  // full array through unchanged rather than collapsing through a single
  // scalar (which silently truncated multi-element values to one entry —
  // adversarial review finding).
  if (COLLECTION_TYPES.has(fromType) && COLLECTION_TYPES.has(toType)) {
    const currentValues = (currentData as { values?: unknown[] }).values;
    const currentValuesPath = (currentData as { valuesPath?: unknown }).valuesPath;
    const next: Record<string, unknown> = {
      path,
      values: Array.isArray(currentValues) ? currentValues : [],
      extractValues: Boolean((currentData as { extractValues?: boolean }).extractValues),
    };
    if (currentValuesPath !== undefined) next.valuesPath = currentValuesPath;
    if (hasDefaultResult) next.defaultResult = defaultResult ?? false;
    return next;
  }

  let scalar: unknown;
  let extractValueFromPath = false;
  if (fromType === "between") {
    scalar = (currentData as { lowerBound?: unknown }).lowerBound;
    extractValueFromPath = Boolean(
      (currentData as { extractValueFromPath?: boolean }).extractValueFromPath
    );
  } else if (COLLECTION_TYPES.has(fromType)) {
    const values = (currentData as { values?: unknown[] }).values;
    scalar = Array.isArray(values) ? values[0] : undefined;
  } else {
    scalar = (currentData as { value?: unknown }).value;
    extractValueFromPath = Boolean(
      (currentData as { extractValueFromPath?: boolean }).extractValueFromPath
    );
  }

  const preOperation = (currentData as { preOperation?: unknown }).preOperation;
  const ignoreCase = (currentData as { ignoreCase?: boolean }).ignoreCase;

  if (toType === "between") {
    const next: Record<string, unknown> = {
      path,
      lowerBound: toNumber(scalar, 0),
      upperBound: undefined,
      extractValueFromPath,
    };
    if (preOperation !== undefined) next.preOperation = preOperation;
    return next;
  }

  if (COLLECTION_TYPES.has(toType)) {
    const next: Record<string, unknown> = {
      path,
      values: scalar === undefined ? [] : [scalar],
      extractValues: false,
    };
    if (hasDefaultResult) next.defaultResult = defaultResult ?? false;
    return next;
  }

  // toType is a single-value operator (equality / numeric / string).
  const next: Record<string, unknown> = { path, extractValueFromPath };

  if (EQUALITY_TYPES.has(toType)) {
    next.value = scalar;
    next.defaultResult = defaultResult ?? false;
    // Symmetric across equals/notEquals: packages/schema declares preOperation
    // on both (openapi.yaml's notEquals.preOperation is unconditional, same
    // shape as equals). See operators.ts's NotEqualsExpression comment for why
    // an earlier revision narrowed this to equals-only and was reverted.
    if (preOperation !== undefined) next.preOperation = preOperation;
  } else if (NUMERIC_TYPES.has(toType)) {
    next.value = extractValueFromPath ? scalar : toNumber(scalar, 0);
    if (preOperation !== undefined) next.preOperation = preOperation;
    if (hasDefaultResult) next.defaultResult = defaultResult;
  } else if (STRING_TYPES.has(toType)) {
    next.value = extractValueFromPath ? scalar : toStringValue(scalar);
    next.ignoreCase = ignoreCase ?? false;
    if (hasDefaultResult) next.defaultResult = defaultResult;
  }

  return next;
}
