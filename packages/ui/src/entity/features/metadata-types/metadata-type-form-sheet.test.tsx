import type { DataModelType, MetadataType } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetadataTypeFormSheet } from "./metadata-type-form-sheet.js";

let dataModelTypes: Partial<DataModelType>[] = [];

vi.mock("../../../forms/data-model-field/use-all-data-model-types.js", () => ({
  useAllDataModelTypes: () => ({
    items: dataModelTypes,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const ONBOARDING_QUEST = {
  code: "onboarding-quest",
  name: "Onboarding Quest",
  parentTypeReference: "metadata",
  system: false,
};

function editData(overrides: Partial<MetadataType>): MetadataType {
  return {
    metadataTypeId: "mtyp_00000000000000000000000000000001",
    code: "onboarding-quest",
    name: "Onboarding Quest",
    category: "METADATA",
    searchable: false,
    ...overrides,
  } as MetadataType;
}

function pickDataModel(optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: /data model/i }));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: optionName }));
}

describe("MetadataTypeFormSheet", () => {
  beforeEach(() => {
    dataModelTypes = [
      ONBOARDING_QUEST,
      // Neither is a choice: one is built on another model, one is a system model.
      { code: "receipt", name: "Receipt", parentTypeReference: "custom-event", system: false },
      { code: "country", name: "Country", parentTypeReference: "metadata", system: true },
    ];
  });

  it("clears form state on reopen when the parent closed it after a submit", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const sheet = (open: boolean) => (
      <MetadataTypeFormSheet open={open} onOpenChange={vi.fn()} mode="create" onSubmit={onSubmit} />
    );
    const { rerender } = render(sheet(true));
    const nameInput = () =>
      screen.getByLabelText(/^Name/i, { selector: "input" }) as HTMLInputElement;
    const codeInput = () =>
      screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;

    fireEvent.change(nameInput(), { target: { value: "QA Region" } });
    expect(codeInput().value).toBe("qa-region");

    // The page closes the sheet itself on success, never calling onOpenChange.
    rerender(sheet(false));
    rerender(sheet(true));

    expect(nameInput().value).toBe("");
    expect(codeInput().value).toBe("");
  });

  it("offers only custom models built on metadata, and sends the one picked", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MetadataTypeFormSheet open onOpenChange={vi.fn()} mode="create" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Onboarding Quest" },
    });

    fireEvent.click(screen.getByRole("combobox", { name: /data model/i }));
    const options = within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Shared metadata model", "Onboarding Quest"]);
    fireEvent.click(screen.getByRole("option", { name: "Onboarding Quest" }));

    fireEvent.click(screen.getByRole("button", { name: "Create Metadata Type" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ dataModelCode: "onboarding-quest" });
  });

  it("leaves the field out of a create that keeps the shared model", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MetadataTypeFormSheet open onOpenChange={vi.fn()} mode="create" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Region" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Metadata Type" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty("dataModelCode");
  });

  it("sends an empty code to unlink a type in edit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MetadataTypeFormSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        initialData={editData({ dataModelCode: "onboarding-quest" })}
        onSubmit={onSubmit}
      />
    );

    pickDataModel("Shared metadata model");
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ dataModelCode: "" });
  });

  it("locks a system type's link and leaves it out of the update", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MetadataTypeFormSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        initialData={editData({ code: "COUNTRY", name: "Country", dataModelCode: "country" })}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole("combobox", { name: /data model/i })).toBeDisabled();
    expect(screen.getByText("The platform sets this type's data model.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty("dataModelCode");
  });

  it("keeps a custom link editable when its model isn't in the loaded list", () => {
    render(
      <MetadataTypeFormSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        initialData={editData({ dataModelCode: "quest-archive" })}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox", { name: /data model/i })).toBeEnabled();
  });

  it("hides the data model for categories that can't link one", () => {
    render(
      <MetadataTypeFormSheet
        open
        onOpenChange={vi.fn()}
        mode="edit"
        initialData={editData({ code: "STORE", name: "Store", category: "LOCATION" })}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByRole("combobox", { name: /data model/i })).not.toBeInTheDocument();
  });
});
