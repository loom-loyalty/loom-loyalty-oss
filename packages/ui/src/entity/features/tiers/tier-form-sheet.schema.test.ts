/**
 * TIER audit-side Zod schema (L2).
 *
 * Constructed from the Tier SDK type. The base schema covers the
 * typed base fields; the record schema wraps with catchall(unknown)
 * for tenant extensions (Zod 4 replacement for deprecated .passthrough()).
 */

import { localizedString } from "@loom-loyalty/test-utils/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const tierBaseSchema = z.object({
  tierId: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  rank: z.number().optional(),
  subscription: z.boolean().optional(),
  programIds: z.array(z.string()).optional(),
  description: localizedString.optional(),
  durationPeriod: z
    .object({
      durationPeriod: z.string().optional(),
      durationPeriodType: z.string().optional(),
      durationValue: z.number().optional(),
      startDateTime: z.string().optional(),
      endDateTime: z.string().optional(),
    })
    .optional(),
  tierExpiryDowngradeTierId: z.string().optional(),
  tierExpiryDowngradeDurationPeriod: z
    .object({
      durationPeriod: z.string().optional(),
      durationPeriodType: z.string().optional(),
      durationValue: z.number().optional(),
      startDateTime: z.string().optional(),
      endDateTime: z.string().optional(),
    })
    .optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
});

// Zod 4 prefers .catchall(unknown) over the deprecated .passthrough() helper.
const tierRecordSchema = tierBaseSchema.catchall(z.unknown());

describe("[audit] L2 — tierBaseSchema (strict base shape)", () => {
  it("accepts a happy fixture with only required fields", () => {
    const result = tierBaseSchema.safeParse({
      code: "gold",
      name: "Gold",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fixture with all optional fields populated", () => {
    const result = tierBaseSchema.safeParse({
      tierId: "tier_00000000000000000000000000000001",
      code: "platinum",
      name: "Platinum",
      rank: 1,
      subscription: false,
      programIds: ["prog_00000000000000000000000000000001"],
      description: { en: "Top tier status", es: "Estado de nivel superior" },
      durationPeriod: {
        durationPeriodType: "SLIDING",
        durationValue: 12,
        durationPeriod: "MONTHS",
      },
      tierExpiryDowngradeTierId: "tier_00000000000000000000000000000002",
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture missing the required `name` field", () => {
    const result = tierBaseSchema.safeParse({
      code: "broken-tier",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an empty `code`", () => {
    const result = tierBaseSchema.safeParse({
      code: "",
      name: "Gold",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });

  it("rejects a description without the required `en` locale (via shared refinement)", () => {
    const result = tierBaseSchema.safeParse({
      code: "gold",
      name: "Gold",
      description: { es: "Solo español" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("description"))).toBe(true);
  });

  it("strips empty-string locales from description (via shared refinement)", () => {
    const result = tierBaseSchema.safeParse({
      code: "gold",
      name: "Gold",
      description: { en: "Top tier", es: "" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({ en: "Top tier" });
    }
  });

  it("strips unknown keys from base schema (no passthrough)", () => {
    const result = tierBaseSchema.safeParse({
      code: "gold",
      name: "Gold",
      internalRef: "REF-001",
      riskScore: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("internalRef");
      expect(result.data).not.toHaveProperty("riskScore");
    }
  });
});

describe("[audit] L2 — tierRecordSchema (catchall wrapper)", () => {
  it("preserves tenant extension keys alongside the strict base fields", () => {
    const result = tierRecordSchema.safeParse({
      code: "gold",
      name: "Gold",
      internalRef: "REF-001",
      riskScore: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        code: "gold",
        internalRef: "REF-001",
        riskScore: 5,
      });
    }
  });

  it("still enforces base-field validation through the passthrough", () => {
    const result = tierRecordSchema.safeParse({
      code: "broken-tier",
      internalRef: "REF-001",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("survives an extension-field roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      code: "gold",
      name: "Gold",
      rank: 1,
      description: { en: "Top tier" },
      internalRef: "REF-001",
      customScore: 42,
      customNested: { foo: "bar" },
    };
    const first = tierRecordSchema.parse(fixture);
    const second = tierRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extension passthrough is in play", () => {
    const valid = tierRecordSchema.parse({
      code: "gold",
      name: "Gold",
      internalRef: "REF-001",
    });
    const broken = { ...valid, code: 42 };
    const result = tierRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });
});
