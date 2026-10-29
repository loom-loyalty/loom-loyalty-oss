/**
 * Shape-diff tests.
 *
 * Per entity type: one "happy path" (no diff), one "fatal-field mismatch",
 * one "warning-only mismatch". Plus a handful of edge cases around nulls,
 * arrays, and nested objects.
 */

import { describe, expect, it } from "vitest";
import { SHAPE_FIELDS, computeEntityShapeDiff, hasFatalDiff } from "./shape-diff";

describe("computeEntityShapeDiff", () => {
  describe("program", () => {
    // Post-M3 schema alignment: the SDK's Program.type is a nested
    // Metadata object, NOT a flat typeCode. SHAPE_FIELDS uses nested
    // path "type.code", and both expected/actual sides must mirror
    // the nesting. This matches the fix applied to currency/target.
    it("returns no fields when shapes match (nested type)", () => {
      const diff = computeEntityShapeDiff(
        "program",
        {
          type: { code: "standard" },
          createAccountOnCustomerCreation: true,
          name: "Rewards",
        },
        {
          type: { code: "standard" },
          createAccountOnCustomerCreation: true,
          name: "Rewards",
        }
      );
      expect(diff.fields).toEqual([]);
    });

    it("flags type.code mismatch as fatal (via nested path lookup)", () => {
      const diff = computeEntityShapeDiff(
        "program",
        { type: { code: "standard" }, createAccountOnCustomerCreation: true },
        { type: { code: "tiered" }, createAccountOnCustomerCreation: true }
      );
      expect(diff.fields).toHaveLength(1);
      expect(diff.fields[0]?.path).toBe("type.code");
      expect(diff.fields[0]?.significance).toBe("fatal");
    });

    it("flags name mismatch as warning only", () => {
      const diff = computeEntityShapeDiff(
        "program",
        {
          type: { code: "standard" },
          createAccountOnCustomerCreation: true,
          name: "New Name",
        },
        {
          type: { code: "standard" },
          createAccountOnCustomerCreation: true,
          name: "Old Name",
        }
      );
      expect(diff.fields).toHaveLength(1);
      expect(diff.fields[0]?.significance).toBe("warning");
    });
  });

  describe("currency", () => {
    // Post-M3 schema alignment: ProgramCurrency returns `currencyType`
    // as a nested Metadata object, NOT a flat `currencyTypeCode`.
    // SHAPE_FIELDS now uses the nested path `"currencyType.code"`.
    it("returns no fields when shapes match (nested currencyType)", () => {
      const diff = computeEntityShapeDiff(
        "currency",
        { currencyType: { code: "points" }, programIds: ["p1"], name: "Points" },
        { currencyType: { code: "points" }, programIds: ["p1"], name: "Points" }
      );
      expect(diff.fields).toEqual([]);
    });

    it("flags currencyType.code mismatch as fatal (via nested path lookup)", () => {
      const diff = computeEntityShapeDiff(
        "currency",
        { currencyType: { code: "points" }, programIds: ["p1"] },
        { currencyType: { code: "miles" }, programIds: ["p1"] }
      );
      expect(hasFatalDiff(diff)).toBe(true);
      expect(diff.fields.find((f) => f.path === "currencyType.code")).toBeDefined();
    });

    it("flags programIds mismatch (array difference) as fatal", () => {
      const diff = computeEntityShapeDiff(
        "currency",
        { currencyType: { code: "points" }, programIds: ["p1"] },
        { currencyType: { code: "points" }, programIds: ["p2"] }
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });

    it("handles missing currencyType nesting gracefully (returns undefined, fatal if either side has it)", () => {
      // If the server returns a shape without currencyType (e.g. older
      // API version), the nested lookup should return undefined on
      // that side. If the expected has a value and the actual doesn't,
      // the diff is fatal.
      const diff = computeEntityShapeDiff(
        "currency",
        { currencyType: { code: "points" }, programIds: ["p1"] },
        { programIds: ["p1"] } // no currencyType at all
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });
  });

  describe("tier", () => {
    // Post-M3 schema alignment + adversarial re-review:
    // - The SDK's Tier interface has NO threshold field.
    // - Tiers DO have identity fields beyond name: `rank` orders them,
    //   `subscription` gates behind paid access, `durationPeriod` is
    //   the tier lifetime. All three are fatal in SHAPE_FIELDS.
    // - CounterTarget's `targetValue` is the proxy for the threshold
    //   comparison (see the "target" describe block below).
    it("no diff when shapes match (rank, name, both undefined subscription/duration)", () => {
      const diff = computeEntityShapeDiff(
        "tier",
        { code: "silver", name: "Silver", rank: 2 },
        { code: "silver", name: "Silver", rank: 2 }
      );
      expect(diff.fields).toEqual([]);
    });

    it("flags rank mismatch as FATAL (semantic progression order)", () => {
      const diff = computeEntityShapeDiff(
        "tier",
        { code: "silver", name: "Silver", rank: 2 },
        { code: "silver", name: "Silver", rank: 5 }
      );
      expect(hasFatalDiff(diff)).toBe(true);
      expect(diff.fields.find((f) => f.path === "rank")).toBeDefined();
    });

    it("flags subscription mismatch as FATAL (paid vs free tier)", () => {
      const diff = computeEntityShapeDiff(
        "tier",
        { code: "silver", name: "Silver", rank: 2, subscription: undefined },
        { code: "silver", name: "Silver", rank: 2, subscription: true }
      );
      expect(hasFatalDiff(diff)).toBe(true);
      expect(diff.fields.find((f) => f.path === "subscription")).toBeDefined();
    });

    it("flags durationPeriod mismatch as FATAL (tier lifetime)", () => {
      const diff = computeEntityShapeDiff(
        "tier",
        { code: "silver", name: "Silver", rank: 2, durationPeriod: undefined },
        { code: "silver", name: "Silver", rank: 2, durationPeriod: "monthly" }
      );
      expect(hasFatalDiff(diff)).toBe(true);
      expect(diff.fields.find((f) => f.path === "durationPeriod")).toBeDefined();
    });

    it("flags name mismatch as WARNING, not fatal (cosmetic only)", () => {
      const diff = computeEntityShapeDiff(
        "tier",
        { code: "silver", name: "Silver", rank: 2 },
        { code: "silver", name: "Silver Tier", rank: 2 }
      );
      expect(hasFatalDiff(diff)).toBe(false);
      expect(diff.fields).toHaveLength(1);
      expect(diff.fields[0]?.path).toBe("name");
      expect(diff.fields[0]?.significance).toBe("warning");
    });
  });

  describe("badge", () => {
    it("flags programIds mismatch as fatal", () => {
      const diff = computeEntityShapeDiff(
        "badge",
        { programIds: ["p1"] },
        { programIds: ["p1", "p2"] }
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });

    it("no diff on identical shapes", () => {
      const diff = computeEntityShapeDiff("badge", { programIds: ["p1"] }, { programIds: ["p1"] });
      expect(diff.fields).toEqual([]);
    });
  });

  describe("target", () => {
    // Post-M3 schema alignment: CounterTarget returns
    // `counterTargetType` as a nested Metadata object, NOT a flat
    // `counterTypeCode`. SHAPE_FIELDS now uses nested path
    // `"counterTargetType.code"`.
    it("returns no fields when shapes match (nested counterTargetType)", () => {
      const diff = computeEntityShapeDiff(
        "target",
        {
          type: "COUNTER",
          programIds: ["p1"],
          counterTargetType: { code: "points" },
          targetValue: 100,
        },
        {
          type: "COUNTER",
          programIds: ["p1"],
          counterTargetType: { code: "points" },
          targetValue: 100,
        }
      );
      expect(diff.fields).toEqual([]);
    });

    it("flags counterTargetType.code mismatch as fatal (via nested path lookup)", () => {
      const diff = computeEntityShapeDiff(
        "target",
        {
          type: "COUNTER",
          programIds: ["p1"],
          counterTargetType: { code: "points" },
          targetValue: 100,
        },
        {
          type: "COUNTER",
          programIds: ["p1"],
          counterTargetType: { code: "visits" },
          targetValue: 100,
        }
      );
      expect(hasFatalDiff(diff)).toBe(true);
      expect(diff.fields.find((f) => f.path === "counterTargetType.code")).toBeDefined();
    });

    it("flags targetValue mismatch as fatal", () => {
      const diff = computeEntityShapeDiff(
        "target",
        {
          type: "COUNTER",
          programIds: ["p1"],
          counterTargetType: { code: "points" },
          targetValue: 100,
        },
        {
          type: "COUNTER",
          programIds: ["p1"],
          counterTargetType: { code: "points" },
          targetValue: 200,
        }
      );
      expect(hasFatalDiff(diff)).toBe(true);
      expect(diff.fields.find((f) => f.path === "targetValue")).toBeDefined();
    });
  });

  describe("eventRule", () => {
    it("flags eventExpression deep mismatch as fatal", () => {
      const diff = computeEntityShapeDiff(
        "eventRule",
        {
          eventTypeCode: "purchase",
          programIds: ["p1"],
          category: "ORGANIZATION_DEFINED",
          eventExpression: { type: "LITERAL", value: true },
          eventActionsExpression: { type: "AWARD_CURRENCY" },
        },
        {
          eventTypeCode: "purchase",
          programIds: ["p1"],
          category: "ORGANIZATION_DEFINED",
          eventExpression: { type: "LITERAL", value: false }, // differs
          eventActionsExpression: { type: "AWARD_CURRENCY" },
        }
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });

    it("flags category mismatch as fatal", () => {
      const diff = computeEntityShapeDiff(
        "eventRule",
        {
          eventTypeCode: "purchase",
          programIds: ["p1"],
          category: "ORGANIZATION_DEFINED",
          eventExpression: {},
          eventActionsExpression: {},
        },
        {
          eventTypeCode: "purchase",
          programIds: ["p1"],
          category: "BASE",
          eventExpression: {},
          eventActionsExpression: {},
        }
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });
  });

  describe("expiryRule", () => {
    it("flags expiryPeriodValue mismatch as fatal", () => {
      const diff = computeEntityShapeDiff(
        "expiryRule",
        {
          type: "ROLLING_PERIOD",
          expiryPeriod: "MONTHS",
          expiryPeriodValue: 12,
          programIds: ["p1"],
        },
        {
          type: "ROLLING_PERIOD",
          expiryPeriod: "MONTHS",
          expiryPeriodValue: 6,
          programIds: ["p1"],
        }
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });
  });

  describe("pendingRule", () => {
    it("flags type mismatch as fatal", () => {
      const diff = computeEntityShapeDiff(
        "pendingRule",
        {
          type: "FIXED_PERIOD",
          pendingPeriod: "DAYS",
          pendingPeriodValue: 30,
          programIds: ["p1"],
        },
        {
          type: "ROLLING_PERIOD",
          pendingPeriod: "DAYS",
          pendingPeriodValue: 30,
          programIds: ["p1"],
        }
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });
  });

  describe("eventType", () => {
    it("flags code mismatch as fatal", () => {
      const diff = computeEntityShapeDiff(
        "eventType",
        { code: "booking", name: "Booking" },
        { code: "purchase", name: "Booking" }
      );
      expect(hasFatalDiff(diff)).toBe(true);
    });

    it("no diff on identical shapes", () => {
      const diff = computeEntityShapeDiff(
        "eventType",
        { code: "booking", name: "Booking" },
        { code: "booking", name: "Booking" }
      );
      expect(diff.fields).toEqual([]);
    });
  });

  describe("dev-only entities (metadata, metadataType, customer)", () => {
    it("metadata: returns empty diff always", () => {
      const diff = computeEntityShapeDiff(
        "metadata",
        { code: "a", typeCode: "PROGRAM_TYPE", name: "Original" },
        { code: "a", typeCode: "COMPLETELY_DIFFERENT", name: "Changed" }
      );
      expect(diff.fields).toEqual([]);
    });

    it("metadataType: returns empty diff always", () => {
      const diff = computeEntityShapeDiff(
        "metadataType",
        { code: "PROGRAM_TYPE" },
        { code: "DIFFERENT" }
      );
      expect(diff.fields).toEqual([]);
    });

    it("customer: returns empty diff always", () => {
      const diff = computeEntityShapeDiff(
        "customer",
        { externalId: "a", firstName: "Alice" },
        { externalId: "b", firstName: "Bob" }
      );
      expect(diff.fields).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("treats null and undefined as equal", () => {
      const diff = computeEntityShapeDiff(
        "program",
        { type: { code: "standard" }, createAccountOnCustomerCreation: null },
        { type: { code: "standard" }, createAccountOnCustomerCreation: undefined }
      );
      expect(diff.fields).toEqual([]);
    });

    it("treats missing fields as undefined (equal to each other)", () => {
      // Both sides missing a warning field → no diff
      const diff = computeEntityShapeDiff(
        "program",
        { type: { code: "standard" }, createAccountOnCustomerCreation: true },
        { type: { code: "standard" }, createAccountOnCustomerCreation: true }
      );
      expect(diff.fields).toEqual([]);
    });

    it("flags a missing-vs-present field as a diff", () => {
      const diff = computeEntityShapeDiff(
        "program",
        {
          type: { code: "standard" },
          createAccountOnCustomerCreation: true,
          name: "With Name",
        },
        { type: { code: "standard" }, createAccountOnCustomerCreation: true }
      );
      // "name" (warning field) differs: expected=string, actual=undefined
      expect(diff.fields).toHaveLength(1);
      expect(diff.fields[0]?.path).toBe("name");
      expect(diff.fields[0]?.significance).toBe("warning");
    });

    // P2 fix from adversarial re-review: getField must refuse to walk
    // into Object.prototype. Without the hasOwn guard, a SHAPE_FIELDS
    // entry ending in a prototype-chain property (e.g., `toString`,
    // `constructor`, `hasOwnProperty`) would silently return the
    // Object.prototype member and compare function references, masking
    // real diffs on attacker-shaped or buggy responses.
    it("getField refuses to walk into Object.prototype (hasOwn guard)", () => {
      // Use a field that exists on Object.prototype: `toString`.
      // SHAPE_FIELDS doesn't actually reference `toString` today, but
      // the test uses the tier/warning path (`name`) which DOES exist
      // to prove getField still returns the own property correctly.
      // Then uses a custom entity type lookup with a nested path
      // that happens to end in `toString` via the custom field
      // specification to prove the prototype member is NOT returned.
      //
      // Since SHAPE_FIELDS is fixed per entity type, the cleanest
      // test is to verify that an entity whose only "code" property
      // comes from the prototype chain (inherited from a parent
      // object) resolves as undefined.
      const expectedProto = { programIds: ["p1"] };
      const actual: Record<string, unknown> = Object.create({
        programIds: ["p1"], // prototype-chain value
      });
      actual.name = "Own Property Only"; // only this is own
      const diff = computeEntityShapeDiff("badge", expectedProto, actual);
      // badge fatal is ["programIds"]; `actual.programIds` comes from
      // the prototype chain, so the hasOwn guard returns undefined on
      // the actual side, producing a fatal diff (expected has it, actual
      // does not). Before the fix, deepEqual would find both arrays
      // equal via prototype-chain lookup and return no diff.
      expect(hasFatalDiff(diff)).toBe(true);
      expect(diff.fields.find((f) => f.path === "programIds")).toBeDefined();
    });

    it("deep compares nested expression objects", () => {
      const diff = computeEntityShapeDiff(
        "eventRule",
        {
          eventTypeCode: "x",
          programIds: ["p1"],
          category: "ORGANIZATION_DEFINED",
          eventExpression: { type: "LITERAL", value: true },
          eventActionsExpression: {
            type: "AWARD_CURRENCY",
            amount: { type: "MULTIPLY", left: { path: "$.a" }, right: { value: 10 } },
          },
        },
        {
          eventTypeCode: "x",
          programIds: ["p1"],
          category: "ORGANIZATION_DEFINED",
          eventExpression: { type: "LITERAL", value: true },
          eventActionsExpression: {
            type: "AWARD_CURRENCY",
            amount: { type: "MULTIPLY", left: { path: "$.a" }, right: { value: 10 } },
          },
        }
      );
      expect(diff.fields).toEqual([]);
    });
  });
});

describe("hasFatalDiff", () => {
  it("returns true when any field is fatal", () => {
    const diff = computeEntityShapeDiff(
      "program",
      { type: { code: "standard" }, createAccountOnCustomerCreation: true },
      { type: { code: "different" }, createAccountOnCustomerCreation: true }
    );
    expect(hasFatalDiff(diff)).toBe(true);
  });

  it("returns false when only warnings exist", () => {
    const diff = computeEntityShapeDiff(
      "program",
      {
        type: { code: "standard" },
        createAccountOnCustomerCreation: true,
        name: "New",
      },
      {
        type: { code: "standard" },
        createAccountOnCustomerCreation: true,
        name: "Old",
      }
    );
    expect(hasFatalDiff(diff)).toBe(false);
  });

  it("returns false when no diff at all", () => {
    const diff = computeEntityShapeDiff(
      "program",
      { type: { code: "standard" }, createAccountOnCustomerCreation: true },
      { type: { code: "standard" }, createAccountOnCustomerCreation: true }
    );
    expect(hasFatalDiff(diff)).toBe(false);
  });
});

describe("SHAPE_FIELDS completeness", () => {
  it("has an entry for every entity type the plan defines", () => {
    const entityTypes = [
      "program",
      "currency",
      "tier",
      "badge",
      "target",
      "eventRule",
      "expiryRule",
      "pendingRule",
      "eventType",
      "metadata",
      "metadataType",
      "customer",
    ] as const;

    for (const t of entityTypes) {
      expect(SHAPE_FIELDS[t]).toBeDefined();
      expect(SHAPE_FIELDS[t].fatal).toBeInstanceOf(Array);
      expect(SHAPE_FIELDS[t].warning).toBeInstanceOf(Array);
    }
  });
});
