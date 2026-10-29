/**
 * Shape diff — per-entity field comparison for replay collision detection.
 *
 * When the executor runs in `replayMode: 'skip-existing'`, the pre-scan
 * finds entities in the target env that already have codes matching the
 * spec. For each match, we need to decide: skip (shapes match) or abort
 * with a conflict-diff (shapes differ on a fatal field).
 *
 * This module defines WHICH FIELDS matter per entity type and provides a
 * pure comparison function. It does NOT do any HTTP — the caller fetches
 * the actual entity from the target env and passes it in.
 *
 * Policy:
 * - `fatal` fields represent the semantic identity of the entity. A
 *   mismatch on a fatal field means the two entities represent
 *   meaningfully different data and the replay must abort.
 * - `warning` fields are cosmetic (display name, description). A mismatch
 *   is surfaced to the user but does not block the replay.
 * - Unlisted fields are ignored — they're either server-generated (ids,
 *   timestamps) or genuinely irrelevant to replay equivalence.
 */

import type { EntityType, ShapeDiff, ShapeFieldDiff } from "./types";

/**
 * Per-entity field significance map.
 *
 * Mapped by `EntityType`. Every entity type the executor handles has an
 * entry here. Entity types that are never subject to shape-diff replay
 * (metadata, metadataType, customer — dev-env-only creations) have empty
 * arrays and `computeEntityShapeDiff` returns an empty diff for them.
 *
 * **Field paths are resolved via `getField` which supports dot-notation
 * for nested lookups** — e.g., `"currencyType.code"` traverses into the
 * nested `Metadata` object that ProgramCurrency returns. The expected-shape
 * builders in `pre-scan.ts` must mirror the nesting.
 *
 * Schema references (packages/sdk/src/generated/schemas):
 *   - Program: CreateProgram (simple flat shape, typeCode is the identity)
 *   - ProgramCurrency: `currencyType: Metadata` (nested) — NOT `currencyTypeCode`
 *   - Tier: no threshold field exists on the server shape; `rank` is the
 *     ordering signal. Badges on tier identity are cosmetic.
 *   - Badge: `programIds: string[]` (flat array)
 *   - CounterTarget: `counterTargetType: Metadata` (nested) — NOT `counterTypeCode`
 */
export const SHAPE_FIELDS: Record<EntityType, { fatal: string[]; warning: string[] }> = {
  program: {
    // NOTE: the SDK's `Program.type` is a nested `Metadata` object, NOT
    // a flat `typeCode`. This mirrors the currency + target fixes —
    // the original P0 #3 fix missed program because the bug was
    // symmetric across every entity that carries a Metadata reference.
    // Pre-scan's expected-shape builder must produce
    // `{ type: { code: ... } }` to match.
    fatal: ["type.code", "createAccountOnCustomerCreation"],
    warning: ["name", "description"],
  },
  currency: {
    // NOTE: `currencyType.code` uses nested-path lookup. The SDK's
    // `ProgramCurrency.currencyType` is a `Metadata` object, not a flat
    // code field. The pre-scan expected-shape builder must produce
    // `{ currencyType: { code: ... } }` to match.
    fatal: ["currencyType.code", "programIds"],
    warning: ["name"],
  },
  tier: {
    // NOTE: the SDK's `Tier` interface has NO threshold field — the
    // wizard's `pointsThreshold` lives only on `WizardTier` as a proxy
    // for the downstream CounterTarget's targetValue. However, tiers
    // DO have identity fields beyond cosmetic name: `rank` orders
    // them in the progression ladder and `subscription` gates them
    // behind paid access. A wizard run that reuses an existing tier
    // with `rank: 5, subscription: true` when the spec wants
    // `rank: 1, subscription: false` produces a silently-wrong
    // program. The adversarial re-review of the M1-M3 ship PR caught
    // this as a P1 over-correction when tier fatal was briefly set
    // to `[]`. `rank` and `subscription` are fatal because wrong
    // values change user-facing program behavior; `durationPeriod`
    // (tier lifetime before expiry) is fatal for the same reason.
    fatal: ["rank", "subscription", "durationPeriod"],
    warning: ["name"],
  },
  badge: {
    // Badge's fatal identity is the program association. A badge with
    // the same code but a different programIds would be a collision
    // with an unrelated program's badge of the same name — the
    // pre-scan expected-shape builder must set programIds: [programId].
    fatal: ["programIds"],
    warning: ["name", "description"],
  },
  target: {
    // NOTE: `counterTargetType.code` uses nested-path lookup. The SDK's
    // `CounterTarget.counterTargetType` is a `Metadata` object, not a
    // flat code field. Pre-scan expected-shape must produce
    // `{ counterTargetType: { code: ... } }` to match.
    fatal: ["type", "programIds", "counterTargetType.code", "targetValue"],
    warning: ["name"],
  },
  eventRule: {
    fatal: ["eventTypeCode", "programIds", "category", "eventExpression", "eventActionsExpression"],
    warning: ["name", "code"],
  },
  expiryRule: {
    fatal: ["type", "expiryPeriod", "expiryPeriodValue", "programIds"],
    warning: ["name"],
  },
  pendingRule: {
    fatal: ["type", "pendingPeriod", "pendingPeriodValue", "programIds"],
    warning: ["name"],
  },
  eventType: {
    fatal: ["code"],
    warning: ["name", "description"],
  },
  // A care-surface registry row. Never subject to cross-environment replay:
  // it is created after the run's entities rather than adopted from a target
  // environment, and it carries no shape to drift — only the activity code it
  // exposes and the surfaces it exposes it on. Empty arrays mean
  // `computeEntityShapeDiff` returns an empty diff, which is the correct
  // answer here rather than a missing-entry crash.
  eventTypeAction: {
    fatal: [],
    warning: [],
  },
  offer: {
    // Coupon Offer identity: `type` (COUPON / EXTERNAL) is the
    // discriminator; `programIds` ensures we don't adopt an offer scoped
    // to a different program. Other Coupon-specific fields (couponDiscountType,
    // maxOfferUses, etc.) drift across re-imports and aren't fatal.
    fatal: ["type", "programIds"],
    warning: ["name"],
  },
  // Dev-env-only entities: never subject to cross-env replay.
  metadata: { fatal: [], warning: [] },
  metadataType: { fatal: [], warning: [] },
  customer: { fatal: [], warning: [] },
};

// ────────────────────────────────────────────────────────────────
// Comparison helpers
// ────────────────────────────────────────────────────────────────

/**
 * Deep equality for values we expect to see in entity fields.
 *
 * Covers primitives, arrays of primitives, plain objects, and nested
 * combinations. NOT a general-purpose deep-equal — it's scoped to the
 * kinds of values the Loom Loyalty API returns for entity fields.
 *
 * Null vs undefined are treated as equal because some endpoints return
 * `null` for unset optional fields while the spec passes `undefined`.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // null and undefined are both "not set"
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  // Same reference, same value
  if (a === b) return true;

  // Different types
  if (typeof a !== typeof b) return false;

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // Objects
  if (typeof a === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (!deepEqual(aObj[k], bObj[k])) return false;
    }
    return true;
  }

  // Primitives already handled by ===
  return false;
}

/**
 * Extract the value at a field path from an entity-like object.
 *
 * Supports dot-notation for nested lookups (e.g. `"currencyType.code"`
 * resolves `entity.currencyType.code`). Returns undefined on any
 * intermediate null/undefined or non-object value — no throwing on
 * broken paths. Arrays are NOT traversable (use a top-level field
 * comparison for arrays).
 *
 * **Prototype-chain safety**: both the top-level and nested lookups use
 * `Object.hasOwn` to refuse prototype-chain property access. Without
 * this guard, a SHAPE_FIELDS path ending in `toString`, `constructor`,
 * or `hasOwnProperty` would silently return the Object.prototype
 * member (a function), and `deepEqual` would compare two function
 * references by identity — producing phantom matches on semantically
 * different objects. Flagged by the adversarial re-review as a P2
 * defense-in-depth concern.
 *
 * The nested-path support is necessary because several SDK response
 * shapes use `Metadata` nesting (e.g. `ProgramCurrency.currencyType`,
 * `CounterTarget.counterTargetType`) where the wizard/executor think of
 * the code as flat.
 */
function getField(entity: unknown, field: string): unknown {
  // Use Object.prototype.hasOwnProperty.call rather than Object.hasOwn
  // because the tsconfig's lib target doesn't include es2022.hasOwn.
  // Both have identical semantics for our use case (refuse prototype-
  // chain access).
  const hasOwn = (obj: object, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(obj, key);
  if (entity == null || typeof entity !== "object") return undefined;
  if (!field.includes(".")) {
    return hasOwn(entity as object, field) ? (entity as Record<string, unknown>)[field] : undefined;
  }
  const segments = field.split(".");
  let current: unknown = entity;
  for (const seg of segments) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    if (!hasOwn(current as object, seg)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Compare the spec's expected entity against the actual one from the
 * target environment. Returns a `ShapeDiff` with the list of mismatched
 * fields classified by significance.
 *
 * Callers should treat ANY `ShapeFieldDiff` with `significance: 'fatal'`
 * as a blocker — the replay must abort and surface a `ConflictEntry` to
 * the user.
 *
 * For entity types with no tracked fields (`metadata`, `metadataType`,
 * `customer`), returns an empty diff — those entity types are dev-env-only
 * and not subject to replay conflict detection.
 */
export function computeEntityShapeDiff(
  type: EntityType,
  expected: unknown,
  actual: unknown
): ShapeDiff {
  const config = SHAPE_FIELDS[type];
  const fields: ShapeFieldDiff[] = [];

  for (const fieldName of config.fatal) {
    const expectedValue = getField(expected, fieldName);
    const actualValue = getField(actual, fieldName);
    if (!deepEqual(expectedValue, actualValue)) {
      fields.push({
        path: fieldName,
        expected: expectedValue,
        actual: actualValue,
        significance: "fatal",
      });
    }
  }

  for (const fieldName of config.warning) {
    const expectedValue = getField(expected, fieldName);
    const actualValue = getField(actual, fieldName);
    if (!deepEqual(expectedValue, actualValue)) {
      fields.push({
        path: fieldName,
        expected: expectedValue,
        actual: actualValue,
        significance: "warning",
      });
    }
  }

  return { type, fields };
}

/**
 * Convenience helper — does the diff contain any fatal field mismatches?
 *
 * Callers use this to decide between "skip existing" (no fatals) and
 * "abort with conflict-diff" (one or more fatals).
 */
export function hasFatalDiff(diff: ShapeDiff): boolean {
  return diff.fields.some((f) => f.significance === "fatal");
}
