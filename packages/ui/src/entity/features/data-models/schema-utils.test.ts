import { afterEach, describe, expect, it, vi } from "vitest";

import {
  copyToClipboard,
  findDuplicateAttributes,
  formatJson,
  generateClientSchema,
  validateJsonAgainstSchema,
} from "./schema-utils.js";
import type { DataModelElementFormData } from "./types.js";

function el(overrides: Partial<DataModelElementFormData> = {}): DataModelElementFormData {
  return {
    name: "Email",
    inputAttribute: "email",
    outputAttribute: "email",
    typeCode: "STRING",
    isArray: false,
    required: false,
    sensitive: false,
    inputOnly: false,
    outputOnly: false,
    createOnly: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateClientSchema
// ---------------------------------------------------------------------------
describe("generateClientSchema", () => {
  it("returns an empty object schema when given no elements", () => {
    const schema = generateClientSchema([]);
    expect(schema).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });

  it("maps each primitive type to the right JSON Schema fragment", () => {
    const schema = generateClientSchema([
      el({ outputAttribute: "s", typeCode: "STRING" }),
      el({ outputAttribute: "i", typeCode: "INTEGER" }),
      el({ outputAttribute: "n", typeCode: "NUMBER" }),
      el({ outputAttribute: "b", typeCode: "BOOLEAN" }),
      el({ outputAttribute: "d", typeCode: "DATE" }),
      el({ outputAttribute: "dt", typeCode: "DATE_TIME" }),
      el({ outputAttribute: "u", typeCode: "UUID" }),
      el({ outputAttribute: "ls", typeCode: "LOCALIZED_STRING" }),
      el({ outputAttribute: "a", typeCode: "ANY" }),
    ]);

    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.s).toEqual({ type: "string" });
    expect(props.i).toEqual({ type: "integer" });
    expect(props.n).toEqual({ type: "number" });
    expect(props.b).toEqual({ type: "boolean" });
    expect(props.d).toEqual({ type: "string", format: "date" });
    expect(props.dt).toEqual({ type: "string", format: "date-time" });
    expect(props.u).toEqual({ type: "string", format: "uuid" });
    expect(props.ls).toMatchObject({ type: "object" });
    expect(props.a).toHaveProperty("anyOf");
  });

  it("emits $ref for custom / non-primitive type codes", () => {
    const schema = generateClientSchema([el({ outputAttribute: "addr", typeCode: "ADDRESS" })]);
    expect((schema.properties as Record<string, Record<string, unknown>>).addr).toEqual({
      $ref: "#/definitions/ADDRESS",
    });
  });

  it("names the $ref with the type's actual code, not an upper-cased one", () => {
    // Custom DataModelType codes are lowercase-hyphenated under the resource-code
    // convention, so upper-casing produced a ref naming a type that does not exist.
    const schema = generateClientSchema([
      el({ outputAttribute: "lineItem", typeCode: "order-line-item" }),
    ]);
    expect((schema.properties as Record<string, Record<string, unknown>>).lineItem).toEqual({
      $ref: "#/definitions/order-line-item",
    });
  });

  it("wraps schema in an array when isArray is true", () => {
    const schema = generateClientSchema([
      el({ outputAttribute: "tags", typeCode: "STRING", isArray: true }),
    ]);
    expect((schema.properties as Record<string, Record<string, unknown>>).tags).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("renders a nested builder row as an inline object array preview", () => {
    const schema = generateClientSchema([
      {
        field: {
          name: "Line Items",
          inputAttribute: "lineItems",
          typeCode: "ANY",
          isArray: true,
        },
        state: "needs-review-nested" as const,
        source: "manual" as const,
        nestedTypeName: "Line Item",
        nested: [
          {
            field: {
              name: "SKU",
              inputAttribute: "sku",
              typeCode: "STRING",
              required: true,
            },
            state: "editable" as const,
            source: "manual" as const,
          },
        ],
      },
    ]);

    expect((schema.properties as Record<string, Record<string, unknown>>).lineItems).toEqual({
      type: "array",
      items: {
        type: "object",
        properties: { sku: { type: "string" } },
        required: ["sku"],
      },
    });
  });

  it("adds required field names to the required array", () => {
    const schema = generateClientSchema([
      el({ outputAttribute: "email", required: true }),
      el({ outputAttribute: "phone", required: false }),
    ]);
    expect(schema.required).toEqual(["email"]);
  });

  it("omits required when no fields are required", () => {
    const schema = generateClientSchema([el({ outputAttribute: "email", required: false })]);
    expect(schema.required).toBeUndefined();
  });

  it("falls back to inputAttribute when outputAttribute is missing", () => {
    const schema = generateClientSchema([
      el({ inputAttribute: "fallback", outputAttribute: "", typeCode: "STRING" }),
    ]);
    expect(schema.properties).toHaveProperty("fallback");
  });

  it("skips elements with no attribute at all", () => {
    const schema = generateClientSchema([el({ inputAttribute: "", outputAttribute: "" })]);
    expect(schema.properties).toEqual({});
  });

  it("includes title when passed via options", () => {
    const schema = generateClientSchema([], { title: "Customer" });
    expect(schema.title).toBe("Customer");
  });

  it("treats type codes case-insensitively (lowercase -> primitive match)", () => {
    const schema = generateClientSchema([el({ outputAttribute: "s", typeCode: "string" })]);
    expect((schema.properties as Record<string, Record<string, unknown>>).s).toEqual({
      type: "string",
    });
  });

  it("matches multi-segment primitives by their post-migration kebab spelling", () => {
    // DATE_TIME and LOCALIZED_STRING are part of DataModelType's resource-code
    // migration too, so the API now returns "date-time" / "localized-string".
    // A bare .toUpperCase() turns "date-time" into "DATE-TIME" (hyphen, not
    // underscore), which matched neither spelling and fell through to $ref.
    const schema = generateClientSchema([
      el({ outputAttribute: "dt", typeCode: "date-time" }),
      el({ outputAttribute: "ls", typeCode: "localized-string" }),
    ]);
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.dt).toEqual({ type: "string", format: "date-time" });
    expect(props.ls).toMatchObject({ type: "object" });
  });

  it("still matches the pre-migration UPPER_SNAKE spelling for multi-segment primitives", () => {
    const schema = generateClientSchema([el({ outputAttribute: "dt", typeCode: "DATE_TIME" })]);
    expect((schema.properties as Record<string, Record<string, unknown>>).dt).toEqual({
      type: "string",
      format: "date-time",
    });
  });

  it("silently overwrites when two elements share the same attribute", () => {
    // Documents current behavior: callers must pre-validate with findDuplicateAttributes.
    const schema = generateClientSchema([
      el({ outputAttribute: "email", typeCode: "STRING" }),
      el({ outputAttribute: "email", typeCode: "INTEGER" }),
    ]);
    expect((schema.properties as Record<string, Record<string, unknown>>).email).toEqual({
      type: "integer",
    });
  });
});

// ---------------------------------------------------------------------------
// findDuplicateAttributes
// ---------------------------------------------------------------------------
describe("findDuplicateAttributes", () => {
  it("returns an empty array when all attributes are unique", () => {
    expect(
      findDuplicateAttributes([el({ outputAttribute: "email" }), el({ outputAttribute: "phone" })])
    ).toEqual([]);
  });

  it("returns the duplicated attribute when two elements collide", () => {
    expect(
      findDuplicateAttributes([el({ outputAttribute: "email" }), el({ outputAttribute: "email" })])
    ).toEqual(["email"]);
  });

  it("returns each duplicate only once, even if it appears three times", () => {
    expect(
      findDuplicateAttributes([
        el({ outputAttribute: "email" }),
        el({ outputAttribute: "email" }),
        el({ outputAttribute: "email" }),
      ])
    ).toEqual(["email"]);
  });

  it("falls back to inputAttribute when outputAttribute is missing", () => {
    expect(
      findDuplicateAttributes([
        el({ outputAttribute: "", inputAttribute: "email" }),
        el({ outputAttribute: "", inputAttribute: "email" }),
      ])
    ).toEqual(["email"]);
  });

  it("treats elements with no attribute at all as non-duplicates", () => {
    expect(
      findDuplicateAttributes([
        el({ outputAttribute: "", inputAttribute: "" }),
        el({ outputAttribute: "", inputAttribute: "" }),
      ])
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateJsonAgainstSchema
// ---------------------------------------------------------------------------
describe("validateJsonAgainstSchema", () => {
  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "integer" },
    },
    required: ["name"],
    additionalProperties: false,
  };

  it("returns valid: true when JSON matches schema", async () => {
    const result = await validateJsonAgainstSchema(
      JSON.stringify({ name: "Ada", age: 36 }),
      schema
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.parseError).toBeUndefined();
  });

  it("returns parseError when JSON is malformed", async () => {
    const result = await validateJsonAgainstSchema("{ not json", schema);
    expect(result.valid).toBe(false);
    expect(result.parseError).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  it("returns field-level errors when JSON violates schema", async () => {
    const result = await validateJsonAgainstSchema(JSON.stringify({ name: 42 }), schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatchObject({
      keyword: expect.any(String),
      message: expect.any(String),
    });
  });

  it("reports required-field errors with a keyword of 'required'", async () => {
    const result = await validateJsonAgainstSchema(JSON.stringify({ age: 10 }), schema);
    expect(result.valid).toBe(false);
    const requiredErr = result.errors.find((e) => e.keyword === "required");
    expect(requiredErr).toBeDefined();
  });

  it("preserves AJV's empty-string instancePath for root-level errors", async () => {
    // AJV sets instancePath to "" for errors at the root of the document
    // (e.g., a missing top-level required property). Per JSON Pointer spec
    // "" is the root and is semantically different from "/".
    const result = await validateJsonAgainstSchema(JSON.stringify({ age: 10 }), schema);
    const requiredErr = result.errors.find((e) => e.keyword === "required");
    expect(requiredErr?.path).toBe("");
  });

  it("handles an invalid schema gracefully", async () => {
    const result = await validateJsonAgainstSchema(JSON.stringify({ a: 1 }), {
      type: "not-a-real-type",
    } as unknown as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/Schema compilation failed/);
  });
});

// ---------------------------------------------------------------------------
// copyToClipboard
// ---------------------------------------------------------------------------
describe("copyToClipboard", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    // Restore after each test regardless of path
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("uses navigator.clipboard.writeText when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const ok = await copyToClipboard("hello");
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when navigator.clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: execCommand,
    });

    const ok = await copyToClipboard("hello");
    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when execCommand fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(false),
    });

    const ok = await copyToClipboard("hello");
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatJson
// ---------------------------------------------------------------------------
describe("formatJson", () => {
  it("pretty-prints JSON with 2-space indent by default", () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("honors a custom indent", () => {
    expect(formatJson({ a: 1 }, 4)).toBe('{\n    "a": 1\n}');
  });
});
