/**
 * BADGE audit-side Zod schema (L2).
 *
 * Constructed directly from the `Badge` SDK type. The audit pattern:
 *   badgeBaseSchema   — strict z.object for the typed base fields
 *   badgeRecordSchema — badgeBaseSchema.catchall(z.unknown()) for tenant
 *                       extension keys without losing strict base validation.
 *                       Per playbook §5.11.
 */

import { localizedString } from "@loom-loyalty/test-utils/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const durationPeriodValue = z
  .object({
    quantity: z.number().optional(),
    unit: z.string().optional(),
  })
  .optional();

const dataTypeShape = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  typeCode: z.string().min(1),
  dataTypeId: z.string().min(1),
  metadataId: z.string().optional(),
  parentCode: z.string().optional(),
  description: z.unknown().optional(),
});

const badgeBaseSchema = z.object({
  badgeId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  type: dataTypeShape,
  typeCode: z.string().optional(),
  description: localizedString.optional(),
  durationPeriod: durationPeriodValue,
  programIds: z.array(z.string()).optional(),
  rank: z.number().optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
});

// Zod 4 prefers .catchall(unknown) over the deprecated .passthrough() helper.
const badgeRecordSchema = badgeBaseSchema.catchall(z.unknown());

describe("[audit] L2 — badgeBaseSchema (strict base shape)", () => {
  it("accepts a happy fixture with only required fields", () => {
    const result = badgeBaseSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000001",
      code: "loyalty-badge",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000001",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fixture with all optional fields populated", () => {
    const result = badgeBaseSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000002",
      code: "premium-badge",
      name: "Premium Badge",
      type: {
        code: "PREMIUM",
        name: "Premium",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000002",
      },
      description: { en: "Top tier badge", es: "Insignia de nivel superior" },
      programIds: ["prog_550e8400e29b41d4a716446655440000"],
      rank: 1,
      durationPeriod: { quantity: 30, unit: "DAYS" },
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture missing the required `name` field", () => {
    const result = badgeBaseSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000003",
      code: "broken-badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000003",
      },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an empty `code`", () => {
    const result = badgeBaseSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000004",
      code: "",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000004",
      },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });

  it("rejects a description without the required `en` locale (via shared refinement)", () => {
    const result = badgeBaseSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000005",
      code: "loyalty-badge",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000005",
      },
      description: { es: "Solo español" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("description"))).toBe(true);
  });

  it("strips empty-string locales from description (via shared refinement)", () => {
    const result = badgeBaseSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000006",
      code: "loyalty-badge",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000006",
      },
      description: { en: "Top tier", es: "" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({ en: "Top tier" });
    }
  });

  it("strips unknown keys from base schema (no passthrough)", () => {
    const result = badgeBaseSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000007",
      code: "loyalty-badge",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000007",
      },
      tenantCustomField: "custom-value",
      anotherExtension: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("tenantCustomField");
      expect(result.data).not.toHaveProperty("anotherExtension");
    }
  });
});

describe("[audit] L2 — badgeRecordSchema (catchall wrapper)", () => {
  it("preserves tenant extension keys alongside the strict base fields", () => {
    const result = badgeRecordSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000008",
      code: "loyalty-badge",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000008",
      },
      tenantCustomField: "custom-value",
      anotherExtension: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        code: "loyalty-badge",
        tenantCustomField: "custom-value",
        anotherExtension: 42,
      });
    }
  });

  it("still enforces base-field validation through the catchall", () => {
    const result = badgeRecordSchema.safeParse({
      badgeId: "badge_00000000000000000000000000000009",
      code: "broken-badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000009",
      },
      tenantCustomField: "custom-value",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("survives an extension-field roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      badgeId: "badge_00000000000000000000000000000010",
      code: "loyalty-badge",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000010",
      },
      description: { en: "Top tier" },
      tenantCustomField: "custom-value",
      customFloat: 3.14,
      customNested: { foo: "bar" },
    };
    const first = badgeRecordSchema.parse(fixture);
    const second = badgeRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extension catchall is in play", () => {
    const valid = badgeRecordSchema.parse({
      badgeId: "badge_00000000000000000000000000000011",
      code: "loyalty-badge",
      name: "Loyalty Badge",
      type: {
        code: "ACHIEVEMENT",
        name: "Achievement",
        typeCode: "BADGE_TYPE",
        dataTypeId: "dtyp_00000000000000000000000000000011",
      },
      tenantCustomField: "custom-value",
    });
    const broken = { ...valid, code: 42 };
    const result = badgeRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });
});
