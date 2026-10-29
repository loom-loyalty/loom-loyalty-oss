import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { FieldReviewTable } from "./field-review-table.js";
import type { BuilderFieldRow, BuilderTypeOption, FieldReviewTableProps } from "./types.js";

// Radix Select probes pointer capture, which jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
});

const TYPE_OPTIONS: BuilderTypeOption[] = [
  { code: "STRING", label: "STRING" },
  { code: "NUMBER", label: "NUMBER" },
  { code: "ORDER_LINE", label: "Order Line (ORDER_LINE)" },
];

const INHERITED_ROW: BuilderFieldRow = {
  field: {
    _rowKey: "inh",
    name: "Transaction Id",
    inputAttribute: "transactionId",
    typeCode: "STRING",
    required: true,
  },
  state: "inherited",
  source: "inherited",
};

const EDITABLE_ROW: BuilderFieldRow = {
  field: { _rowKey: "edit", name: "Email", inputAttribute: "email", typeCode: "STRING" },
  state: "editable",
  source: "ai",
};

const NUMERIC_ROW: BuilderFieldRow = {
  field: { _rowKey: "amt", name: "Amount", inputAttribute: "amount", typeCode: "NUMBER" },
  state: "editable",
  source: "manual",
};

const NESTED_ROW: BuilderFieldRow = {
  field: {
    _rowKey: "nest",
    name: "Line Items",
    inputAttribute: "lineItems",
    typeCode: "ORDER_LINE",
    isArray: true,
  },
  state: "needs-review-nested",
  source: "ai",
  nested: [
    { field: { _rowKey: "n1", name: "Sku", typeCode: "STRING" }, state: "editable", source: "ai" },
    {
      field: { _rowKey: "n2", name: "Amount", typeCode: "NUMBER" },
      state: "editable",
      source: "ai",
    },
  ],
};

function renderTable(overrides: Partial<FieldReviewTableProps> = {}) {
  const props: FieldReviewTableProps = {
    rows: [INHERITED_ROW, EDITABLE_ROW, NESTED_ROW],
    typeOptions: TYPE_OPTIONS,
    onFieldChange: vi.fn(),
    onFieldMarkAsNestedArray: vi.fn(),
    onFieldDelete: vi.fn(),
    onNestedTypeNameChange: vi.fn(),
    onAddField: vi.fn(),
    onNestedFieldChange: vi.fn(),
    onNestedFieldDelete: vi.fn(),
    onNestedFieldAdd: vi.fn(),
    onAcceptAll: vi.fn(),
    onViewJsonSchema: vi.fn(),
    ...overrides,
  };
  return { ...render(<FieldReviewTable {...props} />), props };
}

describe("FieldReviewTable", () => {
  it("renders the header with a count badge and both actions", () => {
    renderTable();
    expect(screen.getByRole("heading", { name: "Fields" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view as json schema/i })).toBeInTheDocument();
  });

  it("has no 'in traffic' column: that mechanic was dropped", () => {
    renderTable();
    expect(screen.queryByText(/in traffic/i)).toBeNull();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Label",
      "Field",
      "Type",
      "Metric",
      "Req",
      "Row actions",
    ]);
  });

  it("renders an inherited row locked: no editable name, no type select, no delete", () => {
    const { container } = renderTable({ rows: [INHERITED_ROW] });
    const row = container.querySelector('tr[data-row-state="inherited"]');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Transaction Id")).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByRole("textbox")).toBeNull();
    expect(within(row as HTMLElement).queryByRole("combobox")).toBeNull();
    expect(within(row as HTMLElement).queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.getByText(/inherited from the parent type/i)).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Inherited.")).toHaveClass("sr-only");
    expect(screen.getByRole("checkbox", { name: /required for transaction id/i })).toBeDisabled();
  });

  it("renders an editable row with a working name input, type select and delete action", () => {
    const { container, props } = renderTable({ rows: [EDITABLE_ROW] });
    const row = container.querySelector('tr[data-row-state="editable"]');
    expect(row).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Field 1 name"), { target: { value: "Email Address" } });
    expect(props.onFieldChange).toHaveBeenCalledWith(0, { name: "Email Address" });

    fireEvent.click(screen.getByRole("button", { name: "Delete Email" }));
    expect(props.onFieldDelete).toHaveBeenCalledWith(0);
  });

  it("edits the field element name (attribute) as its own input", () => {
    const { props } = renderTable({ rows: [EDITABLE_ROW] });
    const attribute = screen.getByLabelText("Field 1 attribute");
    expect(attribute).toHaveValue("email");

    fireEvent.change(attribute, { target: { value: "emailAddress" } });
    expect(props.onFieldChange).toHaveBeenCalledWith(0, { inputAttribute: "emailAddress" });
  });

  it("offers an empty attribute input for a row that has no attribute yet", () => {
    renderTable({
      rows: [
        {
          field: { _rowKey: "new", name: "", typeCode: "STRING" },
          state: "editable",
          source: "manual",
        },
      ],
    });
    expect(screen.getByLabelText("Field 1 attribute")).toHaveValue("");
  });

  it("updates a row's type through the inline Select", () => {
    const { props } = renderTable({ rows: [EDITABLE_ROW] });
    fireEvent.click(screen.getByLabelText("Type for Email"));
    fireEvent.click(within(document.body).getByRole("option", { name: "NUMBER" }));
    expect(props.onFieldChange).toHaveBeenCalledWith(0, { typeCode: "NUMBER" });
  });

  it("marks a row as an array of objects from the Type select", () => {
    const { props } = renderTable({ rows: [EDITABLE_ROW] });
    fireEvent.click(screen.getByLabelText("Type for Email"));
    fireEvent.click(within(document.body).getByRole("option", { name: "Array of objects..." }));
    expect(props.onFieldMarkAsNestedArray).toHaveBeenCalledWith(0);
    expect(props.onFieldChange).not.toHaveBeenCalledWith(0, { typeCode: expect.any(String) });
  });

  it("offers the metric role select for a metric-eligible numeric field", () => {
    const { props } = renderTable({ rows: [NUMERIC_ROW] });
    fireEvent.click(screen.getByLabelText("Metric role for Amount"));
    fireEvent.click(within(document.body).getByRole("option", { name: "Revenue" }));
    expect(props.onFieldChange).toHaveBeenCalledWith(0, { metricRole: "REVENUE" });
  });

  it("hides the metric role select for a non-numeric field", () => {
    renderTable({ rows: [EDITABLE_ROW] });
    expect(screen.queryByLabelText(/metric role for/i)).toBeNull();
  });

  it("hides the metric role select for an inherited row even if numeric", () => {
    renderTable({
      rows: [
        {
          field: { _rowKey: "inh-num", name: "Total", typeCode: "NUMBER" },
          state: "inherited",
          source: "inherited",
        },
      ],
    });
    expect(screen.queryByLabelText(/metric role for/i)).toBeNull();
  });

  it("toggles the Required checkbox", () => {
    const { props } = renderTable({ rows: [EDITABLE_ROW] });
    fireEvent.click(screen.getByRole("checkbox", { name: "Required for Email" }));
    expect(props.onFieldChange).toHaveBeenCalledWith(0, { required: true });
  });

  it("renders a needs-review-nested row warning-tinted with its nested sub-table", () => {
    const { container } = renderTable({ rows: [NESTED_ROW] });
    const row = container.querySelector('tr[data-row-state="needs-review-nested"]');
    expect(row?.className).toContain("bg-warning/10");
    expect(
      screen.getByText(/nested fields \(\d+\): declare so rules can read them/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nested field 1 name")).toHaveValue("Sku");
  });

  it("indents the nested sub-table into its own bounded block", () => {
    const { container } = renderTable({ rows: [NESTED_ROW] });
    const block = container.querySelector(
      'tr[data-row-state="needs-review-nested-detail"] .rounded-md.border'
    );
    expect(block?.className).toContain("ml-6");
    expect(block?.className).toContain("border-warning/30");
  });

  it("edits a nested field's attribute as its own input", () => {
    const { props } = renderTable({ rows: [NESTED_ROW] });
    const attribute = screen.getByLabelText("Nested field 1 attribute");
    expect(attribute).toHaveValue("");

    fireEvent.change(attribute, { target: { value: "sku" } });
    expect(props.onNestedFieldChange).toHaveBeenCalledWith(0, 0, { inputAttribute: "sku" });
  });

  it("offers the metric role select for a metric-eligible nested numeric field", () => {
    const { props } = renderTable({ rows: [NESTED_ROW] });
    fireEvent.click(screen.getByLabelText("Metric role for nested field Amount"));
    fireEvent.click(within(document.body).getByRole("option", { name: "Revenue" }));
    expect(props.onNestedFieldChange).toHaveBeenCalledWith(0, 1, { metricRole: "REVENUE" });
  });

  it("hides the metric role select for a non-numeric nested field", () => {
    renderTable({ rows: [NESTED_ROW] });
    expect(screen.queryByLabelText("Metric role for nested field Sku")).toBeNull();
  });

  it("edits the child type name", () => {
    const { props } = renderTable({ rows: [NESTED_ROW] });
    const input = screen.getByLabelText("Type name");
    fireEvent.change(input, { target: { value: "Line Item" } });
    expect(props.onNestedTypeNameChange).toHaveBeenCalledWith(0, "Line Item");
  });

  it("collapses and re-expands the nested sub-table", () => {
    renderTable({ rows: [NESTED_ROW] });
    const trigger = screen.getByRole("button", { name: /nested fields \(2\)/i });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Nested field 1 name")).toBeInTheDocument();
  });

  it("routes nested-row callbacks with both the parent and nested index", () => {
    const { props } = renderTable({ rows: [EDITABLE_ROW, NESTED_ROW] });

    fireEvent.change(screen.getByLabelText("Nested field 1 name"), { target: { value: "SKU" } });
    expect(props.onNestedFieldChange).toHaveBeenCalledWith(1, 0, { name: "SKU" });

    fireEvent.click(screen.getByRole("button", { name: "Delete nested field Sku" }));
    expect(props.onNestedFieldDelete).toHaveBeenCalledWith(1, 0);

    fireEvent.click(screen.getByRole("button", { name: /add nested field/i }));
    expect(props.onNestedFieldAdd).toHaveBeenCalledWith(1);
  });

  it("surfaces the unresolved-nested hint only while a nested row is unresolved", () => {
    const { unmount } = renderTable({ rows: [NESTED_ROW] });
    expect(screen.getByText(/declare the nested array's fields to finish/i)).toBeInTheDocument();
    unmount();

    renderTable({ rows: [EDITABLE_ROW] });
    expect(screen.queryByText(/declare the nested array's fields to finish/i)).toBeNull();
  });

  it("shows an empty state and hides Accept all when there are no rows", () => {
    renderTable({ rows: [] });
    expect(screen.getByText(/no fields yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept all/i })).toBeDisabled();
  });

  it("hides Accept all / View as JSON Schema when their callbacks are omitted", () => {
    renderTable({ onAcceptAll: undefined, onViewJsonSchema: undefined });
    expect(screen.queryByRole("button", { name: /accept all/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /view as json schema/i })).toBeNull();
  });

  it("calls onAddField from the table footer action", () => {
    const { props } = renderTable();
    fireEvent.click(screen.getByRole("button", { name: /^add field$/i }));
    expect(props.onAddField).toHaveBeenCalledTimes(1);
  });
});
