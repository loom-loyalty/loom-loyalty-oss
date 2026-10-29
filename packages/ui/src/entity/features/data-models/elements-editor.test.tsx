import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ElementsEditor } from "./elements-editor";
import type { DataModelElementFormData } from "./types";

const ELS: DataModelElementFormData[] = [
  { _rowKey: "a", name: "Email", inputAttribute: "email", typeCode: "STRING", required: true },
  { _rowKey: "b", name: "Score", inputAttribute: "score", typeCode: "NUMBER", required: false },
];

function baseProps(overrides: Partial<React.ComponentProps<typeof ElementsEditor>> = {}) {
  return {
    elements: ELS,
    onAddElement: vi.fn(),
    onEditElement: vi.fn(),
    onDeleteElement: vi.fn(),
    ...overrides,
  };
}

describe("ElementsEditor", () => {
  it("renders a row per element with name, attribute, and type", () => {
    render(<ElementsEditor {...baseProps()} />);
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("email")).toBeTruthy();
    expect(screen.getByText("Score")).toBeTruthy();
    expect(screen.getByText("NUMBER")).toBeTruthy();
  });

  it("shows the empty state and Add First Element when there are no elements", () => {
    const onAddElement = vi.fn();
    render(<ElementsEditor {...baseProps({ elements: [], onAddElement })} />);
    expect(screen.getByText(/no elements yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add first element/i }));
    expect(onAddElement).toHaveBeenCalledTimes(1);
  });

  it("calls onEditElement / onDeleteElement from the per-row action buttons", () => {
    const onEditElement = vi.fn();
    const onDeleteElement = vi.fn();
    render(<ElementsEditor {...baseProps({ onEditElement, onDeleteElement })} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Email" }));
    expect(onEditElement).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Delete Score" }));
    expect(onDeleteElement).toHaveBeenCalledWith(1);
  });

  it("hides Bulk Import unless onBulkImport is provided, and wires it when it is", () => {
    const { unmount } = render(<ElementsEditor {...baseProps()} />);
    expect(screen.queryByRole("button", { name: /bulk import/i })).toBeNull();
    unmount();

    const onBulkImport = vi.fn();
    render(<ElementsEditor {...baseProps({ onBulkImport })} />);
    fireEvent.click(screen.getByRole("button", { name: /bulk import/i }));
    expect(onBulkImport).toHaveBeenCalledTimes(1);
  });

  it("does NOT make the table row itself a button (a11y: no nested interactive rows)", () => {
    const { container } = render(<ElementsEditor {...baseProps()} />);
    expect(container.querySelector('tr[role="button"]')).toBeNull();
    // The row's edit affordance is the explicit Edit button, not the row.
    expect(screen.getByRole("button", { name: "Edit Email" })).toBeTruthy();
  });

  it("disables the header actions when disabled", () => {
    render(<ElementsEditor {...baseProps({ disabled: true })} />);
    expect(
      (screen.getByRole("button", { name: /add element/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
