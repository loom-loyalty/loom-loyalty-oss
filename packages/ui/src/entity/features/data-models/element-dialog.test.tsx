import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ElementDialog } from "./element-dialog";
import type { DataModelElementFormData } from "./types";

// Radix Select relies on pointer-capture + scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function baseInitialData(
  overrides: Partial<DataModelElementFormData> = {}
): DataModelElementFormData {
  return {
    name: "Order Total",
    inputAttribute: "orderTotal",
    outputAttribute: "orderTotal",
    typeCode: "NUMBER",
    ...overrides,
  };
}

describe("ElementDialog metric role", () => {
  it("submits the selected Revenue role for a numeric element", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ElementDialog
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        initialData={undefined}
      />
    );

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Order Total" } });
    await user.click(screen.getByRole("combobox", { name: /^type/i }));
    await user.click(screen.getByRole("option", { name: /^NUMBER/ }));

    await user.click(screen.getByRole("combobox", { name: "Metric Role" }));
    await user.click(screen.getByRole("option", { name: "Revenue" }));

    fireEvent.click(screen.getByRole("button", { name: /add element/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ metricRole: "REVENUE" }));
  });

  it("renders an initial metricRole as selected", () => {
    render(
      <ElementDialog
        open
        onOpenChange={vi.fn()}
        mode="edit"
        onSubmit={vi.fn()}
        initialData={baseInitialData({ metricRole: "COST" })}
      />
    );

    expect(screen.getByRole("combobox", { name: "Metric Role" })).toHaveTextContent("Cost");
  });

  it("drops metricRole on submit when the type is switched away from numeric", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ElementDialog
        open
        onOpenChange={vi.fn()}
        mode="edit"
        onSubmit={onSubmit}
        initialData={baseInitialData({ metricRole: "REVENUE" })}
      />
    );

    // Switch the type away from numeric — the disabled Metric Role selector
    // still holds "REVENUE" in form state; submit must not forward it.
    await user.click(screen.getByRole("combobox", { name: /^type/i }));
    await user.click(screen.getByRole("option", { name: /^STRING/ }));

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ metricRole: undefined }));
  });

  it("clears a previously-set role when the user picks None", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ElementDialog
        open
        onOpenChange={vi.fn()}
        mode="edit"
        onSubmit={onSubmit}
        initialData={baseInitialData({ metricRole: "REVENUE" })}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Metric Role" }));
    await user.click(screen.getByRole("option", { name: "None" }));

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // Must forward undefined, not the "NONE" sentinel used internally for the Select value.
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ metricRole: undefined }));
  });

  it("disables the Metric Role selector for non-numeric types", () => {
    render(
      <ElementDialog
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={vi.fn()}
        initialData={baseInitialData({ typeCode: "STRING" })}
      />
    );

    expect(screen.getByRole("combobox", { name: "Metric Role" })).toBeDisabled();
  });
});
