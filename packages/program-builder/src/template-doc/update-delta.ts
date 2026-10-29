/**
 * Delta classifier for UPDATE-mode template uploads. Pure function.
 * Compares a hydrated `currentSpec` (existing program on the tenant)
 * against a parsed `newSpec` (uploaded template) and buckets the
 * differences into `safe` / `breaking` / `dataLoss`.
 *
 * Reuses `SHAPE_FIELDS` from `shape-diff.ts` as the per-field oracle:
 *   - fatal field changed → `breaking` (semantic identity drift)
 *   - warning field changed → `safe` with kind `modify-cosmetic`
 *   - field outside SHAPE_FIELDS → ignored (server-generated, irrelevant)
 *
 * Entity-level adds / removes are derived by code-set comparison.
 */

import { SHAPE_FIELDS } from "../shape-diff";
import type { ProgramSpec, WizardBadge, WizardTier } from "../spec";
import type { EntityRef, EntityType } from "../types";

export type SafeDelta = {
  kind: "add" | "modify-cosmetic";
  entity: EntityRef;
  details: string;
};

export type BreakingDelta =
  | {
      kind: "modify";
      entity: EntityRef;
      field: string;
      reason: string;
    }
  | {
      /**
       * Code rename. Server-side, the platform requires DELETE old +
       * CREATE new for these endpoints because `code` is part of the URL
       * identity. `entity.code` is the NEW code (post-rename),
       * `previousCode` is the old one — the apply builder needs both to
       * emit the paired DELETE+CREATE ops. UI surfaces the pair as a
       * single "rename" affordance so the user can't half-apply it.
       */
      kind: "rename";
      entity: EntityRef;
      previousCode: string;
      reason: string;
    };

export type DataLossDelta = {
  kind: "remove";
  entity: EntityRef;
  reason: string;
};

export interface DeltaClassification {
  safe: SafeDelta[];
  breaking: BreakingDelta[];
  dataLoss: DataLossDelta[];
}

/**
 * Compare two specs and produce a classified delta. The classifier is
 * pure — no SDK calls, no I/O. Wrong input shapes (e.g. malformed
 * specs) are not validated here; the upstream linter enforces that.
 */
export function classifyDelta(currentSpec: ProgramSpec, newSpec: ProgramSpec): DeltaClassification {
  const result: DeltaClassification = { safe: [], breaking: [], dataLoss: [] };

  // ── Singletons (program, currency, expiry, pending, awardRule, eventType) ──
  diffSingleton(result, "program", currentSpec.program, newSpec.program);
  diffSingleton(result, "currency", currentSpec.currency, newSpec.currency);
  diffSingleton(result, "expiryRule", currentSpec.expiryRule, newSpec.expiryRule);
  diffSingleton(result, "pendingRule", currentSpec.pendingRule, newSpec.pendingRule);
  diffSingleton(
    result,
    "eventRule",
    currentSpec.awardRule?.rulePayload,
    newSpec.awardRule?.rulePayload
  );
  // eventType applies to event-based programs. SHAPE_FIELDS.eventType
  // marks `code` fatal — changing it means the program now fires on a
  // different external trigger.
  diffSingleton(result, "eventType", currentSpec.eventType, newSpec.eventType);

  // Collections (tiers, badges). Default to empty arrays so a partial
  // spec (e.g. from an early-mid-flow tool call) doesn't throw.
  diffCollection(result, "tier", currentSpec.tiers ?? [], newSpec.tiers ?? [], tierFieldDiff);
  diffCollection(result, "badge", currentSpec.badges ?? [], newSpec.badges ?? [], badgeFieldDiff);

  return result;
}

// ────────────────────────────────────────────────────────────────
// Singleton diff — currency, expiry, pending, award rule, program
// ────────────────────────────────────────────────────────────────

type WithCode = { code?: string };

function diffSingleton(
  result: DeltaClassification,
  type: EntityType,
  current: WithCode | undefined,
  next: WithCode | undefined
): void {
  // Both absent → nothing to diff.
  if (!current && !next) return;
  // Add: current absent, next present.
  if (!current && next) {
    if (next.code) {
      result.safe.push({
        kind: "add",
        entity: { type, code: next.code },
        details: `Add ${type} ${next.code}.`,
      });
    }
    return;
  }
  // Remove: current present, next absent.
  if (current && !next) {
    if (current.code) {
      result.dataLoss.push({
        kind: "remove",
        entity: { type, code: current.code },
        reason: `Removing ${type} ${current.code} would delete its associated data.`,
      });
    }
    return;
  }
  // Both present → check for rename first, otherwise field-level diff.
  if (current && next) {
    // Singleton rename: codes differ and both are non-empty. The
    // platform requires DELETE old + CREATE new because `code` is part
    // of the URL identity for these endpoints. Without this short-
    // circuit, the rename either disappears (currency, expiryRule,
    // pendingRule — `code` not in SHAPE_FIELDS) or routes to a
    // builder UPDATE that targets the new code (eventRule, eventType
    // — `code` listed in SHAPE_FIELDS but entityIds was populated with
    // the old code, so the lookup misses and the op silently drops).
    if (current.code && next.code && current.code !== next.code) {
      result.breaking.push({
        kind: "rename",
        entity: { type, code: next.code },
        previousCode: current.code,
        reason: `${type} code changed from "${current.code}" to "${next.code}". The platform requires DELETE + CREATE because code is part of the URL identity.`,
      });
      // Suppress field-level diff. The CREATE payload built from the
      // new spec carries every field anyway, so a co-emitted modify
      // would either redo the same work or fight the create order.
      return;
    }
    const code = next.code ?? current.code ?? "(unknown)";
    classifyFieldDiff(result, { type, code }, current, next);
  }
}

// ────────────────────────────────────────────────────────────────
// Collection diff — tiers, badges
// ────────────────────────────────────────────────────────────────

function diffCollection<T extends { code: string }>(
  result: DeltaClassification,
  type: EntityType,
  current: T[],
  next: T[],
  perEntityDiff: (current: T, next: T) => Array<{ field: string; severity: "fatal" | "warning" }>
): void {
  const currentByCode = new Map<string, T>();
  for (const item of current) currentByCode.set(item.code, item);
  const nextByCode = new Map<string, T>();
  for (const item of next) nextByCode.set(item.code, item);

  // Adds (next has, current doesn't)
  for (const [code, item] of nextByCode) {
    if (!currentByCode.has(code)) {
      result.safe.push({
        kind: "add",
        entity: { type, code, name: (item as { name?: string }).name },
        details: `Add ${type} ${code}.`,
      });
    }
  }
  // Removes (current has, next doesn't)
  for (const [code, item] of currentByCode) {
    if (!nextByCode.has(code)) {
      result.dataLoss.push({
        kind: "remove",
        entity: { type, code, name: (item as { name?: string }).name },
        reason: `Removing ${type} ${code} would delete the entity and its associations.`,
      });
    }
  }
  // Modifies (intersection)
  for (const [code, currentItem] of currentByCode) {
    const nextItem = nextByCode.get(code);
    if (!nextItem) continue;
    const fieldDiffs = perEntityDiff(currentItem, nextItem);
    for (const { field, severity } of fieldDiffs) {
      if (severity === "fatal") {
        result.breaking.push({
          kind: "modify",
          entity: { type, code },
          field,
          reason: `${field} change requires recreating ${type} ${code} or coordinating with downstream consumers.`,
        });
      } else {
        result.safe.push({
          kind: "modify-cosmetic",
          entity: { type, code },
          details: `${field} updated on ${type} ${code}.`,
        });
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Per-entity field comparators
// ────────────────────────────────────────────────────────────────

function tierFieldDiff(
  current: WizardTier,
  next: WizardTier
): Array<{ field: string; severity: "fatal" | "warning" }> {
  const out: Array<{ field: string; severity: "fatal" | "warning" }> = [];
  // pointsThreshold is the wizard-side proxy for the executor-side
  // CounterTarget.targetValue. Treated as fatal: changing it changes
  // the customer's progression behavior.
  if (current.pointsThreshold !== next.pointsThreshold) {
    out.push({ field: "pointsThreshold", severity: "fatal" });
  }
  if (current.name !== next.name) out.push({ field: "name", severity: "warning" });
  if ((current.description ?? "") !== (next.description ?? "")) {
    out.push({ field: "description", severity: "warning" });
  }
  return out;
}

function badgeFieldDiff(
  current: WizardBadge,
  next: WizardBadge
): Array<{ field: string; severity: "fatal" | "warning" }> {
  const out: Array<{ field: string; severity: "fatal" | "warning" }> = [];
  if (current.name !== next.name) out.push({ field: "name", severity: "warning" });
  if ((current.description ?? "") !== (next.description ?? "")) {
    out.push({ field: "description", severity: "warning" });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Generic field-level diff via SHAPE_FIELDS
// ────────────────────────────────────────────────────────────────

function classifyFieldDiff(
  result: DeltaClassification,
  ref: EntityRef,
  current: WithCode,
  next: WithCode
): void {
  const shape = SHAPE_FIELDS[ref.type];
  if (!shape) return;
  for (const field of shape.fatal) {
    const currentValue = getField(current, field);
    const nextValue = getField(next, field);
    if (!deepEqual(currentValue, nextValue)) {
      result.breaking.push({
        kind: "modify",
        entity: ref,
        field,
        reason: `${field} differs between current and new — fatal change requires data-loss-aware migration.`,
      });
    }
  }
  for (const field of shape.warning) {
    const currentValue = getField(current, field);
    const nextValue = getField(next, field);
    if (!deepEqual(currentValue, nextValue)) {
      result.safe.push({
        kind: "modify-cosmetic",
        entity: ref,
        details: `${field} updated on ${ref.type} ${ref.code}.`,
      });
    }
  }
}

function getField(obj: WithCode | undefined, path: string): unknown {
  if (!obj) return undefined;
  const segments = path.split(".");
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}
