import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../../test/query-client-wrapper";
import { formatHierarchyLevels, validateHierarchyLevels } from "./format-hierarchy-levels.js";
import { MetadataHierarchyFormSheet } from "./metadata-hierarchy-form-sheet.js";

const ALL = ["company", "region", "store", "kiosk"];
const CHILDREN: Record<string, string[]> = {
  company: ["region"],
  region: ["store"],
  store: [],
  kiosk: [],
};

// The real field is a searchable combobox backed by the API; a native select
// that honours the same props keeps these tests about the sheet's behaviour.
vi.mock("../../../forms/metadata-type-field/index.js", () => ({
  metadataTypeChildrenQueryKey: (code: string) => ["children", code],
  metadataTypeChildrenQueryOptions: (code: string) => ({
    queryKey: ["children", code],
    queryFn: async () => (CHILDREN[code] ?? []).map((c) => ({ code: c, name: c })),
  }),
  MetadataTypeField: ({
    id,
    value,
    onValueChange,
    childOf,
    excludeCodes = [],
    renderCreateSheet,
    disabled,
  }: {
    id: string;
    value: string;
    onValueChange: (v: string) => void;
    childOf?: string;
    excludeCodes?: readonly string[];
    renderCreateSheet?: (open: boolean, set: (o: boolean) => void) => ReactNode;
    disabled?: boolean;
  }) => {
    const codes = (childOf ? (CHILDREN[childOf] ?? []) : ALL).filter(
      (c) => !excludeCodes.includes(c)
    );
    return (
      <>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange(e.target.value)}
        >
          <option value="">none</option>
          {codes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {renderCreateSheet?.(true, () => {})}
      </>
    );
  },
}));

vi.mock("../metadata-types/metadata-type-form-sheet.js", () => ({
  MetadataTypeFormSheet: ({
    onSubmit,
  }: {
    onSubmit: (d: { code: string; name: string; category: string }) => Promise<void>;
  }) => (
    <button
      type="button"
      onClick={() => void onSubmit({ code: "aisle", name: "Aisle", category: "METADATA" })}
    >
      Create type aisle
    </button>
  ),
}));

function renderSheet(
  overrides: Partial<React.ComponentProps<typeof MetadataHierarchyFormSheet>> = {}
) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const { Wrapper } = createQueryWrapper();
  render(
    <Wrapper>
      <MetadataHierarchyFormSheet
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        {...overrides}
      />
    </Wrapper>
  );
  return { onSubmit };
}

function level(n: number): HTMLSelectElement {
  return screen.getByLabelText(`Level ${n}`) as HTMLSelectElement;
}

function optionValues(n: number): string[] {
  return Array.from(level(n).options)
    .map((o) => o.value)
    .filter(Boolean);
}

describe("MetadataHierarchyFormSheet", () => {
  it("offers every type at the top and only child types below, never repeating a level", async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(optionValues(1)).toEqual(ALL);
    await user.selectOptions(level(1), "company");
    await user.click(screen.getByRole("button", { name: "Add level" }));
    expect(optionValues(2)).toEqual(["region"]);
    await user.selectOptions(level(2), "region");
    await user.click(screen.getByRole("button", { name: "Add level" }));
    expect(optionValues(3)).toEqual(["store"]);
  });

  it("submits the ordered levels with name and code", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();

    await user.type(screen.getByLabelText(/^Name/), "Store hierarchy");
    await user.selectOptions(level(1), "company");
    await user.click(screen.getByRole("button", { name: "Add level" }));
    await user.selectOptions(level(2), "region");
    await user.click(screen.getByRole("button", { name: "Create Metadata Hierarchy" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        code: "store-hierarchy",
        name: "Store hierarchy",
        levels: ["company", "region"],
      })
    );
  });

  it("blocks submit and explains an unselected level", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();

    await user.type(screen.getByLabelText(/^Name/), "Partial");
    await user.selectOptions(level(1), "company");
    await user.click(screen.getByRole("button", { name: "Add level" }));
    await user.click(screen.getByRole("button", { name: "Create Metadata Hierarchy" }));

    expect(await screen.findByText("Choose a metadata type for level 2.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("flags a saved level that is no longer linked under the one above", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet({
      mode: "edit",
      initialData: { code: "h", name: "H", levels: ["company", "store"] },
    });
    await user.click(await screen.findByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Level 2 is not a child type of level 1.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("removes only the last level and keeps at least one", async () => {
    const user = userEvent.setup();
    renderSheet({
      mode: "edit",
      initialData: { code: "h", name: "H", levels: ["company", "region"] },
    });

    const remove = screen.getByRole("button", { name: "Remove last level" });
    await user.click(remove);
    expect(screen.queryByLabelText("Level 2")).toBeNull();
    expect(remove).toBeDisabled();
  });

  it("creates a type and links it under the level above", async () => {
    const user = userEvent.setup();
    const onCreateType = vi.fn(async () => {
      CHILDREN.store = [...(CHILDREN.store ?? []), "aisle"];
      return "aisle";
    });
    const { onSubmit } = renderSheet({ onCreateType });

    await user.type(screen.getByLabelText(/^Name/), "Aisles");
    await user.selectOptions(level(1), "store");
    await user.click(screen.getByRole("button", { name: "Add level" }));
    const createButtons = screen.getAllByRole("button", { name: "Create type aisle" });
    await user.click(createButtons[1]!);

    expect(onCreateType).toHaveBeenCalledWith(
      { code: "aisle", name: "Aisle", category: "METADATA" },
      "store"
    );
    await user.click(screen.getByRole("button", { name: "Create Metadata Hierarchy" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ levels: ["store", "aisle"] }))
    );
  });

  it("links a type that is not yet a child type of the level above", async () => {
    const user = userEvent.setup();
    const onLinkChildType = vi.fn().mockResolvedValue(undefined);
    renderSheet({ onLinkChildType });

    await user.selectOptions(level(1), "company");
    await user.click(screen.getByRole("button", { name: "Add level" }));
    await user.click(screen.getByRole("button", { name: "Use a type not linked under company" }));
    expect(optionValues(2)).toEqual(["region", "store", "kiosk"]);
    await user.selectOptions(level(2), "kiosk");

    await waitFor(() => expect(onLinkChildType).toHaveBeenCalledWith("company", "kiosk"));
    // Linked, the picker goes back to the level's child types.
    expect(
      screen.getByRole("button", { name: "Use a type not linked under company" })
    ).toBeVisible();
  });

  it("hides the link toggle when the caller cannot link types", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.selectOptions(level(1), "company");
    await user.click(screen.getByRole("button", { name: "Add level" }));
    expect(screen.queryByRole("button", { name: /not linked under/ })).toBeNull();
  });
});

describe("hierarchy level helpers", () => {
  it("formats levels with names and falls back to codes", () => {
    expect(formatHierarchyLevels(["company", "x"], { company: "Company" })).toBe("Company → x");
  });

  it("flags a level that is not a child of the one above", () => {
    expect(
      validateHierarchyLevels(["company", "store"], (i) => (i === 0 ? ["company"] : ["region"]))
    ).toBe("Level 2 is not a child type of level 1.");
    expect(validateHierarchyLevels(["company", "region"], () => null)).toBeNull();
  });
});
