import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock @openuidev/react-lang — needed because defineOpenUIComponent calls defineComponent at import time
vi.mock("@openuidev/react-lang", () => ({
  defineComponent: (config: Record<string, unknown>) => ({
    ...config,
    ref: z.any(),
  }),
}));

import { BadgeGroup } from "../components/data-display/badge-group";
import { DataTable } from "../components/data-display/data-table";
import { ListBlock } from "../components/data-display/list-block";

const renderNode = (value: unknown) => <span>{String(value)}</span>;

describe("DataTable", () => {
  const Component = DataTable.component;

  it("renders column headers with scope", () => {
    render(
      <Component
        props={{
          columns: [
            { key: "name", header: "Name" },
            { key: "status", header: "Status" },
          ],
          rows: [{ name: "Alice", status: "Active" }],
        }}
        renderNode={renderNode}
      />
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveAttribute("scope", "col");
    expect(headers[0]).toHaveTextContent("Name");
    expect(headers[1]).toHaveTextContent("Status");
  });

  it("renders row data", () => {
    render(
      <Component
        props={{
          columns: [{ key: "name", header: "Name" }],
          rows: [{ name: "Alice" }, { name: "Bob" }],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders empty state when no rows", () => {
    render(
      <Component
        props={{
          columns: [{ key: "name", header: "Name" }],
          rows: [],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders 'no columns' state when columns empty", () => {
    render(<Component props={{ columns: [], rows: [] }} renderNode={renderNode} />);
    expect(screen.getByText("No columns configured")).toBeInTheDocument();
  });

  it("handles missing cell values gracefully", () => {
    render(
      <Component
        props={{
          columns: [
            { key: "name", header: "Name" },
            { key: "email", header: "Email" },
          ],
          rows: [{ name: "Alice" }],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    const cells = screen.getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("");
  });
});

describe("BadgeGroup", () => {
  const Component = BadgeGroup.component;

  it("renders badges in a list", () => {
    render(
      <Component
        props={{
          badges: [
            { label: "Active", variant: "success" },
            { label: "VIP", variant: "primary" },
          ],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("list")).toHaveAttribute("aria-label", "Badges");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it("handles empty badges array", () => {
    render(<Component props={{ badges: [] }} renderNode={renderNode} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("ListBlock", () => {
  const Component = ListBlock.component;

  it("renders unordered list by default", () => {
    render(
      <Component
        props={{
          items: [{ title: "Item 1", description: "Desc 1" }, { title: "Item 2" }],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("list").tagName).toBe("UL");
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Desc 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("renders ordered list when ordered is true", () => {
    render(
      <Component
        props={{
          items: [{ title: "Step 1" }],
          ordered: true,
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("list").tagName).toBe("OL");
  });

  it("renders optional badges on items", () => {
    render(
      <Component
        props={{
          items: [{ title: "Task", badge: "New" }],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
