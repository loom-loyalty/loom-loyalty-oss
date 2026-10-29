/**
 * Read-time migration for persisted expressions.
 *
 * Expressions are stored as opaque JSON (the backend OpenAPI documents
 * `eventExpression` / `segmentExpression` as `additionalProperties: true`), so
 * tenant data saved before the DSL correction still carries the OLD, drifted
 * field names. These pure functions run when a persisted expression is loaded
 * into the visual builder:
 *
 *  - `normalizeExpression` deep-maps the recoverable OLD field names to the NEW
 *    single-source-of-truth shapes (`@loom-loyalty/schema/expressions`). It is
 *    idempotent — new-shape data passes through unchanged — and never mutates
 *    its input.
 *  - `detectCorruptedNodes` finds nodes that are already data-corrupt or
 *    unrecoverable (bounds silently dropped, a removed operator, a coupon code
 *    that was persisted as a boolean, an unrecoverable coupon reference) so the
 *    UI can ask the operator to re-enter that rule. It must run on the RAW
 *    persisted expression — `normalizeExpression` deletes some corrupt fields.
 *
 * Neither function validates: the frozen `expressionSchema` remains the sole
 * validation gate. The mapping here only has to produce a shape that gate
 * accepts. Both degrade gracefully on pathological input (never throw in render).
 */

import {
  COUPON_MUTATION_ACTION_NAMES,
  NUMERIC_PRE_OPERATIONS,
  REMOVED_OPERATORS,
  type Expression,
} from "@loom-loyalty/schema/expressions";

// The persisted forms are opaque JSON; work in plain records and narrow.
type JsonObject = Record<string, unknown>;

/** Numeric pre-ops whose operand field drifted from `value` to `operand`. */
const NUMERIC_PRE_OPS = new Set<string>(NUMERIC_PRE_OPERATIONS);

/** Coupon actions whose `defaultResult` changed from a boolean to a coupon code. */
const COUPON_MUTATION_ACTIONS = new Set<string>(COUPON_MUTATION_ACTION_NAMES);

/** Operators removed from the DSL (rejected on ingest). */
const REMOVED_OPS = new Set<string>(REMOVED_OPERATORS);

/** Own-keys that must never be spread from tenant-controlled data. */
const PROTOTYPE_POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Recursion guard. Persisted trees are shallow in practice; a value this deep is
 * pathological (or a hand-crafted cycle), so bail rather than blow the stack.
 */
const MAX_MIGRATE_DEPTH = 64;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The single wrapper key of an expression / action / pre-op node. */
function wrapperKey(node: JsonObject): string | undefined {
  return Object.keys(node)[0];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Move `oldKey` to `newKey`, preferring an existing `newKey` (so already-new
 * data is untouched) and always removing `oldKey`. Mutates the passed clone.
 */
function renameKey(obj: JsonObject, oldKey: string, newKey: string): void {
  if (!(oldKey in obj)) return;
  if (!(newKey in obj)) obj[newKey] = obj[oldKey];
  delete obj[oldKey];
}

/** First own string value at any of the given keys, or undefined. */
function firstStringValue(obj: JsonObject, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    if (typeof obj[key] === "string") return obj[key] as string;
  }
  return undefined;
}

// =============================================================================
// normalizeExpression
// =============================================================================

function normalizePreOperation(raw: unknown, depth: number): unknown {
  if (depth > MAX_MIGRATE_DEPTH) return raw;
  if (!isPlainObject(raw)) return raw;
  const key = wrapperKey(raw);
  if (key === undefined) return raw;
  const body = raw[key];
  const inner: JsonObject = isPlainObject(body) ? { ...body } : {};

  // Key renames: `substring` -> `subString`, `dateTime` -> `datetime`.
  const newKey = key === "substring" ? "subString" : key === "dateTime" ? "datetime" : key;

  if (NUMERIC_PRE_OPS.has(key)) renameKey(inner, "value", "operand");
  if (newKey === "subString") renameKey(inner, "startIndex", "beginIndex");
  if (newKey === "datetime") renameKey(inner, "format", "pattern");

  return { [newKey]: inner };
}

function normalizeAction(raw: unknown, depth: number): unknown {
  if (depth > MAX_MIGRATE_DEPTH) return raw;
  if (!isPlainObject(raw)) return raw;
  const name = wrapperKey(raw);
  if (name === undefined) return raw;
  const body = raw[name];
  let inner: JsonObject = isPlainObject(body) ? { ...body } : {};

  // The dropped `properties` bag: extension values ride at the action's top
  // level, so spread them up (an explicit top-level field wins on collision).
  // Strip prototype-pollution keys — `properties` is tenant-controlled JSON.
  const properties = inner["properties"];
  if (isPlainObject(properties)) {
    delete inner["properties"];
    const safeProperties: JsonObject = {};
    for (const [k, v] of Object.entries(properties)) {
      if (!PROTOTYPE_POLLUTION_KEYS.has(k)) safeProperties[k] = v;
    }
    inner = { ...safeProperties, ...inner };
  }

  // Coupon use/hold/return `defaultResult` is now the coupon code (a string).
  if (COUPON_MUTATION_ACTIONS.has(name)) {
    // A persisted boolean cannot become a code — drop it (detectCorruptedNodes
    // surfaces the loss for re-entry).
    if (typeof inner["defaultResult"] === "boolean") delete inner["defaultResult"];
    // If no code is present, recover one that rode in the legacy `couponCode` /
    // `couponId` fields, then drop those (not part of the corrected shape).
    if (inner["defaultResult"] === undefined) {
      const legacyCode = firstStringValue(inner, ["couponCode", "couponId"]);
      if (legacyCode !== undefined) {
        inner["defaultResult"] = legacyCode;
        delete inner["couponCode"];
        delete inner["couponId"];
      }
    }
  }

  if ("preOperation" in inner)
    inner["preOperation"] = normalizePreOperation(inner["preOperation"], depth + 1);

  return { [name]: inner };
}

function normalizeNode(raw: unknown, depth: number): unknown {
  if (depth > MAX_MIGRATE_DEPTH) return raw;
  if (!isPlainObject(raw)) return raw;
  const op = wrapperKey(raw);
  if (op === undefined) return raw;
  const body = raw[op];
  const inner: JsonObject = isPlainObject(body) ? { ...body } : {};

  // Operator-specific renames.
  if (op === "between") {
    renameKey(inner, "minValue", "lowerBound");
    renameKey(inner, "maxValue", "upperBound");
  }
  if (op === "hasProgramCurrency") {
    renameKey(inner, "minimumBalance", "comparisonAmount");
    // `programId` / `programCode` / `path` are derived server-side from the
    // currency code and are not client-supplied.
    delete inner["programId"];
    delete inner["programCode"];
    delete inner["path"];
  }

  // Structural recursion (field-driven so it is robust across operators).
  const children = inner["children"];
  if (Array.isArray(children))
    inner["children"] = children.map((child) => normalizeNode(child, depth + 1));

  const actions = inner["actions"];
  if (Array.isArray(actions))
    inner["actions"] = actions.map((action) => normalizeAction(action, depth + 1));

  if ("preOperation" in inner)
    inner["preOperation"] = normalizePreOperation(inner["preOperation"], depth + 1);

  return { [op]: inner };
}

/**
 * Deep-map a persisted expression's recoverable OLD field names to the NEW SSOT
 * shapes. Idempotent and non-mutating. Unrecoverable nodes (removed operators,
 * bounds-less `between`, boolean coupon codes) are left structurally intact for
 * `detectCorruptedNodes` to surface; the returned tree is otherwise ready for
 * `expressionSchema`.
 */
export function normalizeExpression(raw: unknown): Expression {
  // Persisted forms are opaque JSON; the boundary cast is intentional. A
  // non-object (the looser `segmentExpression` anyOf permits primitives/arrays)
  // passes through so the caller can coalesce it to "no expression".
  try {
    return normalizeNode(raw, 0) as Expression;
  } catch {
    // Pathological input (e.g. a cycle): pass through unchanged. The frozen
    // schema remains the validation gate.
    return raw as Expression;
  }
}

// =============================================================================
// detectCorruptedNodes
// =============================================================================

/** A node that cannot be recovered by renaming and needs operator re-entry. */
export interface CorruptedNode {
  /** Fully-qualified structural location, e.g. `$.and.children[1].between`. */
  path: string;
  /** The operator / pre-op / action name at that location. */
  op: string;
  /** Human-readable explanation for the re-entry prompt. */
  reason: string;
}

function detectInPreOperation(
  raw: unknown,
  path: string,
  out: CorruptedNode[],
  depth: number
): void {
  if (depth > MAX_MIGRATE_DEPTH) return;
  if (!isPlainObject(raw)) return;
  const key = wrapperKey(raw);
  if (key === undefined) return;
  const nodePath = `${path}.${key}`;
  const body = raw[key];
  const inner: JsonObject = isPlainObject(body) ? body : {};

  if (
    NUMERIC_PRE_OPS.has(key) &&
    !isFiniteNumber(inner["operand"]) &&
    !isFiniteNumber(inner["value"])
  ) {
    out.push({
      path: nodePath,
      op: key,
      reason: `Numeric pre-operation "${key}" is missing its operand value. Re-enter the amount.`,
    });
  }
}

function detectInAction(raw: unknown, path: string, out: CorruptedNode[], depth: number): void {
  if (depth > MAX_MIGRATE_DEPTH) return;
  if (!isPlainObject(raw)) return;
  const name = wrapperKey(raw);
  if (name === undefined) return;
  const nodePath = `${path}.${name}`;
  const body = raw[name];
  const inner: JsonObject = isPlainObject(body) ? body : {};

  if (COUPON_MUTATION_ACTIONS.has(name)) {
    const legacyCode = firstStringValue(inner, ["couponCode", "couponId"]);
    const defaultResult = inner["defaultResult"];
    if (typeof defaultResult === "string") {
      // The code slot is taken; a leftover couponCode/couponId can't be
      // recovered and would be silently dropped on save.
      if (legacyCode !== undefined) {
        out.push({
          path: nodePath,
          op: name,
          reason: `Coupon action "${name}" has a leftover coupon reference that could not be migrated. Re-enter the coupon code.`,
        });
      }
    } else if (typeof defaultResult === "boolean" && legacyCode === undefined) {
      // Boolean with no recoverable code: the coupon code is lost.
      out.push({
        path: nodePath,
        op: name,
        reason: `Coupon action "${name}" stored a boolean where the coupon code (a string) is now required. Re-enter the coupon code.`,
      });
    }
  }

  if ("preOperation" in inner)
    detectInPreOperation(inner["preOperation"], `${nodePath}.preOperation`, out, depth + 1);
}

function detectInNode(raw: unknown, path: string, out: CorruptedNode[], depth: number): void {
  if (depth > MAX_MIGRATE_DEPTH) return;
  if (!isPlainObject(raw)) return;
  const op = wrapperKey(raw);
  if (op === undefined) return;
  const nodePath = `${path}.${op}`;
  const body = raw[op];
  const inner: JsonObject = isPlainObject(body) ? body : {};

  if (REMOVED_OPS.has(op)) {
    out.push({
      path: nodePath,
      op,
      reason: `Operator "${op}" was removed from the DSL (rejected on ingest). Re-enter this rule with a supported operator.`,
    });
    return; // removed ops carry no recoverable children
  }

  if (op === "between") {
    const hasLower = isFiniteNumber(inner["lowerBound"]) || isFiniteNumber(inner["minValue"]);
    const hasUpper = isFiniteNumber(inner["upperBound"]) || isFiniteNumber(inner["maxValue"]);
    if (!hasLower || !hasUpper) {
      out.push({
        path: nodePath,
        op: "between",
        reason:
          "`between` is missing its numeric bounds (they were dropped on save). Re-enter the lower and upper bound.",
      });
    }
  }

  const children = inner["children"];
  if (Array.isArray(children)) {
    children.forEach((child, i) =>
      detectInNode(child, `${nodePath}.children[${i}]`, out, depth + 1)
    );
  }

  const actions = inner["actions"];
  if (Array.isArray(actions)) {
    actions.forEach((action, i) =>
      detectInAction(action, `${nodePath}.actions[${i}]`, out, depth + 1)
    );
  }

  if ("preOperation" in inner)
    detectInPreOperation(inner["preOperation"], `${nodePath}.preOperation`, out, depth + 1);
}

/**
 * Walk a persisted expression and return the nodes that cannot be recovered by
 * `normalizeExpression` and must be re-entered by an operator: a `between` whose
 * bounds were dropped, a numeric pre-op with no operand, a removed operator, or
 * a coupon action whose code was persisted as a boolean / left unrecoverable.
 *
 * Runs on the RAW persisted expression: `normalizeExpression` deletes some of
 * these corrupt fields, so detecting after normalization would miss them.
 */
export function detectCorruptedNodes(raw: unknown): CorruptedNode[] {
  const out: CorruptedNode[] = [];
  try {
    detectInNode(raw, "$", out, 0);
  } catch {
    // Degrade gracefully — never throw during render.
  }
  return out;
}
