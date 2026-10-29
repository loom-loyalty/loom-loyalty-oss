import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../../test/query-client-wrapper";
import { MetadataTypeRelationships as Relationships } from "./metadata-type-relationships.js";

function MetadataTypeRelationships(props: React.ComponentProps<typeof Relationships>) {
  const { Wrapper } = createQueryWrapper();
  return (
    <Wrapper>
      <Relationships {...props} />
    </Wrapper>
  );
}

// A native select stands in for the API-backed combobox; it honours excludeCodes.
// Link lists come from the parents/children queries; serve them from LINKS.
const LINKS: Record<string, { parents: unknown[]; children: unknown[] }> = {};
vi.mock("../../../forms/metadata-type-field/index.js", () => ({
  metadataTypeParentsQueryOptions: (code: string) => ({
    queryKey: ["parents", code],
    queryFn: async () => LINKS[code]?.parents ?? [],
  }),
  metadataTypeChildrenQueryOptions: (code: string) => ({
    queryKey: ["children", code],
    queryFn: async () => LINKS[code]?.children ?? [],
  }),
  MetadataTypeField: ({
    id,
    onValueChange,
    excludeCodes = [],
    disabled,
  }: {
    id: string;
    onValueChange: (v: string) => void;
    excludeCodes?: readonly string[];
    disabled?: boolean;
  }) => (
    <select id={id} value="" disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">none</option>
      {["company", "region", "store", "brand"]
        .filter((c) => !excludeCodes.includes(c))
        .map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
    </select>
  ),
}));

const REGION = {
  metadataTypeId: "mtyp_region",
  code: "region",
  name: "Region",
  category: "METADATA" as const,
  parents: [
    {
      metadataTypeId: "mtyp_company",
      code: "company",
      name: "Company",
      category: "METADATA" as const,
    },
  ],
  children: [
    { metadataTypeId: "mtyp_store", code: "store", name: "Store", category: "METADATA" as const },
  ],
};

LINKS.region = { parents: REGION.parents, children: REGION.children };

function actions() {
  return {
    onAddParent: vi.fn().mockResolvedValue(undefined),
    onRemoveParent: vi.fn().mockResolvedValue(undefined),
    onAddChild: vi.fn().mockResolvedValue(undefined),
    onRemoveChild: vi.fn().mockResolvedValue(undefined),
  };
}

describe("MetadataTypeRelationships", () => {
  it("is read-only without actions", async () => {
    render(<MetadataTypeRelationships metadataType={REGION} />);
    expect(await screen.findByText("Company")).toBeInTheDocument();
    expect(screen.getByText("Store")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unlink/ })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows None for an empty list", async () => {
    LINKS.empty = { parents: [], children: [] };
    render(<MetadataTypeRelationships metadataType={{ ...REGION, code: "empty" }} />);
    expect(await screen.findAllByText("None")).toHaveLength(2);
  });

  it("offers only types that are not the type itself or already linked either way", async () => {
    render(<MetadataTypeRelationships metadataType={REGION} actions={actions()} />);
    const offered = (label: string) =>
      Array.from((screen.getByLabelText(label) as HTMLSelectElement).options)
        .map((o) => o.value)
        .filter(Boolean);
    await screen.findByLabelText("Add a child type");
    // Company is a parent and Store a child: offering either on the other side
    // would create a cycle.
    expect(offered("Add a child type")).toEqual(["brand"]);
    expect(offered("Add a parent type")).toEqual(["brand"]);
  });

  it("links and unlinks parent and child types", async () => {
    const user = userEvent.setup();
    const handlers = actions();
    render(<MetadataTypeRelationships metadataType={REGION} actions={handlers} />);

    await user.selectOptions(await screen.findByLabelText("Add a child type"), "brand");
    expect(handlers.onAddChild).toHaveBeenCalledWith("brand");

    await user.selectOptions(screen.getByLabelText("Add a parent type"), "brand");
    expect(handlers.onAddParent).toHaveBeenCalledWith("brand");

    await user.click(screen.getByRole("button", { name: "Unlink Store" }));
    expect(handlers.onRemoveChild).toHaveBeenCalledWith(REGION.children[0]);

    await user.click(screen.getByRole("button", { name: "Unlink Company" }));
    expect(handlers.onRemoveParent).toHaveBeenCalledWith(REGION.parents[0]);
  });

  it("shows the API's error inline", async () => {
    const user = userEvent.setup();
    const handlers = actions();
    handlers.onAddChild.mockRejectedValue(new Error("Invalid child metadata type"));
    render(<MetadataTypeRelationships metadataType={REGION} actions={handlers} />);

    await user.selectOptions(await screen.findByLabelText("Add a child type"), "brand");
    const alert = await screen.findByRole("alert");
    await waitFor(() =>
      expect(within(alert).getByText("Invalid child metadata type")).toBeVisible()
    );
  });
});
