/**
 * EntityList Component Tests
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityList } from "./entity-list.js";

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
        fields: ["name", "email", "status"],
        order: 1,
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

const mockData = [
  { id: "1", name: "John Doe", email: "john@example.com", status: "active", points: 1500 },
  { id: "2", name: "Jane Smith", email: "jane@example.com", status: "inactive", points: 2500 },
  { id: "3", name: "Bob Johnson", email: "bob@example.com", status: "active", points: 500 },
];

describe("EntityList", () => {
  it("renders table with schema columns", () => {
    render(<EntityList schema={mockSchema} data={mockData} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Points")).toBeInTheDocument();
  });

  it("renders data rows", () => {
    render(<EntityList schema={mockSchema} data={mockData} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
  });

  it("handles loading state with skeletons", () => {
    render(<EntityList schema={mockSchema} data={[]} isLoading={true} />);

    // Should show skeleton rows, not actual data
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    // Skeletons should be present (they use div with skeleton class)
    const skeletons = document.querySelectorAll(
      ".animate-pulse, [class*='animate-pulse'], [class*='skeleton']"
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("handles empty state", () => {
    render(<EntityList schema={mockSchema} data={[]} />);

    expect(screen.getByText(/no members found/i)).toBeInTheDocument();
  });

  it("handles custom empty state", () => {
    render(
      <EntityList schema={mockSchema} data={[]} emptyState={<div>Custom empty message</div>} />
    );

    expect(screen.getByText("Custom empty message")).toBeInTheDocument();
  });

  it("shows create button when schema.canCreate and onCreateClick provided", () => {
    const onCreateClick = vi.fn();
    render(<EntityList schema={mockSchema} data={mockData} onCreateClick={onCreateClick} />);

    const createButton = screen.getByRole("button", { name: /add member/i });
    expect(createButton).toBeInTheDocument();

    fireEvent.click(createButton);
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it("hides create button when canCreate is false", () => {
    const schemaNoCreate = { ...mockSchema, canCreate: false };
    const onCreateClick = vi.fn();
    render(<EntityList schema={schemaNoCreate} data={mockData} onCreateClick={onCreateClick} />);

    expect(screen.queryByRole("button", { name: /add member/i })).not.toBeInTheDocument();
  });

  it("shows search input when searchable", () => {
    const onSearchChange = vi.fn();
    render(<EntityList schema={mockSchema} data={mockData} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByPlaceholderText(/search members/i);
    expect(searchInput).toBeInTheDocument();
  });

  it("calls onSearchChange on search form submit", () => {
    const onSearchChange = vi.fn();
    render(<EntityList schema={mockSchema} data={mockData} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByPlaceholderText(/search members/i);
    fireEvent.change(searchInput, { target: { value: "john" } });

    // Submit the form
    const form = searchInput.closest("form")!;
    fireEvent.submit(form);

    expect(onSearchChange).toHaveBeenCalledWith("john");
  });

  it("calls onRowClick when row is clicked", () => {
    const onRowClick = vi.fn();
    render(
      <EntityList
        schema={mockSchema}
        data={mockData}
        onRowClick={onRowClick}
        getRowLabel={(r) => `Open ${String(r.name)}`}
      />
    );

    // Click on a row containing John Doe
    const row = screen.getByText("John Doe").closest("tr")!;
    fireEvent.click(row);

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it("calls onSortChange when sortable column header is clicked", () => {
    const onSortChange = vi.fn();
    const schemaWithSortable: UIEntitySchema = {
      ...mockSchema,
      fields: {
        ...mockSchema.fields,
        name: {
          name: "name",
          label: "Name",
          widget: "text",
          displayFormat: "text",
          showInList: true,
          showInDetail: true,
          showInCreate: true,
          showInEdit: true,
          sortable: true,
        },
      },
    };
    render(
      <EntityList
        schema={schemaWithSortable}
        data={mockData}
        onSortChange={onSortChange}
        sort={{ column: "name", direction: "asc" }}
      />
    );

    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);

    expect(onSortChange).toHaveBeenCalledWith({ column: "name", direction: "desc" });
  });

  it("shows row actions dropdown when rowActions provided", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <EntityList
        schema={mockSchema}
        data={mockData}
        rowActions={[
          { id: "edit", label: "Edit", onClick: onEdit },
          { id: "delete", label: "Delete", onClick: onDelete, destructive: true },
        ]}
      />
    );

    // Should have action buttons for each row (DataTable uses "Open menu" as sr-only text)
    const actionButtons = screen.getAllByRole("button", { name: /open menu/i });
    expect(actionButtons.length).toBe(mockData.length);
  });

  it("shows pagination controls when pagination provided", () => {
    const onPaginationChange = vi.fn();
    render(
      <EntityList
        schema={mockSchema}
        data={mockData}
        pagination={{ page: 1, pageSize: 10, total: 50 }}
        onPaginationChange={onPaginationChange}
      />
    );

    // Check that pagination info is displayed
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    // DataTable now exposes page buttons with aria-label="Page N" for a11y.
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    // DataTable has chevron buttons for prev/next
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(1);
  });

  it("calls onPaginationChange when page is changed", () => {
    const onPaginationChange = vi.fn();
    render(
      <EntityList
        schema={mockSchema}
        data={mockData}
        pagination={{ page: 1, pageSize: 10, total: 50 }}
        onPaginationChange={onPaginationChange}
      />
    );

    // DataTable now labels each page button as "Page N".
    const page2Button = screen.getByRole("button", { name: "Page 2" });
    fireEvent.click(page2Button);

    expect(onPaginationChange).toHaveBeenCalledWith({ page: 2, pageSize: 10, total: 50 });
  });

  it("formats different field types correctly", () => {
    const dataWithFormats = [
      { id: "1", name: "Test", email: "test@example.com", status: "active", points: 1500 },
    ];
    render(<EntityList schema={mockSchema} data={dataWithFormats} />);

    // Points should be formatted as number (with comma separator)
    expect(screen.getByText("1,500")).toBeInTheDocument();

    // Status should be displayed as badge
    expect(screen.getByText("active")).toBeInTheDocument();

    // Email should be a link
    const emailLink = screen.getByRole("link", { name: /test@example.com/i });
    expect(emailLink).toHaveAttribute("href", "mailto:test@example.com");
  });

  describe("[security] href sanitization", () => {
    const linkSchema: UIEntitySchema = {
      ...mockSchema,
      fields: {
        ...mockSchema.fields,
        website: {
          name: "website",
          label: "Website",
          widget: "url",
          displayFormat: "link",
          showInList: true,
          showInDetail: true,
          showInCreate: true,
          showInEdit: true,
        },
      },
      list: { ...mockSchema.list, columns: ["name", "website"] },
    };

    it("renders a javascript: email value as plain text, not a mailto link", () => {
      const data = [
        { id: "1", name: "X", email: "javascript:alert(1)", status: "active", points: 1 },
      ];
      render(<EntityList schema={mockSchema} data={data} />);

      expect(screen.queryByRole("link", { name: /javascript:/i })).not.toBeInTheDocument();
      expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    });

    it("renders a javascript: link value as plain text, not an anchor", () => {
      render(
        <EntityList
          schema={linkSchema}
          data={[{ id: "1", name: "X", website: "javascript:alert(1)" }]}
        />
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    });

    it("preserves an https link value as an external anchor", () => {
      render(
        <EntityList
          schema={linkSchema}
          data={[{ id: "1", name: "X", website: "https://safe.example" }]}
        />
      );

      const anchor = screen.getByRole("link", { name: /safe\.example/i });
      expect(anchor).toHaveAttribute("href", "https://safe.example");
      expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("uses custom cell renderer when provided", () => {
    const renderCell = vi.fn((field, value) => {
      if (field.name === "name") {
        return <strong>Custom: {String(value)}</strong>;
      }
      return String(value);
    });

    render(<EntityList schema={mockSchema} data={mockData} renderCell={renderCell} />);

    expect(screen.getByText("Custom: John Doe")).toBeInTheDocument();
    expect(renderCell).toHaveBeenCalled();
  });
});
