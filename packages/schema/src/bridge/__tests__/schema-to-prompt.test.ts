import { describe, expect, it } from "vitest";
import type { UIEntitySchema } from "../../types/ui-schema.js";
import { entitySchemaToPromptFragment } from "../schema-to-prompt.js";

function createMockSchema(overrides?: Partial<UIEntitySchema>): UIEntitySchema {
  return {
    entityCode: "customer",
    singularName: "Customer",
    pluralName: "Customers",
    description: "A loyalty program customer",
    canCreate: true,
    canEdit: true,
    canDelete: false,
    fields: {
      firstName: {
        name: "firstName",
        label: "First Name",
        widget: "text",
        displayFormat: "text",
        showInList: true,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
      email: {
        name: "email",
        label: "Email",
        helpText: "Primary email address",
        widget: "email",
        displayFormat: "email",
        showInList: true,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
      status: {
        name: "status",
        label: "Status",
        widget: "select",
        displayFormat: "badge",
        showInList: true,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
      internalId: {
        name: "internalId",
        label: "Internal ID",
        widget: "hidden",
        displayFormat: "text",
        showInList: false,
        showInDetail: false,
        showInCreate: false,
        showInEdit: false,
      },
    },
    list: {
      columns: ["firstName", "email", "status"],
      searchable: true,
      defaultPageSize: 25,
    },
    detail: { groups: [] },
    create: {
      groups: [
        {
          id: "basic",
          label: "Basic Info",
          fields: ["firstName", "email"],
          order: 0,
        },
        {
          id: "details",
          label: "Details",
          fields: ["status"],
          order: 1,
        },
      ],
    },
    edit: {
      groups: [
        {
          id: "basic",
          label: "Basic Info",
          fields: ["firstName", "email", "status"],
          order: 0,
        },
      ],
    },
    ...overrides,
  };
}

describe("entitySchemaToPromptFragment", () => {
  it("includes entity name and code", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema());
    expect(result).toContain("## Entity: Customer (customer)");
  });

  it("shows capability flags", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema());
    expect(result).toContain("Can create: yes");
    expect(result).toContain("Can edit: yes");
    expect(result).toContain("Can delete: no");
  });

  it("lists create form fields with component names", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema());
    expect(result).toContain("Create Form Fields");
    expect(result).toContain("firstName (TextInput");
    expect(result).toContain('email (TextInput[type="email"]');
    expect(result).toContain("status (Select");
  });

  it("lists edit form fields", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema());
    expect(result).toContain("Edit Form Fields");
  });

  it("includes field groups", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema());
    expect(result).toContain("Field Groups:");
    expect(result).toContain('"Basic Info": firstName, email');
    expect(result).toContain('"Details": status');
  });

  it("skips hidden fields", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema());
    expect(result).not.toContain("internalId");
  });

  it("omits create section when canCreate is false", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema({ canCreate: false }));
    expect(result).not.toContain("Create Form Fields");
    expect(result).toContain("Can create: no");
  });

  it("omits edit section when canEdit is false", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema({ canEdit: false }));
    expect(result).not.toContain("Edit Form Fields");
    expect(result).toContain("Can edit: no");
  });

  it("uses helpText over label for field descriptions", () => {
    const result = entitySchemaToPromptFragment("customer", createMockSchema());
    expect(result).toContain("Primary email address");
  });
});
