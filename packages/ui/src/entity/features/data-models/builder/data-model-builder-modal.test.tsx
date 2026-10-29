import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataModelBuilderModal } from "./data-model-builder-modal.js";
import type { BuilderFieldRow, DataModelBuilderModalProps } from "./types.js";

const EDITABLE_ROW: BuilderFieldRow = {
  field: { _rowKey: "a", name: "Email", inputAttribute: "email", typeCode: "STRING" },
  state: "editable",
  source: "ai",
};

const NESTED_ROW: BuilderFieldRow = {
  field: { _rowKey: "b", name: "Line Items", typeCode: "ORDER_LINE", isArray: true },
  state: "needs-review-nested",
  source: "ai",
};

function baseProps(
  overrides: Partial<DataModelBuilderModalProps> = {}
): DataModelBuilderModalProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    name: "Order completed",
    onNameChange: vi.fn(),
    extendsCode: "",
    onExtendsChange: vi.fn(),
    extendsOptions: [{ id: "TRANSACTION", name: "Transaction", secondaryText: "TRANSACTION" }],
    mode: "describe",
    onModeChange: vi.fn(),
    describe: { value: "", onValueChange: vi.fn(), onGenerate: vi.fn() },
    pasteSchema: { value: "", onValueChange: vi.fn() },
    sample: { onFileSelected: vi.fn(), onLoadSample: vi.fn() },
    fields: {
      rows: [EDITABLE_ROW],
      typeOptions: [{ code: "STRING", label: "STRING" }],
      onFieldChange: vi.fn(),
      onFieldMarkAsNestedArray: vi.fn(),
      onFieldDelete: vi.fn(),
      onNestedTypeNameChange: vi.fn(),
      onAddField: vi.fn(),
      onNestedFieldChange: vi.fn(),
      onNestedFieldDelete: vi.fn(),
      onNestedFieldAdd: vi.fn(),
    },
    onSubmit: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides: Partial<DataModelBuilderModalProps> = {}) {
  const props = baseProps(overrides);
  return { ...render(<DataModelBuilderModal {...props} />), props };
}

describe("DataModelBuilderModal", () => {
  it("caps the desktop dialog within the viewport while preserving its 1240x960 layout", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("w-[min(1240px,95vw)]");
    expect(dialog.className).toContain("h-[960px]");
    expect(dialog.className).toContain("max-w-none");
    expect(dialog.className).toContain("max-h-[92vh]");
  });

  it("lets the body row shrink so the rail scrolls instead of squashing its CTA", () => {
    const { container } = renderModal();
    const dialog = screen.getByRole("dialog");
    // Without a minmax(0,1fr) body track the rail can never scroll, which is
    // exactly how the generate button gets squeezed out of view.
    expect(dialog.className).toContain("grid-rows-[auto_minmax(0,1fr)_auto]");
    expect(container.ownerDocument.querySelector(".overflow-y-auto")).not.toBeNull();
  });

  it("renders the header title and purpose sentence", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "New data model type" })).toBeInTheDocument();
    expect(
      screen.getByText(/defines the payload shape events of this type must match/i)
    ).toBeInTheDocument();
  });

  it("shows the provenance line only when opened from another surface", () => {
    const { unmount } = renderModal({ originLabel: "Configure event type" });
    expect(screen.getByText(/opened from/i)).toBeInTheDocument();
    unmount();

    renderModal();
    expect(screen.queryByText(/opened from/i)).toBeNull();
  });

  it("swaps the rail panel when the mode changes", () => {
    const { rerender } = renderModal({ mode: "describe" });
    expect(screen.getByLabelText(/what does this event contain/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/json schema or sample payload/i)).toBeNull();

    rerender(<DataModelBuilderModal {...baseProps({ mode: "paste-schema" })} />);
    expect(screen.getByLabelText(/json schema or sample payload/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/what does this event contain/i)).toBeNull();

    rerender(<DataModelBuilderModal {...baseProps({ mode: "field-by-field" })} />);
    expect(screen.getByText(/add each field with/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/json schema or sample payload/i)).toBeNull();

    rerender(<DataModelBuilderModal {...baseProps({ mode: "sample" })} />);
    expect(screen.getByRole("button", { name: /load stripe sample/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /drop a csv of your data/i })).toBeInTheDocument();
  });

  it("promises a return trip and offers 'Create & use' when opened from another surface", () => {
    renderModal({ originLabel: "Configure event type" });
    expect(screen.getByText(/returns you to.*with this model selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create & use" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Create$/ })).toBeNull();
  });

  it("offers a plain 'Create' with no return-trip copy when opened standalone", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.queryByText(/returns you to/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /create & use/i })).toBeNull();
  });

  it("disables the primary action while any row still needs its nested shape declared", () => {
    const props = baseProps({ originLabel: "Configure event type" });
    const { rerender } = render(
      <DataModelBuilderModal
        {...props}
        fields={{ ...props.fields, rows: [EDITABLE_ROW, NESTED_ROW] }}
      />
    );
    expect(screen.getByRole("button", { name: "Create & use" })).toBeDisabled();

    rerender(
      <DataModelBuilderModal {...props} fields={{ ...props.fields, rows: [EDITABLE_ROW] }} />
    );
    expect(screen.getByRole("button", { name: "Create & use" })).toBeEnabled();
  });

  it("requires a name before the primary action is enabled", () => {
    renderModal({ name: "   " });
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("marks Extends required and replaces the empty-parent placeholder when constrained", () => {
    renderModal({ extendsRequired: true });

    expect(screen.getByText("Extends", { selector: "label" })).toHaveTextContent("*");
    expect(screen.getByRole("combobox", { name: /extends/i })).toHaveTextContent(
      "Select a parent data model..."
    );
    expect(screen.queryByText("Nothing, start empty")).toBeNull();
  });

  it("keeps Extends optional for standalone builder flows", () => {
    renderModal();

    expect(screen.getByText("Extends", { selector: "label" })).not.toHaveTextContent("*");
    expect(screen.getByText("Nothing, start empty")).toBeInTheDocument();
  });

  it("submits and cancels through their callbacks", () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders a submission error inline and locks both footer buttons while submitting", () => {
    const { unmount } = renderModal({ error: "Type code already exists." });
    expect(screen.getByRole("alert")).toHaveTextContent("Type code already exists.");
    unmount();

    renderModal({ isSubmitting: true });
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("announces asynchronous submission progress through a polite live region", () => {
    renderModal({ statusMessage: "Creating the data model type..." });

    expect(screen.getByRole("status")).toHaveTextContent("Creating the data model type...");
  });

  it("renders nothing when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
