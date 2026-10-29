import { describe, expect, it } from "vitest";
import { generateUISchema } from "../../src/generator/ui-schema.js";
import type { ParsedEntitySchema } from "../../src/types/schema.js";

describe("generateUISchema", () => {
  const sampleEntitySchema: ParsedEntitySchema = {
    code: "member",
    name: "Member",
    description: "A loyalty program member",
    primaryKey: "id",
    displayField: "name",
    fields: {
      id: {
        name: "id",
        label: "ID",
        type: "uuid",
        validation: { required: true },
        readonly: true,
      },
      name: {
        name: "name",
        label: "Name",
        type: "string",
        validation: { required: true, maxLength: 100 },
      },
      email: {
        name: "email",
        label: "Email",
        type: "email",
        validation: { required: true },
      },
      status: {
        name: "status",
        label: "Status",
        type: "enum",
        validation: { required: true, enum: ["active", "inactive", "pending"] },
      },
      points: {
        name: "points",
        label: "Points",
        type: "integer",
        validation: { required: false, minimum: 0 },
      },
      createdAt: {
        name: "createdAt",
        label: "Created At",
        type: "datetime",
        validation: { required: false },
        readonly: true,
      },
    },
    fieldOrder: ["id", "name", "email", "status", "points", "createdAt"],
    timestamps: {
      createdAt: "createdAt",
    },
  };

  it("should generate entity names correctly", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.entityCode).toBe("member");
    expect(result.singularName).toBe("Member");
    expect(result.pluralName).toBe("Members");
  });

  it("should generate field configurations", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.fields.name).toBeDefined();
    expect(result.fields.name.widget).toBe("text");
    expect(result.fields.name.displayFormat).toBe("text");

    expect(result.fields.email).toBeDefined();
    expect(result.fields.email.widget).toBe("email");
    expect(result.fields.email.displayFormat).toBe("email");

    expect(result.fields.status).toBeDefined();
    expect(result.fields.status.widget).toBe("select");
  });

  it("should hide system fields from list by default", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.fields.id.showInList).toBe(false);
    expect(result.fields.createdAt.showInList).toBe(false);
    expect(result.fields.name.showInList).toBe(true);
  });

  it("should exclude readonly fields from create form", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.fields.id.showInCreate).toBe(false);
    expect(result.fields.createdAt.showInCreate).toBe(false);
    expect(result.fields.name.showInCreate).toBe(true);
  });

  it("should generate list configuration", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.list.columns).toContain("name");
    expect(result.list.columns).not.toContain("id");
    expect(result.list.columns).not.toContain("createdAt");
    expect(result.list.defaultSort).toBe("name");
    expect(result.list.searchable).toBe(true);
  });

  it("should prioritize display field in list columns", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.list.columns[0]).toBe("name");
  });

  it("should generate detail configuration with groups", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.detail.groups).toBeDefined();
    expect(result.detail.groups.length).toBeGreaterThan(0);
    expect(result.detail.showTimestamps).toBe(true);
  });

  it("should generate form configurations", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.create.groups).toBeDefined();
    expect(result.create.submitLabel).toBe("Create");
    expect(result.create.showCancel).toBe(true);

    expect(result.edit.groups).toBeDefined();
    expect(result.edit.submitLabel).toBe("Save Changes");
  });

  it("should respect custom options", () => {
    const result = generateUISchema(sampleEntitySchema, {
      singularName: "Customer",
      pluralName: "Customers",
      icon: "users",
      canDelete: false,
    });

    expect(result.singularName).toBe("Customer");
    expect(result.pluralName).toBe("Customers");
    expect(result.icon).toBe("users");
    expect(result.canDelete).toBe(false);
    expect(result.canCreate).toBe(true);
  });

  it("should limit list columns to maxListColumns", () => {
    const result = generateUISchema(sampleEntitySchema, {
      maxListColumns: 3,
    });

    expect(result.list.columns.length).toBeLessThanOrEqual(3);
  });

  it("should set default capabilities", () => {
    const result = generateUISchema(sampleEntitySchema);

    expect(result.canCreate).toBe(true);
    expect(result.canEdit).toBe(true);
    expect(result.canDelete).toBe(true);
  });

  it("should pluralize entity names correctly", () => {
    const categorySchema: ParsedEntitySchema = {
      ...sampleEntitySchema,
      code: "category",
      name: "Category",
    };

    const result = generateUISchema(categorySchema);
    expect(result.pluralName).toBe("Categories");

    const taxSchema: ParsedEntitySchema = {
      ...sampleEntitySchema,
      code: "tax",
      name: "Tax",
    };

    const taxResult = generateUISchema(taxSchema);
    expect(taxResult.pluralName).toBe("Taxes");
  });
});
