/**
 * Pure helper that translates a user-checked `DeltaClassification`
 * into the `ApplyOperation[]` body the apply-update endpoint expects.
 *
 * Three lookups it has to handle:
 *   - The URL identifier (per entity type — `code` for tiers, `*Id`
 *     for everything else) → comes from the hydrator's `entityIds`.
 *   - The CREATE/UPDATE payload → built from the parsed spec, since
 *     the spec is the source of truth for the desired state.
 *   - The owning `programId` for CREATE payloads → also from
 *     `entityIds` (the platform requires `programIds: [programId]` on
 *     every CREATE so the new entity is scoped to the right program).
 *
 * Per-entity logic lives in a single `ENTITY_BUILDERS` table so adding
 * a 7th entity type is one entry instead of touching `idFor` and
 * `payloadFor` separately.
 *
 * Deltas whose `entity.type` falls outside the apply-update surface
 * (`program`, `eventType`, `target`, `customer`, `metadata*`) are
 * dropped; the platform exposes those through other endpoints. Deltas
 * the spec can't satisfy (e.g., a tier-add delta for a tier the spec
 * no longer carries) are also dropped — the route would 400 on a
 * malformed payload anyway, so filtering up-front avoids one wasted
 * round-trip per missing entity.
 */

import type { ProgramSpec } from "../spec.js";
import type { ApplyEntityType, ApplyOperation, EntityIdsMap } from "./types.js";
import type { DeltaClassification } from "./update-delta.js";

interface EntityBuilder {
  /** URL id for `(entityType, code)` from EntityIdsMap. Null when absent. */
  getId: (ids: EntityIdsMap, code: string) => string | null;
  /**
   * CREATE/UPDATE payload built from the spec, with `programIds`
   * injected for the platform's scoping requirement. Null when the
   * spec doesn't carry the entity.
   */
  getPayload: (
    spec: ProgramSpec,
    code: string,
    programId: string
  ) => Record<string, unknown> | null;
}

const ENTITY_BUILDERS: Record<ApplyEntityType, EntityBuilder> = {
  tier: {
    getId: (ids, code) => ids.tiers[code] ?? null,
    getPayload: (spec, code, programId) => {
      const t = spec.tiers?.find((x) => x.code === code);
      if (!t) return null;
      // Minimal CreateTier shape. The platform fills server-derived
      // fields (rank for the new tier; description if not supplied).
      return { code: t.code, name: t.name, programIds: [programId] };
    },
  },
  badge: {
    getId: (ids, code) => ids.badges[code] ?? null,
    getPayload: (spec, code, programId) => {
      const b = spec.badges?.find((x) => x.code === code);
      if (!b) return null;
      // CreateBadge requires `typeCode`. The wizard's WizardBadge
      // shape doesn't carry it (it lives in the SDK Badge response
      // only), so CREATE on a parser-only spec usually fails
      // platform-side. The user is expected to round-trip through the
      // wizard for new badges. We still build the op with the fields
      // we have so the platform's 400 response is the authority on
      // missing fields.
      return { code: b.code, name: b.name, programIds: [programId] };
    },
  },
  currency: {
    getId: (ids) => ids.currency?.id ?? null,
    getPayload: (spec, code, programId) => {
      const c = spec.currency;
      if (!c || c.code !== code) return null;
      const payload: Record<string, unknown> = {
        code: c.code,
        name: c.name,
        programIds: [programId],
      };
      if (c.currencyTypeCode !== undefined) payload.currencyTypeCode = c.currencyTypeCode;
      return payload;
    },
  },
  expiryRule: {
    getId: (ids) => ids.expiryRule?.id ?? null,
    getPayload: (spec, code, programId) => {
      const r = spec.expiryRule;
      if (!r || r.code !== code) return null;
      // Spread the partial payload so optional fields (type,
      // expiryPeriod, expiryPeriodValue) ride along when the spec
      // carries them.
      return { ...r, programIds: [programId] };
    },
  },
  pendingRule: {
    getId: (ids) => ids.pendingRule?.id ?? null,
    getPayload: (spec, code, programId) => {
      const r = spec.pendingRule;
      if (!r || r.code !== code) return null;
      return { ...r, programIds: [programId] };
    },
  },
  eventRule: {
    getId: (ids, code) => ids.eventRules[code] ?? null,
    getPayload: (spec, code, programId) => {
      const r = spec.awardRule?.rulePayload;
      if (!r || r.code !== code) return null;
      return { ...r, programIds: [programId] };
    },
  },
  target: {
    // CounterTarget UPDATE only fires for the tier `pointsThreshold`
    // re-route below — the differ never emits a `target` delta directly.
    // These no-op stubs keep the `ApplyEntityType` exhaustive: any
    // future `target` delta produced by another path would be dropped
    // by the `getId === null` check rather than crash. Routing logic
    // owns id+payload synthesis (see the breaking-deltas loop below).
    getId: () => null,
    getPayload: () => null,
  },
};

/**
 * Synthesize a `target` UPDATE op for a tier `pointsThreshold` delta.
 * The Tier endpoint has no `pointsThreshold` field — the value lives on
 * the underlying CounterTarget. Without this re-route, the apply
 * pipeline silently no-ops the change (Tier UPDATE allowlist drops the
 * field; PUT succeeds with no actual change).
 *
 * The hub passes minimal payload; apply-update server-side merges with
 * the live CounterTarget record so the PUT carries every required
 * UpdateCounterTarget field (code, name, scope, type, etc.).
 *
 * Returns null when no CounterTarget id is registered for the tier
 * (e.g., base tier with no progression rule). The hydrator separately
 * emits a warning when this happens.
 */
function buildTargetUpdateForTierThreshold(
  spec: ProgramSpec,
  tierCode: string,
  ids: EntityIdsMap
): ApplyOperation | null {
  const targetId = ids.tierTargets?.[tierCode];
  if (!targetId) return null;
  const tier = spec.tiers?.find((t) => t.code === tierCode);
  if (!tier || tier.pointsThreshold === undefined) return null;
  return {
    op: "update",
    entityType: "target",
    id: targetId,
    payload: {
      targetValue: tier.pointsThreshold,
      programIds: [ids.programId],
    },
  };
}

const APPLY_TYPES = new Set<string>(Object.keys(ENTITY_BUILDERS));

export function isApplyType(type: string): type is ApplyEntityType {
  return APPLY_TYPES.has(type);
}

export function buildApplyOperations(
  selected: DeltaClassification,
  spec: ProgramSpec,
  ids: EntityIdsMap
): ApplyOperation[] {
  const ops: ApplyOperation[] = [];

  for (const delta of selected.safe) {
    if (!isApplyType(delta.entity.type)) continue;
    const type: ApplyEntityType = delta.entity.type;
    const code = delta.entity.code;
    const builder = ENTITY_BUILDERS[type];
    if (delta.kind === "add") {
      const payload = builder.getPayload(spec, code, ids.programId);
      if (payload) ops.push({ op: "create", entityType: type, payload });
    } else {
      // modify-cosmetic — the entity exists; UPDATE.
      const id = builder.getId(ids, code);
      const payload = builder.getPayload(spec, code, ids.programId);
      if (id && payload) ops.push({ op: "update", entityType: type, id, payload });
    }
  }

  for (const delta of selected.breaking) {
    // Tier `pointsThreshold` re-routes to the underlying CounterTarget — guarded by `kind === "modify"` so PR-B's rename variant (no `field`) doesn't trip TS narrowing once both branches land.
    if (
      delta.kind === "modify" &&
      delta.entity.type === "tier" &&
      delta.field === "pointsThreshold"
    ) {
      const op = buildTargetUpdateForTierThreshold(spec, delta.entity.code, ids);
      if (op) ops.push(op);
      continue;
    }
    if (!isApplyType(delta.entity.type)) continue;
    const type: ApplyEntityType = delta.entity.type;
    const builder = ENTITY_BUILDERS[type];
    if (delta.kind === "rename") {
      // DELETE old + CREATE new. Order matters: the delete clears the
      // old code from the platform's URL-identity space so the create
      // can't collide. Skip whichever half we lack data for —
      // `getPayload(spec, newCode)` returns null if the spec doesn't
      // carry the entity (e.g., a programmer error in the differ
      // emitting a rename for a singleton the spec dropped). Same for
      // `getId(ids, previousCode)` if the entity wasn't hydrated.
      const oldId = builder.getId(ids, delta.previousCode);
      const newPayload = builder.getPayload(spec, delta.entity.code, ids.programId);
      if (oldId) ops.push({ op: "delete", entityType: type, id: oldId });
      if (newPayload) ops.push({ op: "create", entityType: type, payload: newPayload });
      continue;
    }
    const code = delta.entity.code;
    const id = builder.getId(ids, code);
    const payload = builder.getPayload(spec, code, ids.programId);
    if (id && payload) ops.push({ op: "update", entityType: type, id, payload });
  }

  for (const delta of selected.dataLoss) {
    if (!isApplyType(delta.entity.type)) continue;
    const type: ApplyEntityType = delta.entity.type;
    const code = delta.entity.code;
    const id = ENTITY_BUILDERS[type].getId(ids, code);
    if (id) ops.push({ op: "delete", entityType: type, id });
  }

  return ops;
}
