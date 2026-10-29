import type { DataModelElement, DataModelType } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DataModelFormSheet } from "./data-model-form-sheet";
import type { DataModelElementOperations } from "./element-changes";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const TYPE: DataModelType = {
  dataModelTypeId: "dmt_1",
  code: "metadata",
  name: "Metadata",
  system: true,
} as DataModelType;

function el(id: string, name: string, attr: string, system: boolean): DataModelElement {
  return {
    dataModelElementId: id,
    name,
    inputAttribute: attr,
    outputAttribute: attr,
    typeReference: "STRING",
    system,
  };
}

const SYSTEM_CODE = el("dme_code", "Code", "code", true);
const SYSTEM_NAME = el("dme_name", "Name", "name", true);
const CUSTOM_COLOR = el("dme_color", "Color", "color", false);

function ops(overrides: Partial<DataModelElementOperations> = {}): DataModelElementOperations {
  let n = 0;
  return {
    createElement: vi.fn(async (data) => ({
      ...data,
      dataModelElementId: `dme_new_${++n}`,
      typeReference: data.typeCode,
    })),
    updateElement: vi.fn(async () => undefined),
    deleteElement: vi.fn(async () => undefined),
    onSaved: vi.fn(),
    ...overrides,
  };
}

function renderSheet(
  elements: DataModelElement[],
  elementOperations: DataModelElementOperations,
  onSubmit = vi.fn()
) {
  render(
    <DataModelFormSheet
      open
      onOpenChange={vi.fn()}
      mode="edit"
      initialData={{ type: TYPE, elements }}
      availableTypes={[TYPE]}
      onSubmit={onSubmit}
      elementOperations={elementOperations}
    />
  );
  return { onSubmit };
}

function addElement(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /^add element$/i }));
  const dialog = screen.getByRole("dialog", { name: /^add element$/i });
  fireEvent.change(within(dialog).getByLabelText(/^name/i), { target: { value: name } });
  fireEvent.click(within(dialog).getByRole("button", { name: /^add element$/i }));
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
}

describe("DataModelFormSheet (edit) — system elements", () => {
  it("lists system elements, marked System, with no edit or delete actions", () => {
    renderSheet([SYSTEM_CODE, SYSTEM_NAME, CUSTOM_COLOR], ops());

    expect(screen.getByText(/\(3\)/)).toBeTruthy();
    expect(screen.getAllByText("System")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Edit Code" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Code" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Name" })).toBeNull();
    // Custom elements stay editable.
    expect(screen.getByRole("button", { name: "Edit Color" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Color" })).toBeTruthy();
  });
});

describe("DataModelFormSheet (edit) — per-element saves", () => {
  it("creates each new element with its own call and never sends elements via the whole-model submit", async () => {
    const operations = ops();
    const { onSubmit } = renderSheet([SYSTEM_CODE, SYSTEM_NAME], operations);

    addElement("Tier Color");
    addElement("Region");
    addElement("Priority");
    save();

    await waitFor(() => expect(operations.onSaved).toHaveBeenCalledTimes(1));
    expect(operations.createElement).toHaveBeenCalledTimes(3);
    expect(operations.createElement).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "Tier Color", inputAttribute: "tierColor" })
    );
    expect(operations.updateElement).not.toHaveBeenCalled();
    expect(operations.deleteElement).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("deletes a removed custom element by id", async () => {
    const operations = ops();
    renderSheet([SYSTEM_CODE, CUSTOM_COLOR], operations);

    fireEvent.click(screen.getByRole("button", { name: "Delete Color" }));
    save();

    await waitFor(() => expect(operations.onSaved).toHaveBeenCalled());
    expect(operations.deleteElement).toHaveBeenCalledExactlyOnceWith("dme_color");
    expect(operations.createElement).not.toHaveBeenCalled();
  });

  it("reports which element failed, keeps earlier saves, and doesn't repeat them on retry", async () => {
    const createElement = vi
      .fn()
      .mockResolvedValueOnce({ ...el("dme_a", "Alpha", "alpha", false) })
      // SDK errors are plain objects, not Error instances.
      .mockRejectedValueOnce({ message: "Attribute already exists", statusCode: 400 })
      .mockResolvedValueOnce({ ...el("dme_b", "Beta", "beta", false) })
      .mockResolvedValueOnce({ ...el("dme_c", "Gamma", "gamma", false) });
    const operations = ops({ createElement });
    renderSheet([SYSTEM_CODE], operations);

    addElement("Alpha");
    addElement("Beta");
    addElement("Gamma");
    save();

    const alert = await screen.findByText(/couldn't add element "Beta"/i);
    expect(alert.textContent).toMatch(/Attribute already exists/);
    expect(alert.textContent).toMatch(/Already saved: "Alpha"/);
    expect(createElement).toHaveBeenCalledTimes(2);
    expect(operations.onSaved).not.toHaveBeenCalled();

    save();
    await waitFor(() => expect(operations.onSaved).toHaveBeenCalledTimes(1));
    // Retry sends only Beta and Gamma; Alpha was already saved.
    expect(createElement).toHaveBeenCalledTimes(4);
    expect(createElement.mock.calls.slice(2).map(([data]) => data.name)).toEqual(["Beta", "Gamma"]);
  });
});
