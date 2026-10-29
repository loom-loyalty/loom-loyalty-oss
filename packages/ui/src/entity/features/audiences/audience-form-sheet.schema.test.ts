/**
 * CUSTOMER_AUDIENCE audit-side Zod schemas (L2).
 *
 * Hand-constructed `z.discriminatedUnion("type", [...])` over the base
 * manifest discriminator (CUSTOMER_LIST | CUSTOMER_SEGMENT). The FE adds an
 * `engine` sub-discriminator (CLICKHOUSE | THREADS) that only the
 * CUSTOMER_SEGMENT variant carries — modelled here as a required field on
 * that variant. Per playbook §5.11 (untagged orval union → hand-rolled
 * discriminated union).
 */

import { localizedString } from "@loom-loyalty/test-utils/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const audienceBaseShape = {
  customerAudienceId: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: localizedString.optional(),
  durationPeriod: z
    .object({
      fixedDurationDateTimePeriod: z
        .object({
          startDateTime: z.string().optional(),
          endDateTime: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  triggerOnEnter: z.boolean().optional(),
  triggerOnExit: z.boolean().optional(),
  enabledInEnvironments: z.array(z.unknown()).optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
};

const customerListBaseSchema = z.object({
  type: z.literal("CUSTOMER_LIST"),
  ...audienceBaseShape,
});

const customerSegmentBaseSchema = z.object({
  type: z.literal("CUSTOMER_SEGMENT"),
  engine: z.enum(["CLICKHOUSE", "THREADS"]),
  ...audienceBaseShape,
});

const audienceSchema = z.discriminatedUnion("type", [
  customerListBaseSchema,
  customerSegmentBaseSchema,
]);

const customerListRecordSchema = customerListBaseSchema.catchall(z.unknown());
const customerSegmentRecordSchema = customerSegmentBaseSchema.catchall(z.unknown());
const audienceRecordSchema = z.discriminatedUnion("type", [
  customerListRecordSchema,
  customerSegmentRecordSchema,
]);

const happyList = {
  type: "CUSTOMER_LIST" as const,
  code: "vip-shoppers",
  name: "VIP Shoppers",
};

const happySegment = {
  type: "CUSTOMER_SEGMENT" as const,
  engine: "CLICKHOUSE" as const,
  code: "big-spenders",
  name: "Big Spenders",
};

describe("[audit] L2 — audienceSchema (discriminated union, base variants)", () => {
  it("accepts a happy CUSTOMER_LIST fixture with only required fields", () => {
    expect(audienceSchema.safeParse(happyList).success).toBe(true);
  });

  it("accepts a happy CUSTOMER_SEGMENT fixture with only required fields", () => {
    expect(audienceSchema.safeParse(happySegment).success).toBe(true);
  });

  it("accepts a CUSTOMER_SEGMENT fixture with every optional field populated", () => {
    const result = audienceSchema.safeParse({
      ...happySegment,
      engine: "THREADS",
      customerAudienceId: "aud_550e8400e29b41d4a716446655440010",
      description: { en: "AI cluster", es: "Grupo de IA" },
      durationPeriod: {
        fixedDurationDateTimePeriod: { startDateTime: "2024-01-01T00:00:00Z" },
      },
      triggerOnEnter: true,
      triggerOnExit: false,
      enabledInEnvironments: [],
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture missing the discriminator", () => {
    const result = audienceSchema.safeParse({ code: "broken", name: "Broken" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "type")).toBe(true);
  });

  it("rejects a fixture with an unknown discriminator value", () => {
    const result = audienceSchema.safeParse({ ...happyList, type: "MYSTERY" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "type")).toBe(true);
  });

  it("rejects a CUSTOMER_SEGMENT fixture with an invalid engine", () => {
    const result = audienceSchema.safeParse({ ...happySegment, engine: "SPARK" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "engine")).toBe(true);
  });

  it("rejects a CUSTOMER_LIST fixture missing `name`", () => {
    const { name: _name, ...withoutName } = happyList;
    const result = audienceSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an empty `code`", () => {
    const result = audienceSchema.safeParse({ ...happyList, code: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });

  it("strips unknown keys on the CUSTOMER_LIST variant (Zod default .strip() mode)", () => {
    const result = audienceSchema.safeParse({
      ...happyList,
      futureField: "unmapped",
      mysteryFlag: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("futureField");
      expect(result.data).not.toHaveProperty("mysteryFlag");
    }
  });

  it("rejects an `en`-less localized description (shared refinement)", () => {
    const result = audienceSchema.safeParse({
      ...happyList,
      description: { es: "Solo español" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("description"))).toBe(true);
  });

  it("strips empty-string locales from description (shared refinement)", () => {
    const result = audienceSchema.safeParse({
      ...happyList,
      description: { en: "VIP", es: "" },
    });
    expect(result.success).toBe(true);
    if (result.success && "description" in result.data) {
      expect(result.data.description).toEqual({ en: "VIP" });
    }
  });
});

describe("[audit] L2 — audienceRecordSchema (catchall per variant, tenant extensions)", () => {
  it("preserves tenant extension keys on CUSTOMER_LIST records", () => {
    const result = audienceRecordSchema.safeParse({
      ...happyList,
      sourceSystem: "CRM-01",
      riskTier: "LOW",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        type: "CUSTOMER_LIST",
        sourceSystem: "CRM-01",
        riskTier: "LOW",
      });
    }
  });

  it("preserves tenant extension keys on CUSTOMER_SEGMENT records", () => {
    const result = audienceRecordSchema.safeParse({
      ...happySegment,
      ownerTeam: "growth",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ type: "CUSTOMER_SEGMENT", ownerTeam: "growth" });
    }
  });

  it("still enforces base-field validation through the catchall", () => {
    const result = audienceRecordSchema.safeParse({
      type: "CUSTOMER_LIST",
      code: "broken",
      sourceSystem: "CRM-01",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("survives an extension roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      ...happySegment,
      description: { en: "Top spenders" },
      ownerTeam: "growth",
      customNested: { foo: "bar" },
    };
    const first = audienceRecordSchema.parse(fixture);
    const second = audienceRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extensions are present", () => {
    const valid = audienceRecordSchema.parse({ ...happyList, sourceSystem: "CRM-01" });
    const broken = { ...valid, code: 42 };
    const result = audienceRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });
});
