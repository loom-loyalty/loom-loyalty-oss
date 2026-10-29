import { describe, expect, it } from "vitest";
import { parseJSONSchema, parseJSONSchemaProperty } from "../../src/parser/json-schema.js";

describe("parseJSONSchemaProperty", () => {
  it("should parse a simple string field", () => {
    const result = parseJSONSchemaProperty(
      "name",
      {
        type: "string",
        description: "User's full name",
        maxLength: 100,
      },
      true
    );

    expect(result.name).toBe("name");
    expect(result.label).toBe("Name");
    expect(result.type).toBe("string");
    expect(result.description).toBe("User's full name");
    expect(result.validation.required).toBe(true);
    expect(result.validation.maxLength).toBe(100);
  });

  it("should parse a number field with constraints", () => {
    const result = parseJSONSchemaProperty(
      "age",
      {
        type: "integer",
        minimum: 0,
        maximum: 150,
      },
      false
    );

    expect(result.type).toBe("integer");
    expect(result.validation.required).toBe(false);
    expect(result.validation.minimum).toBe(0);
    expect(result.validation.maximum).toBe(150);
  });

  it("should parse an enum field", () => {
    const result = parseJSONSchemaProperty(
      "status",
      {
        type: "string",
        enum: ["active", "inactive", "pending"],
        default: "pending",
      },
      true
    );

    expect(result.type).toBe("enum");
    expect(result.validation.enum).toEqual(["active", "inactive", "pending"]);
    expect(result.validation.default).toBe("pending");
  });

  it("should parse a date field from format", () => {
    const result = parseJSONSchemaProperty(
      "birthDate",
      {
        type: "string",
        format: "date",
      },
      false
    );

    expect(result.type).toBe("date");
    expect(result.format).toBe("date");
  });

  it("should parse a datetime field", () => {
    const result = parseJSONSchemaProperty(
      "createdAt",
      {
        type: "string",
        format: "date-time",
      },
      false
    );

    expect(result.type).toBe("datetime");
    expect(result.format).toBe("date-time");
  });

  it("should parse an email field", () => {
    const result = parseJSONSchemaProperty(
      "email",
      {
        type: "string",
        format: "email",
      },
      true
    );

    expect(result.type).toBe("email");
    expect(result.format).toBe("email");
  });

  it("should parse a reference field via x-entity-ref", () => {
    const result = parseJSONSchemaProperty(
      "organizationId",
      {
        type: "string",
        format: "uuid",
        "x-entity-ref": "organization",
        "x-display-field": "name",
      },
      true
    );

    expect(result.type).toBe("reference");
    expect(result.reference).toEqual({
      entityCode: "organization",
      displayField: "name",
      isArray: false,
    });
  });

  it("should parse a reference field via $ref", () => {
    const result = parseJSONSchemaProperty(
      "member",
      {
        $ref: "#/definitions/Member",
      },
      false
    );

    expect(result.type).toBe("reference");
    expect(result.reference?.entityCode).toBe("member");
  });

  it("should parse an array field", () => {
    const result = parseJSONSchemaProperty(
      "tags",
      {
        type: "array",
        items: {
          type: "string",
        },
        minItems: 1,
        maxItems: 10,
      },
      false
    );

    expect(result.type).toBe("array");
    expect(result.items?.type).toBe("string");
    expect(result.validation.minItems).toBe(1);
    expect(result.validation.maxItems).toBe(10);
  });

  it("should parse nested object properties", () => {
    const result = parseJSONSchemaProperty(
      "address",
      {
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          zip: { type: "string", pattern: "^\\d{5}$" },
        },
        required: ["street", "city"],
      },
      false
    );

    expect(result.type).toBe("object");
    expect(result.properties).toBeDefined();
    expect(result.properties?.street.type).toBe("string");
    expect(result.properties?.street.validation.required).toBe(true);
    expect(result.properties?.zip.validation.pattern).toBe("^\\d{5}$");
  });

  it("should handle nullable fields", () => {
    const result = parseJSONSchemaProperty(
      "middleName",
      {
        type: ["string", "null"],
      },
      false
    );

    expect(result.type).toBe("string");
    expect(result.nullable).toBe(true);
  });

  it("should handle readonly fields", () => {
    const result = parseJSONSchemaProperty(
      "id",
      {
        type: "string",
        readOnly: true,
      },
      true
    );

    expect(result.readonly).toBe(true);
  });

  it("should handle writeOnly fields", () => {
    const result = parseJSONSchemaProperty(
      "password",
      {
        type: "string",
        format: "password",
        writeOnly: true,
      },
      true
    );

    expect(result.writeOnly).toBe(true);
    expect(result.format).toBe("password");
  });

  it("should convert snake_case names to labels", () => {
    const result = parseJSONSchemaProperty("first_name", { type: "string" }, false);

    expect(result.label).toBe("First Name");
  });

  it("should use title as label when provided", () => {
    const result = parseJSONSchemaProperty(
      "firstName",
      {
        type: "string",
        title: "Given Name",
      },
      false
    );

    expect(result.label).toBe("Given Name");
  });
});

describe("parseJSONSchema", () => {
  it("should parse a complete entity schema", () => {
    const schema = {
      type: "object",
      title: "Member",
      description: "A loyalty program member",
      "x-entity-code": "member",
      "x-primary-key": "id",
      "x-display-field": "name",
      properties: {
        id: { type: "string", format: "uuid", readOnly: true },
        name: { type: "string", maxLength: 100 },
        email: { type: "string", format: "email" },
        status: { type: "string", enum: ["active", "inactive"] },
        createdAt: { type: "string", format: "date-time", readOnly: true },
        updatedAt: { type: "string", format: "date-time", readOnly: true },
      },
      required: ["name", "email"],
    };

    const result = parseJSONSchema(schema);

    expect(result.code).toBe("member");
    expect(result.name).toBe("Member");
    expect(result.description).toBe("A loyalty program member");
    expect(result.primaryKey).toBe("id");
    expect(result.displayField).toBe("name");
    expect(result.fieldOrder).toEqual(["id", "name", "email", "status", "createdAt", "updatedAt"]);
    expect(result.fields.name.validation.required).toBe(true);
    expect(result.fields.email.validation.required).toBe(true);
    expect(result.fields.status.validation.required).toBe(false);
  });

  it("should auto-detect timestamps", () => {
    const schema = {
      type: "object",
      "x-entity-code": "test",
      properties: {
        id: { type: "string" },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
    };

    const result = parseJSONSchema(schema);

    expect(result.timestamps?.createdAt).toBe("created_at");
    expect(result.timestamps?.updatedAt).toBe("updated_at");
  });

  it("should auto-detect display field from common names", () => {
    const schema = {
      type: "object",
      "x-entity-code": "category",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
      },
    };

    const result = parseJSONSchema(schema);

    expect(result.displayField).toBe("name");
  });

  it("should throw error when entity code is missing", () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    };

    expect(() => parseJSONSchema(schema)).toThrow("Entity code is required");
  });

  it("should accept entity code from options", () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    };

    const result = parseJSONSchema(schema, { entityCode: "custom_entity" });

    expect(result.code).toBe("custom_entity");
    expect(result.name).toBe("Custom Entity");
  });
});
