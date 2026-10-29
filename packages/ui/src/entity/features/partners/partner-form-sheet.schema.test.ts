/**
 * PARTNER audit-side Zod schema (L2).
 *
 * Constructed directly from the `Partner` SDK type. The audit pattern:
 *   partnerBaseSchema   — strict z.object for the typed base fields
 *   partnerRecordSchema — partnerBaseSchema.catchall(z.unknown()) for
 *                         tenant extension keys without losing strict
 *                         base-field validation. Per playbook §5.11.
 */

import { localizedString } from "@loom-loyalty/test-utils/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const partnerBaseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  typeCode: z.string().min(1),
  description: localizedString.optional(),
  partnerId: z.string().optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
});

// Zod 4 prefers .catchall(unknown) over the deprecated .passthrough() helper.
const partnerRecordSchema = partnerBaseSchema.catchall(z.unknown());

describe("[audit] L2 — partnerBaseSchema (strict base shape)", () => {
  it("accepts a happy fixture with only required fields", () => {
    const result = partnerBaseSchema.safeParse({
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fixture with all optional fields populated", () => {
    const result = partnerBaseSchema.safeParse({
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
      description: { en: "A major retail partner", es: "Un gran socio minorista" },
      partnerId: "prtn_00000000000000000000000000000001",
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture missing the required `name` field", () => {
    const result = partnerBaseSchema.safeParse({
      code: "acme-corp",
      typeCode: "RETAIL",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an empty `code`", () => {
    const result = partnerBaseSchema.safeParse({
      code: "",
      name: "Acme Corp",
      typeCode: "RETAIL",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });

  it("rejects a description without the required `en` locale (via shared refinement)", () => {
    const result = partnerBaseSchema.safeParse({
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
      description: { es: "Solo español" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("description"))).toBe(true);
  });

  it("strips empty-string locales from description (via shared refinement)", () => {
    const result = partnerBaseSchema.safeParse({
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
      description: { en: "A partner", es: "" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({ en: "A partner" });
    }
  });

  it("strips unknown keys from base schema (no passthrough)", () => {
    const result = partnerBaseSchema.safeParse({
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
      internalRef: "REF-001",
      accountTier: "PLATINUM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("internalRef");
      expect(result.data).not.toHaveProperty("accountTier");
    }
  });
});

describe("[audit] L2 — partnerRecordSchema (catchall wrapper)", () => {
  it("preserves tenant extension keys alongside the strict base fields", () => {
    const result = partnerRecordSchema.safeParse({
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
      internalRef: "REF-001",
      accountTier: "PLATINUM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        code: "acme-corp",
        internalRef: "REF-001",
        accountTier: "PLATINUM",
      });
    }
  });

  it("still enforces base-field validation through the passthrough", () => {
    const result = partnerRecordSchema.safeParse({
      code: "acme-corp",
      typeCode: "RETAIL",
      internalRef: "REF-001",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("survives an extension-field roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
      description: { en: "Top tier partner" },
      internalRef: "REF-001",
      accountTier: "PLATINUM",
      customFloat: 3.14,
      customNested: { foo: "bar" },
    };
    const first = partnerRecordSchema.parse(fixture);
    const second = partnerRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extension passthrough is in play", () => {
    const valid = partnerRecordSchema.parse({
      code: "acme-corp",
      name: "Acme Corp",
      typeCode: "RETAIL",
      internalRef: "REF-001",
    });
    const broken = { ...valid, code: 42 };
    const result = partnerRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });
});
