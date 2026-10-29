/**
 * Spec schema tests.
 *
 * These cover the Zod schemas directly (the linter covers the higher-level
 * cross-field rules in linter.test.ts). Focus: boundary values and the
 * max(50)/max(100) caps added by eng review 2026-04-07.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_BADGES_PER_PROGRAM,
  MAX_METADATA_RECORDS_PER_PROGRAM,
  MAX_TIERS_PER_PROGRAM,
  badgesStepSchema,
  currencyStepSchema,
  eventTypeSchema,
  metadataRecordSchema,
  programSpecSchema,
  programStepSchema,
  selectedFeaturesSchema,
  tiersStepSchema,
} from "./spec";

describe("tiersStepSchema", () => {
  function makeTier(code: string, threshold: number) {
    return {
      name: `Tier ${code}`,
      code,
      pointsThreshold: threshold,
      description: undefined,
    };
  }

  it("accepts the minimum of 2 tiers", () => {
    const result = tiersStepSchema.safeParse({
      tiers: [makeTier("bronze", 0), makeTier("silver", 100)],
    });
    expect(result.success).toBe(true);
  });

  it("rejects 1 tier (below minimum)", () => {
    const result = tiersStepSchema.safeParse({
      tiers: [makeTier("bronze", 0)],
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly MAX_TIERS_PER_PROGRAM tiers (boundary)", () => {
    const tiers = Array.from({ length: MAX_TIERS_PER_PROGRAM }, (_, i) =>
      makeTier(`tier-${i}`, i * 10)
    );
    const result = tiersStepSchema.safeParse({ tiers });
    expect(result.success).toBe(true);
  });

  it("rejects MAX_TIERS_PER_PROGRAM + 1 tiers (over the cap)", () => {
    const tiers = Array.from({ length: MAX_TIERS_PER_PROGRAM + 1 }, (_, i) =>
      makeTier(`tier-${i}`, i * 10)
    );
    const result = tiersStepSchema.safeParse({ tiers });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("; ");
      expect(messages).toContain(`At most ${MAX_TIERS_PER_PROGRAM}`);
    }
  });

  it("rejects duplicate tier codes", () => {
    const result = tiersStepSchema.safeParse({
      tiers: [makeTier("bronze", 0), makeTier("bronze", 100)],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("; ");
      expect(messages.toLowerCase()).toContain("unique");
    }
  });

  it("accepts platform-style tier codes (uppercase + underscore)", () => {
    // The platform persists tier codes like `BASE_MEMBER`, `SILVER_ELITE`.
    // The parser must accept these so UPDATE-mode template uploads against
    // existing programs don't fail on hydrated platform codes.
    const result = tiersStepSchema.safeParse({
      tiers: [makeTier("BASE_MEMBER", 0), makeTier("SILVER_ELITE", 25000)],
    });
    expect(result.success).toBe(true);
  });

  it("accepts mixed-case tier codes", () => {
    const result = tiersStepSchema.safeParse({
      tiers: [makeTier("Bronze", 0), makeTier("silver", 100)],
    });
    expect(result.success).toBe(true);
  });

  it("rejects tier codes with whitespace or special characters", () => {
    const result = tiersStepSchema.safeParse({
      tiers: [makeTier("bad code", 0), makeTier("silver", 100)],
    });
    expect(result.success).toBe(false);
  });

  it("rejects tier codes starting with digit or underscore", () => {
    const a = tiersStepSchema.safeParse({
      tiers: [makeTier("1tier", 0), makeTier("silver", 100)],
    });
    expect(a.success).toBe(false);
    const b = tiersStepSchema.safeParse({
      tiers: [makeTier("_tier", 0), makeTier("silver", 100)],
    });
    expect(b.success).toBe(false);
  });
});

describe("badgesStepSchema", () => {
  function makeBadge(code: string) {
    return { name: `Badge ${code}`, code, description: undefined };
  }

  it("accepts 1 badge (minimum)", () => {
    const result = badgesStepSchema.safeParse({ badges: [makeBadge("first-purchase")] });
    expect(result.success).toBe(true);
  });

  it("rejects 0 badges", () => {
    const result = badgesStepSchema.safeParse({ badges: [] });
    expect(result.success).toBe(false);
  });

  it("accepts exactly MAX_BADGES_PER_PROGRAM badges (boundary)", () => {
    const badges = Array.from({ length: MAX_BADGES_PER_PROGRAM }, (_, i) =>
      makeBadge(`badge-${i}`)
    );
    const result = badgesStepSchema.safeParse({ badges });
    expect(result.success).toBe(true);
  });

  it("rejects MAX_BADGES_PER_PROGRAM + 1 badges (over the cap)", () => {
    const badges = Array.from({ length: MAX_BADGES_PER_PROGRAM + 1 }, (_, i) =>
      makeBadge(`badge-${i}`)
    );
    const result = badgesStepSchema.safeParse({ badges });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("; ");
      expect(messages).toContain(`At most ${MAX_BADGES_PER_PROGRAM}`);
    }
  });

  it("rejects duplicate badge codes", () => {
    const result = badgesStepSchema.safeParse({
      badges: [makeBadge("first-win"), makeBadge("first-win")],
    });
    expect(result.success).toBe(false);
  });
});

describe("programStepSchema", () => {
  it("accepts a valid program with 3+ letters in code", () => {
    const result = programStepSchema.safeParse({
      code: "my-rewards",
      name: "My Rewards",
      typeCode: "standard",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a code with fewer than 3 letters (q1, 2025)", () => {
    // Codes like "q1" sanitize to the literal "program" when building event
    // type codes downstream. The refine catches this.
    const result = programStepSchema.safeParse({
      code: "q1-2025",
      name: "Q1 Program",
      typeCode: "standard",
    });
    expect(result.success).toBe(false);
  });

  it("rejects codes starting with a digit", () => {
    const result = programStepSchema.safeParse({
      code: "2025-rewards",
      name: "2025 Rewards",
      typeCode: "standard",
    });
    expect(result.success).toBe(false);
  });

  it("accepts platform-style program codes (UPPERCASE_WITH_UNDERSCORES)", () => {
    // The platform persists program codes like `NWA_WORLDPERKS` and
    // `ADVANTAGE_RENT_A_CAR_PROGRAM`. Without accepting these, UPDATE-mode
    // template uploads against any non-wizard-created program would fail
    // at parse time with a confusing "must be lowercase" error — defeating
    // the M2b UPDATE flow on every real tenant.
    const a = programStepSchema.safeParse({
      code: "NWA_WORLDPERKS",
      name: "Northwest Airlines WorldPerks",
      typeCode: "standard",
    });
    expect(a.success).toBe(true);
    const b = programStepSchema.safeParse({
      code: "ADVANTAGE_RENT_A_CAR_PROGRAM",
      name: "Advantage Rent-a-Car Partner Program",
      typeCode: "standard",
    });
    expect(b.success).toBe(true);
  });

  it("accepts mixed-case program codes", () => {
    const result = programStepSchema.safeParse({
      code: "MyRewards",
      name: "My Rewards",
      typeCode: "standard",
    });
    expect(result.success).toBe(true);
  });

  it("rejects program codes with whitespace or dots", () => {
    const a = programStepSchema.safeParse({
      code: "my rewards",
      name: "My Rewards",
      typeCode: "standard",
    });
    expect(a.success).toBe(false);
    const b = programStepSchema.safeParse({
      code: "my.rewards",
      name: "My Rewards",
      typeCode: "standard",
    });
    expect(b.success).toBe(false);
  });

  // typeName is round-trip-preserved; not consumed by the executor.
  // Schema-level: optional; empty strings rejected.

  it("accepts an optional program.typeName alongside typeCode", () => {
    const result = programStepSchema.safeParse({
      code: "premium-tier",
      name: "Premium Tier",
      typeCode: "premium-tier",
      typeName: "Premium Tier",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a program without typeName (typeCode-only is still valid)", () => {
    const result = programStepSchema.safeParse({
      code: "standard-rewards",
      name: "Standard Rewards",
      typeCode: "standard",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty-string typeName when the field is provided", () => {
    const result = programStepSchema.safeParse({
      code: "premium-tier",
      name: "Premium Tier",
      typeCode: "premium-tier",
      typeName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("currencyStepSchema — currencyTypeName", () => {
  it("accepts an optional currency.currencyTypeName alongside currencyTypeCode", () => {
    const result = currencyStepSchema.safeParse({
      code: "milespoints",
      name: "Miles Points",
      currencyTypeCode: "miles-points",
      currencyTypeName: "Miles Points",
    });
    expect(result.success).toBe(true);
  });

  it("accepts currency without currencyTypeName", () => {
    const result = currencyStepSchema.safeParse({
      code: "pts",
      name: "Points",
      currencyTypeCode: "points",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty-string currencyTypeName", () => {
    const result = currencyStepSchema.safeParse({
      code: "pts",
      name: "Points",
      currencyTypeCode: "points",
      currencyTypeName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("programSpecSchema — typeName fields + legacy suggested-flags", () => {
  // The deprecated wizard-state flags `programTypeIsSuggested` and
  // `currencyTypeIsSuggested` are no longer recognized. The schema is
  // intentionally `.loose()` for wizard compatibility (it carries
  // ProgramWizardData extension fields like executionResults), so
  // unknown keys aren't actively rejected. They pass through harmlessly
  // but the ProgramSpec TS interface no longer declares them, so any
  // production code reading them would fail type-check. The markdown
  // parser is responsible for emitting a deprecation WARNING when these
  // fields appear in uploaded frontmatter — that's covered in
  // markdown.test.ts. Here we just pin the schema's surface contract.

  function baseSpec(extras: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schemaVersion: "program-spec.v1",
      selectedFeatures: {
        programCurrency: true,
        expiry: false,
        pending: false,
        tiers: false,
        badges: false,
        programType: "transactional",
        signupBonus: false,
        birthdayBonus: false,
      },
      program: { code: "test", name: "Test", typeCode: "standard" },
      currency: { code: "test-pts", name: "Points", currencyTypeCode: "points" },
      tiers: [],
      badges: [],
      awardRule: {
        templateId: "points-per-dollar",
        templateConfig: { pointsPerDollar: 1 },
        rulePayload: {},
      },
      ...extras,
    };
  }

  it("preserves a typeName supplied on program (passes through the loose object)", () => {
    const result = programSpecSchema.safeParse(
      baseSpec({
        program: {
          code: "premium-tier",
          name: "Premium Tier",
          typeCode: "premium-tier",
          typeName: "Premium Tier",
        },
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.program).toMatchObject({ typeName: "Premium Tier" });
    }
  });

  it("preserves a currencyTypeName supplied on currency", () => {
    const result = programSpecSchema.safeParse(
      baseSpec({
        currency: {
          code: "milespoints",
          name: "Miles Points",
          currencyTypeCode: "miles-points",
          currencyTypeName: "Miles Points",
        },
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toMatchObject({ currencyTypeName: "Miles Points" });
    }
  });

  it("does not reject a spec carrying the legacy programTypeIsSuggested flag", () => {
    // Backward compat: templates in the wild may still ship the flag.
    // The schema is `.loose()`, so the parse succeeds and the flag passes
    // through untyped. The markdown parser emits a deprecation warning
    // (verified in markdown.test.ts). The ProgramSpec TS interface no
    // longer declares the field, so production code can't read it.
    const result = programSpecSchema.safeParse(baseSpec({ programTypeIsSuggested: true }));
    expect(result.success).toBe(true);
  });

  it("does not reject a spec carrying the legacy currencyTypeIsSuggested flag", () => {
    const result = programSpecSchema.safeParse(baseSpec({ currencyTypeIsSuggested: true }));
    expect(result.success).toBe(true);
  });
});

describe("selectedFeaturesSchema", () => {
  const baseFeatures = {
    programCurrency: true,
    expiry: false,
    pending: false,
    tiers: false,
    badges: false,
    programType: "transactional" as const,
    signupBonus: false,
    birthdayBonus: false,
  };

  it("accepts a valid feature set", () => {
    const result = selectedFeaturesSchema.safeParse(baseFeatures);
    expect(result.success).toBe(true);
  });

  it("rejects signupBonus without programCurrency", () => {
    const result = selectedFeaturesSchema.safeParse({
      ...baseFeatures,
      programCurrency: false,
      signupBonus: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("; ");
      expect(messages).toContain("Sign-up bonus requires program currency");
    }
  });

  it("rejects birthdayBonus without programCurrency", () => {
    const result = selectedFeaturesSchema.safeParse({
      ...baseFeatures,
      programCurrency: false,
      birthdayBonus: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("; ");
      expect(messages).toContain("Birthday bonus requires program currency");
    }
  });
});

describe("metadataRecordSchema", () => {
  it("accepts a TYPE-only record (no code)", () => {
    const result = metadataRecordSchema.safeParse({
      category: "DATA_TYPE",
      typeCode: "PROGRAM_TYPE",
      name: "Program Type",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an INSTANCE record (with code)", () => {
    const result = metadataRecordSchema.safeParse({
      category: "DATA_TYPE",
      typeCode: "PROGRAM_TYPE",
      code: "retail",
      name: "Retail",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional description", () => {
    const result = metadataRecordSchema.safeParse({
      category: "DATA_TYPE",
      typeCode: "PROGRAM_TYPE",
      name: "Program Type",
      description: "Used to classify a program",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty category", () => {
    const result = metadataRecordSchema.safeParse({
      category: "",
      typeCode: "PROGRAM_TYPE",
      name: "Program Type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing typeCode", () => {
    const result = metadataRecordSchema.safeParse({
      category: "DATA_TYPE",
      name: "Program Type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = metadataRecordSchema.safeParse({
      category: "DATA_TYPE",
      typeCode: "PROGRAM_TYPE",
    });
    expect(result.success).toBe(false);
  });
});

describe("programSpecSchema — metadata array", () => {
  function baseSpec(extras: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schemaVersion: "program-spec.v1",
      selectedFeatures: {
        programCurrency: true,
        expiry: false,
        pending: false,
        tiers: false,
        badges: false,
        programType: "transactional",
        signupBonus: false,
        birthdayBonus: false,
      },
      program: { code: "test", name: "Test", typeCode: "standard" },
      currency: { code: "test-pts", name: "Points", currencyTypeCode: "points" },
      tiers: [],
      badges: [],
      awardRule: {
        templateId: "points-per-dollar",
        templateConfig: { pointsPerDollar: 1 },
        rulePayload: {},
      },
      ...extras,
    };
  }

  it("defaults metadata to an empty array when omitted", () => {
    const result = programSpecSchema.safeParse(baseSpec());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual([]);
    }
  });

  it("coerces metadata: null to an empty array", () => {
    // JSON consumers may emit `metadata: null` when the field is empty.
    // Zod `.default([])` only substitutes for undefined, so without coercion
    // the parse fails with "Expected array, received null".
    const result = programSpecSchema.safeParse(baseSpec({ metadata: null }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual([]);
    }
  });

  it("accepts well-formed metadata records", () => {
    const result = programSpecSchema.safeParse(
      baseSpec({
        metadata: [
          { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "retail", name: "Retail" },
          { category: "DATA_TYPE", typeCode: "CURRENCY_TYPE", code: "points", name: "Points" },
        ],
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toHaveLength(2);
    }
  });

  it("rejects an invalid metadata row (empty category)", () => {
    const result = programSpecSchema.safeParse(
      baseSpec({
        metadata: [{ category: "", typeCode: "PROGRAM_TYPE", name: "Program Type" }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects metadata exceeding MAX_METADATA_RECORDS_PER_PROGRAM", () => {
    const tooMany = Array.from({ length: MAX_METADATA_RECORDS_PER_PROGRAM + 1 }, (_, i) => ({
      category: "DATA_TYPE",
      typeCode: `TYPE_${i}`,
      name: `Type ${i}`,
    }));
    const result = programSpecSchema.safeParse(baseSpec({ metadata: tooMany }));
    expect(result.success).toBe(false);
  });
});

describe("eventTypeSchema", () => {
  it("rejects zero data fields when creating a new event type", () => {
    const result = eventTypeSchema.safeParse({
      name: "Course Completed",
      code: "course-completed",
      dataFields: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["dataFields"]);
    }
  });

  it("accepts zero data fields when useExisting is true", () => {
    // Reusing a pre-seeded system type (e.g. "check-in") or another
    // program's custom type -- its schema already exists, so there is
    // nothing to define here.
    const result = eventTypeSchema.safeParse({
      name: "Check In",
      code: "check-in",
      dataFields: [],
      useExisting: true,
    });
    expect(result.success).toBe(true);
  });

  it("still requires at least one data field when useExisting is explicitly false", () => {
    const result = eventTypeSchema.safeParse({
      name: "Course Completed",
      code: "course-completed",
      dataFields: [],
      useExisting: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a populated event type regardless of useExisting", () => {
    const result = eventTypeSchema.safeParse({
      name: "Course Completed",
      code: "course-completed",
      dataFields: [{ name: "courseId", type: "string", required: true }],
    });
    expect(result.success).toBe(true);
  });
});
