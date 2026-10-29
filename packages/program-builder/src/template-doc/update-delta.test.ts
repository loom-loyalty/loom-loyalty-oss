import { describe, expect, it } from "vitest";

import type { ProgramSpec, SelectedFeatures } from "../spec";
import { classifyDelta } from "./update-delta";

function baseFeatures(): SelectedFeatures {
  return {
    programCurrency: true,
    expiry: false,
    pending: false,
    tiers: false,
    badges: false,
    programType: "transactional",
    signupBonus: false,
    birthdayBonus: false,
  };
}

function baseSpec(): ProgramSpec {
  return {
    selectedFeatures: baseFeatures(),
    program: { code: "coffee", name: "Coffee", typeCode: "standard" },
    currency: { code: "bean", name: "Bean", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: {},
      rulePayload: {
        code: "coffee-earn",
        name: "Earn Beans",
        eventTypeCode: "PURCHASE",
        category: "ORGANIZATION_DEFINED",
      },
    },
    skipTestRun: true,
  };
}

describe("classifyDelta", () => {
  it("identical specs → all three buckets empty (no-op)", () => {
    const result = classifyDelta(baseSpec(), baseSpec());
    expect(result.safe).toEqual([]);
    expect(result.breaking).toEqual([]);
    expect(result.dataLoss).toEqual([]);
  });

  it("tier add → safe[0] with kind:add and tier entity ref", () => {
    const current = baseSpec();
    current.selectedFeatures.tiers = true;
    current.tiers = [{ code: "bronze", name: "Bronze", pointsThreshold: 0 }];
    const next: ProgramSpec = {
      ...current,
      tiers: [...current.tiers, { code: "silver", name: "Silver", pointsThreshold: 500 }],
    };

    const result = classifyDelta(current, next);
    expect(result.safe).toHaveLength(1);
    expect(result.safe[0]).toMatchObject({
      kind: "add",
      entity: { type: "tier", code: "silver" },
    });
    expect(result.breaking).toEqual([]);
    expect(result.dataLoss).toEqual([]);
  });

  it("badge add → safe[0]", () => {
    const current = baseSpec();
    current.selectedFeatures.badges = true;
    current.badges = [{ code: "first-purchase", name: "First Purchase" }];
    const next: ProgramSpec = {
      ...current,
      badges: [...current.badges, { code: "loyal-customer", name: "Loyal Customer" }],
    };

    const result = classifyDelta(current, next);
    expect(result.safe).toHaveLength(1);
    expect(result.safe[0]).toMatchObject({
      kind: "add",
      entity: { type: "badge", code: "loyal-customer" },
    });
  });

  it("tier threshold change → breaking[0] with field=pointsThreshold", () => {
    const current = baseSpec();
    current.selectedFeatures.tiers = true;
    current.tiers = [{ code: "silver", name: "Silver", pointsThreshold: 500 }];
    const next: ProgramSpec = {
      ...current,
      tiers: [{ code: "silver", name: "Silver", pointsThreshold: 1000 }],
    };

    const result = classifyDelta(current, next);
    expect(result.breaking).toHaveLength(1);
    expect(result.breaking[0]).toMatchObject({
      kind: "modify",
      entity: { type: "tier", code: "silver" },
      field: "pointsThreshold",
    });
    expect(result.safe).toEqual([]);
    expect(result.dataLoss).toEqual([]);
  });

  it("award rule expression change → breaking[0]", () => {
    // SHAPE_FIELDS.eventRule.fatal includes eventActionsExpression. The
    // SDK types it as an opaque object; semantic equality is structural.
    const current = baseSpec();
    current.awardRule.rulePayload.eventActionsExpression = {
      true: { actions: [{ type: "ISSUE", points: 1 }] },
    };
    const next: ProgramSpec = {
      ...current,
      awardRule: {
        ...current.awardRule,
        rulePayload: {
          ...current.awardRule.rulePayload,
          eventActionsExpression: { true: { actions: [{ type: "ISSUE", points: 2 }] } },
        },
      },
    };

    const result = classifyDelta(current, next);
    expect(result.breaking).toHaveLength(1);
    expect(result.breaking[0]).toMatchObject({
      kind: "modify",
      entity: { type: "eventRule", code: "coffee-earn" },
      field: "eventActionsExpression",
    });
  });

  it("tier remove → dataLoss[0]", () => {
    const current = baseSpec();
    current.selectedFeatures.tiers = true;
    current.tiers = [
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver", pointsThreshold: 500 },
    ];
    const next: ProgramSpec = {
      ...current,
      tiers: [{ code: "bronze", name: "Bronze", pointsThreshold: 0 }],
    };

    const result = classifyDelta(current, next);
    expect(result.dataLoss).toHaveLength(1);
    expect(result.dataLoss[0]).toMatchObject({
      kind: "remove",
      entity: { type: "tier", code: "silver" },
    });
    expect(result.safe).toEqual([]);
    expect(result.breaking).toEqual([]);
  });

  it("badge remove → dataLoss[0]", () => {
    const current = baseSpec();
    current.selectedFeatures.badges = true;
    current.badges = [
      { code: "first-purchase", name: "First Purchase" },
      { code: "loyal-customer", name: "Loyal Customer" },
    ];
    const next: ProgramSpec = {
      ...current,
      badges: [{ code: "first-purchase", name: "First Purchase" }],
    };

    const result = classifyDelta(current, next);
    expect(result.dataLoss).toHaveLength(1);
    expect(result.dataLoss[0]).toMatchObject({
      kind: "remove",
      entity: { type: "badge", code: "loyal-customer" },
    });
  });

  it("currency rename (warning field) → safe[0] kind:modify-cosmetic", () => {
    // SHAPE_FIELDS.currency.warning includes "name". A rename is not breaking.
    const current = baseSpec();
    const next: ProgramSpec = {
      ...current,
      currency: { ...current.currency!, name: "Bean Coin" },
    };

    const result = classifyDelta(current, next);
    expect(result.safe).toHaveLength(1);
    expect(result.safe[0]).toMatchObject({
      kind: "modify-cosmetic",
      entity: { type: "currency", code: "bean" },
    });
    expect(result.breaking).toEqual([]);
    expect(result.dataLoss).toEqual([]);
  });

  it("currency removal → dataLoss[0]", () => {
    const current = baseSpec();
    const next: ProgramSpec = {
      ...current,
      currency: undefined,
      selectedFeatures: { ...current.selectedFeatures, programCurrency: false },
    };

    const result = classifyDelta(current, next);
    expect(result.dataLoss).toHaveLength(1);
    expect(result.dataLoss[0]).toMatchObject({
      kind: "remove",
      entity: { type: "currency", code: "bean" },
    });
  });

  it("mixed: tier add + tier modify (threshold) + badge remove → all three buckets populated", () => {
    const current = baseSpec();
    current.selectedFeatures.tiers = true;
    current.selectedFeatures.badges = true;
    current.tiers = [{ code: "silver", name: "Silver", pointsThreshold: 500 }];
    current.badges = [
      { code: "first-purchase", name: "First Purchase" },
      { code: "loyal-customer", name: "Loyal Customer" },
    ];
    const next: ProgramSpec = {
      ...current,
      tiers: [
        { code: "silver", name: "Silver", pointsThreshold: 1000 }, // threshold changed
        { code: "gold", name: "Gold", pointsThreshold: 2500 }, // added
      ],
      badges: [{ code: "first-purchase", name: "First Purchase" }], // loyal-customer removed
    };

    const result = classifyDelta(current, next);
    expect(result.safe).toHaveLength(1);
    expect(result.safe[0]).toMatchObject({
      kind: "add",
      entity: { type: "tier", code: "gold" },
    });
    expect(result.breaking).toHaveLength(1);
    expect(result.breaking[0]).toMatchObject({
      kind: "modify",
      entity: { type: "tier", code: "silver" },
      field: "pointsThreshold",
    });
    expect(result.dataLoss).toHaveLength(1);
    expect(result.dataLoss[0]).toMatchObject({
      kind: "remove",
      entity: { type: "badge", code: "loyal-customer" },
    });
  });

  it("expiry rule add → safe[0]", () => {
    const current = baseSpec();
    const next: ProgramSpec = {
      ...current,
      selectedFeatures: { ...current.selectedFeatures, expiry: true },
      expiryRule: {
        code: "bean-expiry",
        type: "ROLLING_PERIOD",
        expiryPeriod: "MONTHS",
        expiryPeriodValue: 12,
      },
    };

    const result = classifyDelta(current, next);
    expect(result.safe).toHaveLength(1);
    expect(result.safe[0]).toMatchObject({
      kind: "add",
      entity: { type: "expiryRule", code: "bean-expiry" },
    });
  });

  it("eventType add → safe[0] (program upgrades from transactional to event-based)", () => {
    const current = baseSpec();
    const next: ProgramSpec = {
      ...current,
      selectedFeatures: { ...current.selectedFeatures, programType: "event-based" },
      eventType: {
        code: "booking-completed",
        name: "Booking Completed",
        dataFields: [{ name: "amount", type: "number", required: true }],
      },
    };

    const result = classifyDelta(current, next);
    expect(result.safe).toHaveLength(1);
    expect(result.safe[0]).toMatchObject({
      kind: "add",
      entity: { type: "eventType", code: "booking-completed" },
    });
  });

  it("expiry rule fatal change (period) → breaking", () => {
    const current = baseSpec();
    current.selectedFeatures.expiry = true;
    current.expiryRule = {
      code: "bean-expiry",
      type: "ROLLING_PERIOD",
      expiryPeriod: "MONTHS",
      expiryPeriodValue: 12,
    };
    const next: ProgramSpec = {
      ...current,
      expiryRule: { ...current.expiryRule, expiryPeriodValue: 24 },
    };

    const result = classifyDelta(current, next);
    expect(result.breaking).toHaveLength(1);
    expect(result.breaking[0]).toMatchObject({
      kind: "modify",
      entity: { type: "expiryRule", code: "bean-expiry" },
      field: "expiryPeriodValue",
    });
  });

  describe("singleton code rename → breaking[kind:rename]", () => {
    // Renaming a singleton's `code` requires DELETE old + CREATE new
    // server-side because `code` is part of the URL identity for these
    // endpoints. Without the rename detection, the differ either dropped
    // the change silently (currency, expiryRule, pendingRule — `code`
    // not in SHAPE_FIELDS) or emitted a `modify` op the builder
    // dispatched against the new code (eventRule, eventType — lookup
    // misses entityIds populated with old code → silent no-op at apply).

    it("eventRule rename → breaking[0] kind:rename with previousCode", () => {
      const current = baseSpec();
      const next: ProgramSpec = {
        ...current,
        awardRule: {
          ...current.awardRule!,
          rulePayload: { ...current.awardRule!.rulePayload!, code: "coffee-purchase-rule" },
        },
      };

      const result = classifyDelta(current, next);
      expect(result.breaking).toHaveLength(1);
      expect(result.breaking[0]).toMatchObject({
        kind: "rename",
        entity: { type: "eventRule", code: "coffee-purchase-rule" },
        previousCode: "coffee-earn",
      });
      expect(result.safe).toEqual([]);
      expect(result.dataLoss).toEqual([]);
    });

    it("currency rename → breaking[0] kind:rename (today: silent — code not in SHAPE_FIELDS)", () => {
      const current = baseSpec();
      const next: ProgramSpec = {
        ...current,
        currency: { ...current.currency!, code: "loom-bean" },
      };

      const result = classifyDelta(current, next);
      expect(result.breaking).toHaveLength(1);
      expect(result.breaking[0]).toMatchObject({
        kind: "rename",
        entity: { type: "currency", code: "loom-bean" },
        previousCode: "bean",
      });
      expect(result.safe).toEqual([]);
      expect(result.dataLoss).toEqual([]);
    });

    it("expiryRule rename → breaking[0] kind:rename", () => {
      const current = baseSpec();
      current.selectedFeatures.expiry = true;
      current.expiryRule = {
        code: "bean-expiry",
        type: "ROLLING_PERIOD",
        expiryPeriod: "MONTHS",
        expiryPeriodValue: 12,
      };
      const next: ProgramSpec = {
        ...current,
        expiryRule: { ...current.expiryRule, code: "bean-expiry-12mo" },
      };

      const result = classifyDelta(current, next);
      expect(result.breaking).toHaveLength(1);
      expect(result.breaking[0]).toMatchObject({
        kind: "rename",
        entity: { type: "expiryRule", code: "bean-expiry-12mo" },
        previousCode: "bean-expiry",
      });
    });

    it("eventType rename → breaking[0] kind:rename (replaces prior modify-with-field=code shape)", () => {
      // Event-based programs reference a custom event type. Changing
      // eventType.code points the program at a different external trigger
      // — server-side this requires DELETE old + CREATE new, not UPDATE.
      const current = baseSpec();
      current.selectedFeatures.programType = "event-based";
      current.eventType = {
        code: "booking-completed",
        name: "Booking Completed",
        dataFields: [{ name: "amount", type: "number", required: true }],
      };
      const next: ProgramSpec = {
        ...current,
        eventType: { ...current.eventType, code: "checkout-completed" },
      };

      const result = classifyDelta(current, next);
      expect(result.breaking).toHaveLength(1);
      expect(result.breaking[0]).toMatchObject({
        kind: "rename",
        entity: { type: "eventType", code: "checkout-completed" },
        previousCode: "booking-completed",
      });
    });

    it("eventRule rename + name change in same upload → single rename delta (suppress field-level diff)", () => {
      // When `code` and `name` both change, the differ should emit ONE
      // rename (carrying the new payload's name implicitly via downstream
      // CREATE) — not a rename PLUS a stray cosmetic-modify on the new
      // entity. Otherwise the apply pipeline would DELETE old + CREATE new
      // + UPDATE new in a wrong order.
      const current = baseSpec();
      const next: ProgramSpec = {
        ...current,
        awardRule: {
          ...current.awardRule!,
          rulePayload: {
            ...current.awardRule!.rulePayload!,
            code: "coffee-purchase-rule",
            name: "Earn From Purchases",
          },
        },
      };

      const result = classifyDelta(current, next);
      expect(result.breaking).toHaveLength(1);
      expect(result.breaking[0]).toMatchObject({ kind: "rename" });
      expect(result.safe).toEqual([]);
    });
  });
});
