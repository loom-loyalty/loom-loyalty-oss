/**
 * Unit tests for the shared L5 contract-schema helpers. Round-trips real
 * parses against runtime-derived Zod schemas so the contract specs that
 * import them stay correct.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldNameOf, zodFromElement, type RuntimeElement } from "./contract-schema.js";

describe("fieldNameOf", () => {
  it("prefers outputAttribute over inputAttribute", () => {
    expect(
      fieldNameOf({
        outputAttribute: "name",
        inputAttribute: "nameInput",
        typeReference: "STRING",
      })
    ).toBe("name");
  });

  it("falls back to inputAttribute when outputAttribute is absent", () => {
    expect(fieldNameOf({ inputAttribute: "code", typeReference: "STRING" })).toBe("code");
  });

  it("returns null when neither is set", () => {
    expect(fieldNameOf({ typeReference: "STRING" })).toBeNull();
  });
});

describe("zodFromElement — base type mapping", () => {
  it("STRING maps to a required string", () => {
    const schema = zodFromElement({
      outputAttribute: "name",
      typeReference: "STRING",
      required: true,
    });
    expect(schema.parse("hello")).toBe("hello");
    expect(() => schema.parse(123)).toThrow();
  });

  it("ENTITY_ID maps to a string (not required by default → optional)", () => {
    const schema = zodFromElement({
      outputAttribute: "programId",
      typeReference: "ENTITY_ID",
    });
    expect(schema.parse("prog_123")).toBe("prog_123");
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it("BOOLEAN maps to a boolean", () => {
    const schema = zodFromElement({
      outputAttribute: "active",
      typeReference: "BOOLEAN",
      required: true,
    });
    expect(schema.parse(true)).toBe(true);
    expect(() => schema.parse("true")).toThrow();
  });

  it.each(["NUMBER", "DECIMAL", "INTEGER"])("%s maps to a number", (typeReference) => {
    const schema = zodFromElement({
      outputAttribute: "amount",
      typeReference,
      required: true,
    });
    expect(schema.parse(42)).toBe(42);
    expect(() => schema.parse("42")).toThrow();
  });

  it.each(["DATE", "DATE_TIME"])("%s maps to a string", (typeReference) => {
    const schema = zodFromElement({
      outputAttribute: "createdAt",
      typeReference,
      required: true,
    });
    expect(schema.parse("2026-05-13T00:00:00Z")).toBe("2026-05-13T00:00:00Z");
    expect(() => schema.parse(1234567890)).toThrow();
  });

  it("LOCALIZED_STRING uses the shared localizedString refinement", () => {
    const schema = zodFromElement({
      outputAttribute: "description",
      typeReference: "LOCALIZED_STRING",
      required: true,
    });
    expect(schema.parse({ en: "Buy more" })).toEqual({ en: "Buy more" });
    // en-required refinement should fire
    expect(() => schema.parse({})).toThrow(/en/i);
  });

  it("DATE_TIME_PERIOD maps to a partial start/end object", () => {
    const schema = zodFromElement({
      outputAttribute: "validity",
      typeReference: "DATE_TIME_PERIOD",
      required: true,
    });
    expect(
      schema.parse({
        startDateTime: "2026-01-01T00:00:00Z",
        endDateTime: "2026-12-31T23:59:59Z",
      })
    ).toEqual({
      startDateTime: "2026-01-01T00:00:00Z",
      endDateTime: "2026-12-31T23:59:59Z",
    });
    expect(schema.parse({})).toEqual({});
  });

  it("unknown typeReferences pass through as z.unknown", () => {
    const schema = zodFromElement({
      outputAttribute: "ext",
      typeReference: "NEWLY_INVENTED_TYPE",
      required: true,
    });
    expect(schema.parse({ anything: "goes" })).toEqual({ anything: "goes" });
    expect(schema.parse("string")).toBe("string");
    expect(schema.parse(42)).toBe(42);
  });
});

describe("zodFromElement — METADATA mapping", () => {
  it("defaults to union(string, record) — accepts both code strings and embedded objects", () => {
    const schema = zodFromElement({
      outputAttribute: "currency",
      typeReference: "METADATA",
      required: true,
    });
    expect(schema.parse("USD")).toBe("USD");
    expect(schema.parse({ code: "USD", name: "US Dollar" })).toEqual({
      code: "USD",
      name: "US Dollar",
    });
  });

  it("opts into string-only when metadataAsString: true (METADATA spec behavior)", () => {
    const schema = zodFromElement(
      {
        outputAttribute: "currency",
        typeReference: "METADATA",
        required: true,
      },
      { metadataAsString: true }
    );
    expect(schema.parse("USD")).toBe("USD");
    expect(() => schema.parse({ code: "USD" })).toThrow();
  });
});

describe("zodFromElement — array + required wrappers", () => {
  it("wraps array: true in z.array around the inner schema", () => {
    const schema = zodFromElement({
      outputAttribute: "tags",
      typeReference: "STRING",
      required: true,
      array: true,
    });
    expect(schema.parse(["a", "b"])).toEqual(["a", "b"]);
    expect(() => schema.parse("a")).toThrow();
  });

  it("makes non-required fields optional", () => {
    const schema = zodFromElement({
      outputAttribute: "note",
      typeReference: "STRING",
    });
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse("ok")).toBe("ok");
  });
});

describe("zodFromElement — typeOverrides", () => {
  it("lets a caller override any typeReference with a custom inner schema", () => {
    const schema = zodFromElement(
      {
        outputAttribute: "dataType",
        typeReference: "DATA_TYPE",
        required: true,
      },
      {
        typeOverrides: {
          DATA_TYPE: () => z.union([z.string(), z.record(z.string(), z.unknown())]),
        },
      }
    );
    expect(schema.parse("CURRENCY")).toBe("CURRENCY");
    expect(schema.parse({ code: "CURRENCY" })).toEqual({ code: "CURRENCY" });
  });

  it("override is applied before the array+required wrappers", () => {
    const schema = zodFromElement(
      {
        outputAttribute: "audiences",
        typeReference: "CUSTOMER_AUDIENCE",
        required: false,
        array: true,
      },
      { typeOverrides: { CUSTOMER_AUDIENCE: () => z.unknown() } }
    );
    expect(schema.parse([{ id: 1 }, "loose"])).toEqual([{ id: 1 }, "loose"]);
    expect(schema.parse(undefined)).toBeUndefined();
  });
});

describe("integration — building a full record schema from elements", () => {
  it("round-trips a representative record against a runtime-derived shape", () => {
    const elements: RuntimeElement[] = [
      { outputAttribute: "code", typeReference: "STRING", required: true },
      { outputAttribute: "name", typeReference: "STRING", required: true },
      {
        outputAttribute: "description",
        typeReference: "LOCALIZED_STRING",
      },
      { outputAttribute: "active", typeReference: "BOOLEAN" },
      { outputAttribute: "limit", typeReference: "INTEGER" },
      { outputAttribute: "createdAt", typeReference: "DATE_TIME" },
      { outputAttribute: "typeCode", typeReference: "METADATA" },
    ];
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const el of elements) {
      const name = fieldNameOf(el);
      if (name) shape[name] = zodFromElement(el);
    }
    const recordSchema = z.object(shape).catchall(z.unknown());

    const result = recordSchema.safeParse({
      code: "GOLD",
      name: "Gold Tier",
      description: { en: "Top tier" },
      active: true,
      limit: 5,
      createdAt: "2026-05-13T00:00:00Z",
      typeCode: "CURRENCY",
      // Tenant extension fields should pass via catchall
      extField: "extra",
    });
    expect(result.success).toBe(true);
  });
});
