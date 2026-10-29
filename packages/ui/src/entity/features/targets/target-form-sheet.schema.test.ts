/**
 * TARGET audit-side Zod schemas (L2).
 *
 * Hand-constructed because the orval-generated
 * `CreateTarget = CreateCompletionTarget | CreateCounterTarget |
 *  CreateMilestoneTarget | CreateXOfYTarget` union is untagged — each variant
 * declares `type` as the full enum, so TypeScript narrowing on the orval types
 * is broken. The runtime data DOES discriminate on `type`, so a hand-rolled
 * `z.discriminatedUnion("type", [...])` over the four variants is the right
 * shape. Per playbook §5.11.
 *
 * `programIds` is `required + array` in test-snapshots/manifest/TARGET.json,
 * hence `z.array(...).min(1)` on the shared base.
 */

import { localizedString } from "@loom-loyalty/test-utils/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const targetBaseShape = {
  targetId: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  programIds: z.array(z.string().min(1)).min(1),
  scope: z.enum(["GLOBAL", "PROGRAM", "RULE", "EVENT"]).optional(),
  description: localizedString.optional(),
  durationPeriod: z.unknown().optional(),
  requiresRegistration: z.boolean().optional(),
  retroAfterRegistration: z.boolean().optional(),
  enabledInEnvironments: z.array(z.unknown()).optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
};

const completionTargetBaseSchema = z.object({
  type: z.literal("COMPLETION"),
  completionTargetTypeCode: z.string().min(1),
  ...targetBaseShape,
});

const counterTargetBaseSchema = z.object({
  type: z.literal("COUNTER"),
  counterTargetTypeCode: z.string().min(1),
  targetValue: z.number().nonnegative().optional(),
  cappingTarget: z.boolean().optional(),
  numberOfCycles: z.number().int().positive().optional(),
  numberOfCyclesToAchieve: z.number().int().positive().optional(),
  cyclesMustBeConsecutive: z.boolean().optional(),
  carryOverToNextCycle: z.boolean().optional(),
  growthTargetOperator: z.string().optional(),
  growthTargetOperand: z.number().optional(),
  growthTargetAlgorithm: z.string().optional(),
  ...targetBaseShape,
});

const milestoneTargetBaseSchema = z.object({
  type: z.literal("MILESTONE"),
  milestoneTargetTypeCode: z.string().min(1),
  items: z.array(z.object({ targetId: z.string().min(1), order: z.number().int() })).min(2),
  ...targetBaseShape,
});

const xOfYTargetBaseSchema = z.object({
  type: z.literal("X_OF_Y"),
  xofYTargetTypeCode: z.string().min(1),
  itemTargetIds: z.array(z.string().min(1)).min(1),
  targetValue: z.number().int().positive(),
  ...targetBaseShape,
});

const targetSchema = z.discriminatedUnion("type", [
  counterTargetBaseSchema,
  completionTargetBaseSchema,
  milestoneTargetBaseSchema,
  xOfYTargetBaseSchema,
]);

const completionTargetRecordSchema = completionTargetBaseSchema.catchall(z.unknown());
const counterTargetRecordSchema = counterTargetBaseSchema.catchall(z.unknown());
const milestoneTargetRecordSchema = milestoneTargetBaseSchema.catchall(z.unknown());
const xOfYTargetRecordSchema = xOfYTargetBaseSchema.catchall(z.unknown());
const targetRecordSchema = z.discriminatedUnion("type", [
  counterTargetRecordSchema,
  completionTargetRecordSchema,
  milestoneTargetRecordSchema,
  xOfYTargetRecordSchema,
]);

const happyCompletion = {
  type: "COMPLETION" as const,
  code: "FINISH_ONBOARDING",
  name: "Finish Onboarding",
  programIds: ["prog_550e8400e29b41d4a716446655440000"],
  completionTargetTypeCode: "ONBOARDING",
};

const happyCounter = {
  type: "COUNTER" as const,
  code: "SPEND_100_MONTHLY",
  name: "Monthly Spend Goal",
  programIds: ["prog_550e8400e29b41d4a716446655440001"],
  counterTargetTypeCode: "SPEND",
  targetValue: 100,
};

const happyMilestone = {
  type: "MILESTONE" as const,
  code: "JOURNEY",
  name: "Customer Journey",
  programIds: ["prog_550e8400e29b41d4a716446655440002"],
  milestoneTargetTypeCode: "JOURNEY",
  items: [
    { targetId: "tgt_550e8400e29b41d4a716446655440021", order: 1 },
    { targetId: "tgt_550e8400e29b41d4a716446655440022", order: 2 },
  ],
};

const happyXOfY = {
  type: "X_OF_Y" as const,
  code: "ANY_TWO",
  name: "Pick Any Two",
  programIds: ["prog_550e8400e29b41d4a716446655440003"],
  xofYTargetTypeCode: "ANY_TWO",
  itemTargetIds: ["tgt_550e8400e29b41d4a716446655440031", "tgt_550e8400e29b41d4a716446655440032"],
  targetValue: 2,
};

describe("[audit] L2 — targetSchema (discriminated union, base variants)", () => {
  it("accepts a happy COMPLETION fixture with only required fields", () => {
    expect(targetSchema.safeParse(happyCompletion).success).toBe(true);
  });

  it("accepts a happy COUNTER fixture with only required fields", () => {
    expect(targetSchema.safeParse(happyCounter).success).toBe(true);
  });

  it("accepts a happy MILESTONE fixture with only required fields", () => {
    expect(targetSchema.safeParse(happyMilestone).success).toBe(true);
  });

  it("accepts a happy X_OF_Y fixture with only required fields", () => {
    expect(targetSchema.safeParse(happyXOfY).success).toBe(true);
  });

  it("accepts a COUNTER fixture with every optional field populated", () => {
    const result = targetSchema.safeParse({
      ...happyCounter,
      targetId: "tgt_550e8400e29b41d4a716446655440010",
      description: { en: "Spend goal", es: "Meta de gasto" },
      scope: "PROGRAM",
      cappingTarget: true,
      numberOfCycles: 3,
      numberOfCyclesToAchieve: 2,
      cyclesMustBeConsecutive: true,
      carryOverToNextCycle: false,
      growthTargetOperator: "MULTIPLY",
      growthTargetOperand: 1.5,
      growthTargetAlgorithm: "MIN_LAST_CYCLE",
      requiresRegistration: true,
      retroAfterRegistration: false,
      enabledInEnvironments: [],
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture missing the discriminator", () => {
    const result = targetSchema.safeParse({
      code: "BROKEN",
      name: "Broken",
      programIds: ["prog_550e8400e29b41d4a716446655440000"],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "type")).toBe(true);
  });

  it("rejects a fixture with an unknown discriminator value", () => {
    const result = targetSchema.safeParse({ ...happyCounter, type: "MYSTERY" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "type")).toBe(true);
  });

  it("rejects a COMPLETION fixture missing `name`", () => {
    const { name: _name, ...withoutName } = happyCompletion;
    const result = targetSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an empty `code`", () => {
    const result = targetSchema.safeParse({ ...happyCounter, code: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });

  it("rejects empty `programIds`", () => {
    const result = targetSchema.safeParse({ ...happyCounter, programIds: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "programIds")).toBe(true);
  });

  it("rejects a COMPLETION fixture missing its completionTargetTypeCode", () => {
    const { completionTargetTypeCode: _drop, ...withoutCode } = happyCompletion;
    const result = targetSchema.safeParse(withoutCode);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "completionTargetTypeCode")).toBe(true);
  });

  it("rejects an X_OF_Y fixture missing its targetValue (X)", () => {
    const { targetValue: _drop, ...withoutX } = happyXOfY;
    const result = targetSchema.safeParse(withoutX);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "targetValue")).toBe(true);
  });

  it("rejects a MILESTONE fixture with fewer than 2 items", () => {
    const result = targetSchema.safeParse({
      ...happyMilestone,
      items: [{ targetId: "tgt_550e8400e29b41d4a716446655440021", order: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "items")).toBe(true);
  });

  it("cross-mismatch: a COUNTER-only field on a COMPLETION fixture is stripped (Zod default .strip())", () => {
    // COMPLETION variant does not declare counterTargetTypeCode/targetValue.
    // Zod's default mode for z.object is .strip() — unknown keys are silently
    // dropped. This documents that behavior; the L5 contract spec's runtime
    // enum-equality check is the real cross-variant drift detector.
    const result = targetSchema.safeParse({
      ...happyCompletion,
      counterTargetTypeCode: "SPEND",
      targetValue: 999,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("counterTargetTypeCode");
      expect(result.data).not.toHaveProperty("targetValue");
    }
  });

  it("cross-mismatch: a MILESTONE `items` array on an X_OF_Y fixture is stripped", () => {
    const result = targetSchema.safeParse({
      ...happyXOfY,
      items: [{ targetId: "tgt_550e8400e29b41d4a716446655440099", order: 1 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("items");
    }
  });

  it("rejects an `en`-less localized description (shared refinement)", () => {
    const result = targetSchema.safeParse({
      ...happyCounter,
      description: { es: "Solo español" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("description"))).toBe(true);
  });

  it("strips empty-string locales from description (shared refinement)", () => {
    const result = targetSchema.safeParse({
      ...happyCounter,
      description: { en: "Spend", es: "" },
    });
    expect(result.success).toBe(true);
    if (result.success && "description" in result.data) {
      expect(result.data.description).toEqual({ en: "Spend" });
    }
  });
});

describe("[audit] L2 — targetRecordSchema (catchall per variant, tenant extensions)", () => {
  it("preserves tenant extension keys on COUNTER records", () => {
    const result = targetRecordSchema.safeParse({
      ...happyCounter,
      campaignCode: "Q1-2024",
      riskTier: "LOW",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        type: "COUNTER",
        campaignCode: "Q1-2024",
        riskTier: "LOW",
      });
    }
  });

  it("preserves tenant extension keys on MILESTONE records", () => {
    const result = targetRecordSchema.safeParse({
      ...happyMilestone,
      ownerTeam: "growth",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ type: "MILESTONE", ownerTeam: "growth" });
    }
  });

  it("preserves tenant extension keys on COMPLETION + X_OF_Y records", () => {
    const completion = targetRecordSchema.safeParse({ ...happyCompletion, sourceSystem: "CRM" });
    expect(completion.success).toBe(true);
    if (completion.success) {
      expect(completion.data).toMatchObject({ type: "COMPLETION", sourceSystem: "CRM" });
    }

    const xofy = targetRecordSchema.safeParse({ ...happyXOfY, channel: "app" });
    expect(xofy.success).toBe(true);
    if (xofy.success) {
      expect(xofy.data).toMatchObject({ type: "X_OF_Y", channel: "app" });
    }
  });

  it("still enforces base-field validation through the catchall", () => {
    const result = targetRecordSchema.safeParse({
      type: "COUNTER",
      code: "BROKEN",
      counterTargetTypeCode: "SPEND",
      programIds: ["prog_550e8400e29b41d4a716446655440000"],
      campaignCode: "Q1-2024",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("survives an extension roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      ...happyCounter,
      description: { en: "Top spenders" },
      campaignCode: "Q1-2024",
      customNested: { foo: "bar" },
    };
    const first = targetRecordSchema.parse(fixture);
    const second = targetRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extensions are present", () => {
    const valid = targetRecordSchema.parse({ ...happyCounter, campaignCode: "Q1-2024" });
    const broken = { ...valid, code: 42 };
    const result = targetRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });
});
