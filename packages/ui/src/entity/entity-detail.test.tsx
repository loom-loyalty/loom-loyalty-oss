/**
 * EntityDetail Component Tests
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityDetail, EntityDetailFields } from "./entity-detail.js";

const mockSchema: UIEntitySchema = {
  entityCode: "member",
  singularName: "Member",
  pluralName: "Members",
  icon: "Users",
  displayField: "name",
  canCreate: true,
  canEdit: true,
  canDelete: true,
  fields: {
    id: {
      name: "id",
      label: "ID",
      widget: "text",
      displayFormat: "text",
      showInList: false,
      showInDetail: true,
      showInCreate: false,
      showInEdit: false,
    },
    name: {
      name: "name",
      label: "Name",
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
    points: {
      name: "points",
      label: "Points",
      widget: "number",
      displayFormat: "number",
      showInList: true,
      showInDetail: true,
      showInCreate: false,
      showInEdit: true,
    },
    bio: {
      name: "bio",
      label: "Bio",
      widget: "textarea",
      displayFormat: "textarea",
      showInList: false,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    website: {
      name: "website",
      label: "Website",
      widget: "url",
      displayFormat: "link",
      showInList: false,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    tags: {
      name: "tags",
      label: "Tags",
      widget: "tags",
      displayFormat: "tags",
      showInList: false,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    isVip: {
      name: "isVip",
      label: "VIP Member",
      widget: "switch",
      displayFormat: "boolean",
      showInList: false,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    metadata: {
      name: "metadata",
      label: "Metadata",
      widget: "json",
      displayFormat: "json",
      showInList: false,
      showInDetail: true,
      showInCreate: false,
      showInEdit: true,
    },
  },
  list: {
    columns: ["name", "email", "status", "points"],
    defaultSort: "name",
    defaultSortDirection: "asc",
    searchable: true,
    pageSizes: [10, 25, 50],
  },
  detail: {
    groups: [
      {
        id: "basic",
        label: "Basic Information",
        fields: ["name", "email", "status", "points"],
        order: 1,
      },
      {
        id: "profile",
        label: "Profile",
        fields: ["bio", "website", "tags"],
        order: 2,
      },
      {
        id: "settings",
        label: "Settings",
        fields: ["isVip", "metadata"],
        order: 3,
      },
    ],
    showTimestamps: true,
  },
  create: {
    groups: [
      {
        id: "basic",
        label: "Basic Information",
        fields: ["name", "email", "status"],
        order: 1,
      },
    ],
    showCancel: true,
    showReset: true,
    submitLabel: "Create Member",
  },
  edit: {
    groups: [
      {
        id: "basic",
        label: "Basic Information",
        fields: ["name", "email", "status", "points"],
        order: 1,
      },
    ],
    showCancel: true,
    submitLabel: "Save Changes",
  },
};

const mockData = {
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  status: "active",
  points: 1500,
  bio: "A long-time member and advocate.",
  website: "https://johndoe.com",
  tags: ["VIP", "Early Adopter"],
  isVip: true,
  metadata: { source: "web" },
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-06-20T14:30:00Z",
};

describe("EntityDetail", () => {
  it("renders field groups from schema", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    // Check group labels
    expect(screen.getByText("Basic Information")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders field labels and values", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    // "John Doe" appears both in header and field value, so use getAllByText
    expect(screen.getAllByText("John Doe")).toHaveLength(2);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("displays the entity name in the header", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    // displayField is "name", so header should show "John Doe"
    expect(screen.getByRole("heading", { name: /john doe/i })).toBeInTheDocument();
  });

  it("handles loading state with skeleton", () => {
    render(<EntityDetail schema={mockSchema} data={null} isLoading={true} />);

    // Should show skeleton, not actual data
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    const skeletons = document.querySelectorAll(
      ".animate-pulse, [class*='animate-pulse'], [class*='skeleton']"
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("handles null data with empty state", () => {
    render(<EntityDetail schema={mockSchema} data={null} />);

    expect(screen.getByText(/member not found/i)).toBeInTheDocument();
  });

  it("handles custom empty state", () => {
    render(
      <EntityDetail
        schema={mockSchema}
        data={null}
        emptyState={<div>Custom not found message</div>}
      />
    );

    expect(screen.getByText("Custom not found message")).toBeInTheDocument();
  });

  it("shows back button when onBackClick provided", () => {
    const onBackClick = vi.fn();
    render(<EntityDetail schema={mockSchema} data={mockData} onBackClick={onBackClick} />);

    const backButton = screen.getByRole("button", { name: /back/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(onBackClick).toHaveBeenCalledTimes(1);
  });

  it("shows edit button when canEdit and onEditClick provided", () => {
    const onEditClick = vi.fn();
    render(<EntityDetail schema={mockSchema} data={mockData} onEditClick={onEditClick} />);

    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);
    expect(onEditClick).toHaveBeenCalledTimes(1);
  });

  it("hides edit button when canEdit is false", () => {
    const schemaReadOnly = { ...mockSchema, canEdit: false };
    const onEditClick = vi.fn();
    render(<EntityDetail schema={schemaReadOnly} data={mockData} onEditClick={onEditClick} />);

    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("shows timestamps when enabled", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} showTimestamps={true} />);

    expect(screen.getByText(/created:/i)).toBeInTheDocument();
    expect(screen.getByText(/updated:/i)).toBeInTheDocument();
  });

  it("hides timestamps when disabled", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} showTimestamps={false} />);

    expect(screen.queryByText(/created:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/updated:/i)).not.toBeInTheDocument();
  });

  it("formats email as link", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    const emailLink = screen.getByRole("link", { name: /john@example.com/i });
    expect(emailLink).toHaveAttribute("href", "mailto:john@example.com");
  });

  it("formats website as external link", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    const websiteLink = screen.getByRole("link", { name: /johndoe\.com/i });
    expect(websiteLink).toHaveAttribute("href", "https://johndoe.com");
    expect(websiteLink).toHaveAttribute("target", "_blank");
    expect(websiteLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render a javascript: website as a link (href XSS guard)", () => {
    render(
      <EntityDetail schema={mockSchema} data={{ ...mockData, website: "javascript:alert(1)" }} />
    );

    expect(screen.queryByRole("link", { name: /javascript:/i })).not.toBeInTheDocument();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("does not render a javascript: email as a mailto link (href XSS guard)", () => {
    render(
      <EntityDetail schema={mockSchema} data={{ ...mockData, email: "javascript:alert(1)" }} />
    );

    expect(screen.queryByRole("link", { name: /javascript:/i })).not.toBeInTheDocument();
  });

  it("formats number fields with proper formatting", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    expect(screen.getByText("1,500")).toBeInTheDocument();
  });

  it("formats badge/status fields", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    const statusBadge = screen.getByText("active");
    expect(statusBadge).toBeInTheDocument();
  });

  it("formats boolean fields as badges", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    // isVip is true, so should show "Yes"
    const yesText = screen.getByText("Yes");
    expect(yesText).toBeInTheDocument();
  });

  it("formats tags as badge list", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("Early Adopter")).toBeInTheDocument();
  });

  it("formats JSON fields with pre-formatted display", () => {
    render(<EntityDetail schema={mockSchema} data={mockData} />);

    // JSON should be displayed as formatted text
    const jsonContent = screen.getByText(/"source": "web"/);
    expect(jsonContent).toBeInTheDocument();
  });

  it("handles null/undefined values gracefully", () => {
    const dataWithNulls = {
      ...mockData,
      website: null,
      bio: undefined,
    };
    render(<EntityDetail schema={mockSchema} data={dataWithNulls} />);

    // Should show placeholder for null values (em dash)
    const placeholders = screen.getAllByText("—");
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it("shows additional actions when provided", () => {
    const onExport = vi.fn();
    render(
      <EntityDetail
        schema={mockSchema}
        data={mockData}
        actions={[{ id: "export", label: "Export", onClick: onExport }]}
      />
    );

    // Should have a dropdown with the action
    const moreButton = screen.getByRole("button", { name: /more actions/i });
    expect(moreButton).toBeInTheDocument();
  });

  it("uses custom field renderer when provided", () => {
    const renderField = vi.fn((field, value) => {
      if (field.name === "name") {
        return <span>Custom: {String(value)}</span>;
      }
      return null;
    });

    render(<EntityDetail schema={mockSchema} data={mockData} renderField={renderField} />);

    expect(screen.getByText("Custom: John Doe")).toBeInTheDocument();
    expect(renderField).toHaveBeenCalled();
  });
});

describe("EntityDetailFields", () => {
  it("renders supplied fields with their labels and type-aware formatting", () => {
    render(
      <EntityDetailFields
        fields={[mockSchema.fields.points!, mockSchema.fields.isVip!]}
        data={{ points: 1500, isVip: true }}
      />
    );

    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("VIP Member")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });
});
