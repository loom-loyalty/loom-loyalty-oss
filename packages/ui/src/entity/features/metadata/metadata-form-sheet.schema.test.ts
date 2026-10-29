/**
 * METADATA audit-side Zod schema (L2).
 *
 * Constructed directly from the `DataType` SDK type — the concrete METADATA
 * union member. The orval-generated `Metadata` union type is unusable for
 * strict parsing (it's `DataType | Item | Location | Country` with the
 * variants duplicated). See METADATA.architecture.md §3.
 *
 * The audit pattern is:
 *   metadataBaseSchema   — strict z.object for the typed base fields
 *   metadataRecordSchema — metadataBaseSchema.catchall(z.unknown()) (Zod 4
 *                          replacement for the deprecated .passthrough())
 *                          to keep tenant extension keys without losing
 *                          strict base-field validation. Per playbook §5.11.
 */

import { localizedString } from "@loom-loyalty/test-utils/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const metadataBaseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  typeCode: z.string().min(1),
  dataTypeId: z.string().min(1),
  parentCode: z.string().optional(),
  description: localizedString.optional(),
  metadataId: z.string().optional(),
  dataModelCode: z.string().optional(),
  dateTimePeriod: z
    .object({
      startDateTime: z.string().optional(),
      endDateTime: z.string().optional(),
    })
    .optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
});

// Zod 4 prefers .catchall(unknown) over the deprecated .passthrough() helper.
const metadataRecordSchema = metadataBaseSchema.catchall(z.unknown());

describe("[audit] L2 — metadataBaseSchema (strict base shape)", () => {
  it("accepts a happy fixture with only required fields", () => {
    const result = metadataBaseSchema.safeParse({
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000001",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fixture with all optional fields populated", () => {
    const result = metadataBaseSchema.safeParse({
      code: "premium",
      name: "Premium",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000002",
      parentCode: "standard-gold",
      description: { en: "Top tier", es: "Nivel superior" },
      metadataId: "mtd_00000000000000000000000000000010",
      dataModelCode: "METADATA",
      dateTimePeriod: { startDateTime: "2024-01-01T00:00:00Z" },
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture missing the required `name` field", () => {
    const result = metadataBaseSchema.safeParse({
      code: "broken-entry",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000003",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an empty `code`", () => {
    const result = metadataBaseSchema.safeParse({
      code: "",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000004",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });

  it("rejects a description without the required `en` locale (via shared refinement)", () => {
    const result = metadataBaseSchema.safeParse({
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000005",
      description: { es: "Solo español" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("description"))).toBe(true);
  });

  it("strips empty-string locales from description (via shared refinement)", () => {
    const result = metadataBaseSchema.safeParse({
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000006",
      description: { en: "Top tier", es: "" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({ en: "Top tier" });
    }
  });

  it("strips unknown keys from base schema (no passthrough)", () => {
    const result = metadataBaseSchema.safeParse({
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000007",
      supplierCode: "SUP-001",
      riskCategory: "LOW",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("supplierCode");
      expect(result.data).not.toHaveProperty("riskCategory");
    }
  });
});

describe("[audit] L2 — metadataRecordSchema (catchall wrapper)", () => {
  it("preserves tenant extension keys alongside the strict base fields", () => {
    const result = metadataRecordSchema.safeParse({
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000008",
      supplierCode: "SUP-001",
      riskCategory: "LOW",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        code: "standard-gold",
        supplierCode: "SUP-001",
        riskCategory: "LOW",
      });
    }
  });

  it("still enforces base-field validation through the passthrough", () => {
    // Even with passthrough, missing required base fields fail.
    const result = metadataRecordSchema.safeParse({
      code: "broken-entry",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000009",
      supplierCode: "SUP-001",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("survives an extension-field roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000010",
      description: { en: "Top tier" },
      supplierCode: "SUP-001",
      riskCategory: "LOW",
      customFloat: 3.14,
      customNested: { foo: "bar" },
    };
    const first = metadataRecordSchema.parse(fixture);
    const second = metadataRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extension passthrough is in play", () => {
    // Mutating a base field to a wrong type must fail even though catchall(unknown)
    // would otherwise let any value through. This pins that strict + catchall
    // interact correctly on a record carrying tenant extensions.
    const valid = metadataRecordSchema.parse({
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000011",
      supplierCode: "SUP-001",
    });
    const broken = { ...valid, code: 42 };
    const result = metadataRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });
});
