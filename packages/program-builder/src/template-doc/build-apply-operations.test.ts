import { describe, expect, it } from "vitest";

import type { ProgramSpec } from "../spec.js";
import { buildApplyOperations } from "./build-apply-operations.js";
import type { EntityIdsMap } from "./types.js";
import type { DeltaClassification } from "./update-delta.js";

const PROGRAM_ID = "prg_00000000000000000000000000000001";

function emptyClassification(): DeltaClassification {
  return { safe: [], breaking: [], dataLoss: [] };
}

function fullSpec(): ProgramSpec {
  return {
    selectedFeatures: {
      programType: "transactional",
      programCurrency: true,
      expiry: true,
      pending: true,
      tiers: true,
      badges: true,
      signupBonus: false,
      birthdayBonus: false,
    },
    program: { code: "coffee-shop", name: "Coffee Shop", typeCode: "generic" },
    currency: { code: "bean", name: "Bean", currencyTypeCode: "points" },
    expiryRule: { code: "bean-expiry", name: "Bean Expiry", type: "ROLLING_PERIOD" },
    pendingRule: { code: "bean-pending", name: "Bean Pending", type: "FIXED_DATE" },
    tiers: [
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver", pointsThreshold: 500 },
    ],
    badges: [{ code: "first-order", name: "First Order" }],
    awardRule: {
      templateId: "",
      templateConfig: {},
      rulePayload: {
        code: "coffee-earn",
        name: "Earn Beans",
        eventTypeCode: "PURCHASE",
        category: "ORGANIZATION_DEFINED",
      },
    },
  };
}

function fullIds(): EntityIdsMap {
  return {
    programId: PROGRAM_ID,
    tiers: { bronze: "tier_bronze", silver: "tier_silver" },
    // Only progression tiers (rank > 1) have a CounterTarget. Bronze is
    // the base tier and has no target. Silver has tgt_silver carrying
    // the threshold value.
    tierTargets: { silver: "tgt_silver" },
    badges: { "first-order": "bdg_1" },
    currency: { id: "cur_1" },
    expiryRule: { id: "exp_1" },
    pendingRule: { id: "pnd_1" },
    eventRules: { "coffee-earn": "rule_1" },
  };
}

describe("buildApplyOperations", () => {
  it("returns no ops on an empty classification", () => {
    expect(buildApplyOperations(emptyClassification(), fullSpec(), fullIds())).toEqual([]);
  });

  it("translates a tier add (safe → CREATE) with programIds set", () => {
    const c: DeltaClassification = {
      safe: [{ kind: "add", entity: { type: "tier", code: "gold" }, details: "" }],
      breaking: [],
      dataLoss: [],
    };
    const spec = fullSpec();
    spec.tiers!.push({ code: "gold", name: "Gold", pointsThreshold: 1500 });

    const ops = buildApplyOperations(c, spec, fullIds());
    expect(ops).toEqual([
      {
        op: "create",
        entityType: "tier",
        payload: { code: "gold", name: "Gold", programIds: [PROGRAM_ID] },
      },
    ]);
  });

  it("translates a tier pointsThreshold delta to a TARGET update (not a tier UPDATE) — pointsThreshold lives on the underlying CounterTarget", () => {
    // Critical regression net: prior to this routing, the builder
    // emitted a tier UPDATE op without `pointsThreshold` in the payload.
    // The platform's UpdateTier schema rejects pointsThreshold
    // (additionalProperties: false), and the apply-update allowlist
    // filtered it anyway. The PUT succeeded with no actual change ->
    // silent data corruption on every threshold update. The fix routes
    // pointsThreshold deltas to the `target` entity type so the PUT
    // hits /targets/<targetId> with the new targetValue.
    const c: DeltaClassification = {
      safe: [],
      breaking: [
        {
          kind: "modify",
          entity: { type: "tier", code: "silver" },
          field: "pointsThreshold",
          reason: "threshold change",
        },
      ],
      dataLoss: [],
    };
    const spec = fullSpec();
    spec.tiers = [
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver", pointsThreshold: 1000 }, // user changed 500 → 1000
    ];
    const ops = buildApplyOperations(c, spec, fullIds());
    expect(ops).toEqual([
      {
        op: "update",
        entityType: "target",
        id: "tgt_silver",
        payload: expect.objectContaining({
          targetValue: 1000,
          programIds: [PROGRAM_ID],
        }),
      },
    ]);
  });

  it("translates a tier modify on a non-pointsThreshold field (e.g. cosmetic name) to a tier UPDATE", () => {
    // Cosmetic modify-cosmetic deltas (kind === "modify-cosmetic") still
    // route to a tier UPDATE because they touch fields the tier endpoint
    // accepts (name, description). Only pointsThreshold gets re-routed.
    const c: DeltaClassification = {
      safe: [
        {
          kind: "modify-cosmetic",
          entity: { type: "tier", code: "silver" },
          details: "name updated on tier silver.",
        },
      ],
      breaking: [],
      dataLoss: [],
    };
    const ops = buildApplyOperations(c, fullSpec(), fullIds());
    expect(ops).toEqual([
      {
        op: "update",
        entityType: "tier",
        id: "tier_silver",
        payload: { code: "silver", name: "Silver", programIds: [PROGRAM_ID] },
      },
    ]);
  });

  it("emits BOTH a tier UPDATE (for cosmetic field) AND a target UPDATE (for pointsThreshold) when both deltas appear on the same tier", () => {
    // The combined case: user renames Silver AND changes its threshold.
    // Builder must emit both ops — the tier op for the rename, the
    // target op for the threshold. Without this, one of the two changes
    // gets silently dropped.
    const c: DeltaClassification = {
      safe: [
        {
          kind: "modify-cosmetic",
          entity: { type: "tier", code: "silver" },
          details: "name updated on tier silver.",
        },
      ],
      breaking: [
        {
          kind: "modify",
          entity: { type: "tier", code: "silver" },
          field: "pointsThreshold",
          reason: "threshold change",
        },
      ],
      dataLoss: [],
    };
    const spec = fullSpec();
    spec.tiers = [
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver Renamed", pointsThreshold: 1000 },
    ];
    const ops = buildApplyOperations(c, spec, fullIds());
    expect(ops).toContainEqual(
      expect.objectContaining({
        op: "update",
        entityType: "tier",
        id: "tier_silver",
        payload: expect.objectContaining({ name: "Silver Renamed" }),
      })
    );
    expect(ops).toContainEqual(
      expect.objectContaining({
        op: "update",
        entityType: "target",
        id: "tgt_silver",
        payload: expect.objectContaining({ targetValue: 1000 }),
      })
    );
    expect(ops).toHaveLength(2);
  });

  it("preserves pointsThreshold === 0 (base-tier zero is a real value, not 'absent')", () => {
    // Boundary: builder uses `pointsThreshold === undefined` to detect
    // an unset value, so 0 must pass through. Without this test,
    // a future refactor to `!tier.pointsThreshold` would silently drop
    // every base-tier-threshold-set-to-zero op.
    const c: DeltaClassification = {
      safe: [],
      breaking: [
        {
          kind: "modify",
          entity: { type: "tier", code: "silver" },
          field: "pointsThreshold",
          reason: "threshold change",
        },
      ],
      dataLoss: [],
    };
    const spec = fullSpec();
    spec.tiers = [
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver", pointsThreshold: 0 }, // user reset Silver to 0
    ];
    const ops = buildApplyOperations(c, spec, fullIds());
    expect(ops).toEqual([
      {
        op: "update",
        entityType: "target",
        id: "tgt_silver",
        payload: expect.objectContaining({ targetValue: 0 }),
      },
    ]);
  });

  it("drops pointsThreshold delta when no target id is registered for the tier (e.g. base tier with no progression rule)", () => {
    // Defense: if the differ ever emits a pointsThreshold delta for a
    // tier without a corresponding CounterTarget (which would be a
    // hydrator bug), the builder drops the op rather than producing a
    // malformed `target` UPDATE with no id. The hydrator separately
    // emits a warning when this happens.
    const c: DeltaClassification = {
      safe: [],
      breaking: [
        {
          kind: "modify",
          entity: { type: "tier", code: "bronze" }, // bronze has no target
          field: "pointsThreshold",
          reason: "threshold change",
        },
      ],
      dataLoss: [],
    };
    const ops = buildApplyOperations(c, fullSpec(), fullIds());
    expect(ops).toEqual([]);
  });

  it("translates a badge remove (dataLoss → DELETE) using badgeId from entityIds", () => {
    const c: DeltaClassification = {
      safe: [],
      breaking: [],
      dataLoss: [
        {
          kind: "remove",
          entity: { type: "badge", code: "first-order" },
          reason: "removed",
        },
      ],
    };
    const ops = buildApplyOperations(c, fullSpec(), fullIds());
    expect(ops).toEqual([{ op: "delete", entityType: "badge", id: "bdg_1" }]);
  });

  it("uses singleton id for currency/expiry/pending UPDATE", () => {
    const c: DeltaClassification = {
      safe: [
        {
          kind: "modify-cosmetic",
          entity: { type: "currency", code: "bean" },
          details: "name updated",
        },
      ],
      breaking: [
        {
          kind: "modify",
          entity: { type: "expiryRule", code: "bean-expiry" },
          field: "type",
          reason: "type change",
        },
      ],
      dataLoss: [],
    };
    const ops = buildApplyOperations(c, fullSpec(), fullIds());
    expect(ops).toContainEqual(
      expect.objectContaining({ op: "update", entityType: "currency", id: "cur_1" })
    );
    expect(ops).toContainEqual(
      expect.objectContaining({ op: "update", entityType: "expiryRule", id: "exp_1" })
    );
  });

  it("uses event-rule id from entityIds.eventRules[code]", () => {
    const c: DeltaClassification = {
      safe: [],
      breaking: [
        {
          kind: "modify",
          entity: { type: "eventRule", code: "coffee-earn" },
          field: "eventActionsExpression",
          reason: "behavior change",
        },
      ],
      dataLoss: [],
    };
    const ops = buildApplyOperations(c, fullSpec(), fullIds());
    expect(ops).toEqual([
      {
        op: "update",
        entityType: "eventRule",
        id: "rule_1",
        payload: expect.objectContaining({
          code: "coffee-earn",
          name: "Earn Beans",
          programIds: [PROGRAM_ID],
        }),
      },
    ]);
  });

  it("drops deltas whose entity type is outside the apply-update surface (program, eventType)", () => {
    const c: DeltaClassification = {
      safe: [],
      breaking: [
        {
          kind: "modify",
          entity: { type: "program", code: "coffee-shop" },
          field: "name",
          reason: "rename",
        },
        {
          kind: "modify",
          entity: { type: "eventType", code: "PURCHASE" },
          field: "code",
          reason: "trigger change",
        },
      ],
      dataLoss: [],
    };
    expect(buildApplyOperations(c, fullSpec(), fullIds())).toEqual([]);
  });

  it("drops deltas whose entity is missing from the spec (no payload to send)", () => {
    const c: DeltaClassification = {
      safe: [{ kind: "add", entity: { type: "tier", code: "missing" }, details: "" }],
      breaking: [],
      dataLoss: [],
    };
    // `missing` isn't in the spec → no payload synthesizable → drop.
    expect(buildApplyOperations(c, fullSpec(), fullIds())).toEqual([]);
  });

  it("drops update/delete deltas whose id is missing from entityIds", () => {
    const ids = fullIds();
    delete (ids as { tiers: Record<string, string> }).tiers["silver"];
    const c: DeltaClassification = {
      safe: [],
      breaking: [],
      dataLoss: [{ kind: "remove", entity: { type: "tier", code: "silver" }, reason: "" }],
    };
    expect(buildApplyOperations(c, fullSpec(), ids)).toEqual([]);
  });

  describe("breaking[kind:rename] → DELETE old + CREATE new", () => {
    it("eventRule rename → DELETE old id + CREATE with new code", () => {
      const c: DeltaClassification = {
        safe: [],
        breaking: [
          {
            kind: "rename",
            entity: { type: "eventRule", code: "coffee-purchase-rule" },
            previousCode: "coffee-earn",
            reason: "rename",
          },
        ],
        dataLoss: [],
      };
      const spec = fullSpec();
      spec.awardRule!.rulePayload!.code = "coffee-purchase-rule";

      const ops = buildApplyOperations(c, spec, fullIds());
      expect(ops).toHaveLength(2);
      // DELETE first so the platform's URL-identity space clears before
      // CREATE — otherwise the platform may reject the create on an
      // unexpected uniqueness collision.
      expect(ops[0]).toEqual({ op: "delete", entityType: "eventRule", id: "rule_1" });
      expect(ops[1]).toMatchObject({
        op: "create",
        entityType: "eventRule",
        payload: expect.objectContaining({
          code: "coffee-purchase-rule",
          programIds: [PROGRAM_ID],
        }),
      });
    });

    it("currency rename → DELETE singleton id + CREATE with new code", () => {
      const c: DeltaClassification = {
        safe: [],
        breaking: [
          {
            kind: "rename",
            entity: { type: "currency", code: "loom-bean" },
            previousCode: "bean",
            reason: "rename",
          },
        ],
        dataLoss: [],
      };
      const spec = fullSpec();
      spec.currency!.code = "loom-bean";

      const ops = buildApplyOperations(c, spec, fullIds());
      expect(ops).toEqual([
        { op: "delete", entityType: "currency", id: "cur_1" },
        {
          op: "create",
          entityType: "currency",
          payload: {
            code: "loom-bean",
            name: "Bean",
            currencyTypeCode: "points",
            programIds: [PROGRAM_ID],
          },
        },
      ]);
    });

    it("expiryRule rename → 2 ops (delete + create) in correct order", () => {
      const c: DeltaClassification = {
        safe: [],
        breaking: [
          {
            kind: "rename",
            entity: { type: "expiryRule", code: "bean-expiry-12mo" },
            previousCode: "bean-expiry",
            reason: "rename",
          },
        ],
        dataLoss: [],
      };
      const spec = fullSpec();
      spec.expiryRule!.code = "bean-expiry-12mo";

      const ops = buildApplyOperations(c, spec, fullIds());
      expect(ops.map((o) => `${o.op}:${o.entityType}`)).toEqual([
        "delete:expiryRule",
        "create:expiryRule",
      ]);
    });

    it("pendingRule rename → 2 ops (delete + create) in correct order", () => {
      const c: DeltaClassification = {
        safe: [],
        breaking: [
          {
            kind: "rename",
            entity: { type: "pendingRule", code: "bean-pending-7d" },
            previousCode: "bean-pending",
            reason: "rename",
          },
        ],
        dataLoss: [],
      };
      const spec = fullSpec();
      spec.pendingRule!.code = "bean-pending-7d";

      const ops = buildApplyOperations(c, spec, fullIds());
      expect(ops).toHaveLength(2);
      expect(ops[0]).toEqual({ op: "delete", entityType: "pendingRule", id: "pnd_1" });
      expect(ops[1]).toMatchObject({
        op: "create",
        entityType: "pendingRule",
        payload: expect.objectContaining({
          code: "bean-pending-7d",
          programIds: [PROGRAM_ID],
        }),
      });
    });

    it("rename without spec entry → DELETE only (no orphan create)", () => {
      // Hypothetical differ bug: rename emitted but spec dropped the
      // entity. Builder skips the create; the user still sees the
      // delete so they can recover state. The differ shouldn't ever
      // produce this combination, but keeping the builder defensive
      // means a single bad delta can't crash the whole apply.
      const c: DeltaClassification = {
        safe: [],
        breaking: [
          {
            kind: "rename",
            entity: { type: "currency", code: "loom-bean" },
            previousCode: "bean",
            reason: "rename",
          },
        ],
        dataLoss: [],
      };
      const spec = fullSpec();
      delete spec.currency;

      const ops = buildApplyOperations(c, spec, fullIds());
      expect(ops).toEqual([{ op: "delete", entityType: "currency", id: "cur_1" }]);
    });

    it("rename with no entity hydrated → CREATE only (delete skipped, no id to target)", () => {
      // Mirror of the above — spec has the entity (so create works) but
      // entityIds doesn't carry a record for the old code. Skip the
      // delete; emit the create so the user at least gets the new entity.
      const c: DeltaClassification = {
        safe: [],
        breaking: [
          {
            kind: "rename",
            entity: { type: "eventRule", code: "coffee-purchase-rule" },
            previousCode: "coffee-earn",
            reason: "rename",
          },
        ],
        dataLoss: [],
      };
      const spec = fullSpec();
      spec.awardRule!.rulePayload!.code = "coffee-purchase-rule";
      const ids = { ...fullIds(), eventRules: {} };

      const ops = buildApplyOperations(c, spec, ids);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toMatchObject({ op: "create", entityType: "eventRule" });
    });
  });

  it("preserves caller-supplied delta ordering across safe → breaking → dataLoss buckets", () => {
    // The endpoint runs ops sequentially; the order has to be stable so
    // delete-then-create renames the user requested aren't reordered.
    const c: DeltaClassification = {
      safe: [{ kind: "add", entity: { type: "tier", code: "platinum" }, details: "" }],
      breaking: [
        {
          kind: "modify",
          entity: { type: "tier", code: "silver" },
          field: "name",
          reason: "rename",
        },
      ],
      dataLoss: [{ kind: "remove", entity: { type: "tier", code: "bronze" }, reason: "" }],
    };
    const spec = fullSpec();
    spec.tiers!.push({ code: "platinum", name: "Platinum", pointsThreshold: 5000 });

    const ops = buildApplyOperations(c, spec, fullIds());
    expect(
      ops.map(
        (o) => `${o.op}:${o.entityType}:${"id" in o ? o.id : (o.payload as { code: string }).code}`
      )
    ).toEqual(["create:tier:platinum", "update:tier:tier_silver", "delete:tier:tier_bronze"]);
  });
});
