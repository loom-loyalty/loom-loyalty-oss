import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../../test/query-client-wrapper";
import { MetadataRelationships as Relationships } from "./metadata-relationships.js";

// STORE sits below REGION and BRAND, and AISLE sits below STORE.
const TYPE_LINKS: Record<string, { parents: object[]; children: object[] }> = {
  STORE: {
    parents: [
      { code: "REGION", name: "Region" },
      { code: "BRAND", name: "Brand" },
    ],
    children: [{ code: "AISLE", name: "Aisle" }],
  },
  LONELY: { parents: [], children: [] },
};
const ENTRY_LINKS: Record<string, { parents: object[]; children: object[] }> = {
  meta_store: {
    parents: [{ metadataId: "meta_west", code: "WEST", name: "West", typeCode: "REGION" }],
    children: [{ metadataId: "meta_a1", code: "A1", name: "Aisle 1", typeCode: "AISLE" }],
  },
  // 101 children: the last one sits on a second page of 100.
  meta_big: {
    parents: [],
    children: Array.from({ length: 101 }, (_, i) => ({
      metadataId: `meta_aisle_${i}`,
      code: `A${i}`,
      name: `Aisle ${i}`,
      typeCode: "AISLE",
    })),
  },
};

function pageOfLinks(rows: object[] | undefined, params?: { page?: number; size?: number }) {
  const all = rows ?? [];
  const page = params?.page ?? 0;
  const size = params?.size ?? 100;
  return {
    status: 200,
    data: {
      content: all.slice(page * size, (page + 1) * size),
      pageNumber: page,
      totalPages: Math.max(1, Math.ceil(all.length / size)),
      totalSize: all.length,
    },
  };
}

const failChildren = vi.hoisted(() => ({ on: false }));

vi.mock("../../../forms/metadata-type-field/index.js", () => ({
  metadataTypeParentsQueryOptions: (code: string) => ({
    queryKey: ["tparents", code],
    queryFn: async () => TYPE_LINKS[code]?.parents ?? [],
  }),
  metadataTypeChildrenQueryOptions: (code: string) => ({
    queryKey: ["tchildren", code],
    queryFn: async () => TYPE_LINKS[code]?.children ?? [],
  }),
}));

vi.mock("@loom-loyalty/sdk", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@loom-loyalty/sdk")),
  PLATFORM_MAX_PAGE_SIZE: 100,
  getMetadataManagementListMetadataParentsQueryKey: (id: string) => ["eparents", id],
  getMetadataManagementListMetadataChildrenQueryKey: (id: string) => ["echildren", id],
  metadataManagementListMetadataParents: async (id: string, params?: { page?: number }) =>
    pageOfLinks(ENTRY_LINKS[id]?.parents, params),
  metadataManagementListMetadataChildren: async (id: string, params?: { page?: number }) => {
    if (failChildren.on && (params?.page ?? 0) > 0) throw new Error("page 2 failed");
    return pageOfLinks(ENTRY_LINKS[id]?.children, params);
  },
}));

// A native select stands in for the API-backed entry picker.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    typeCode,
    value,
    onValueChange,
  }: {
    id: string;
    typeCode: string;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <select id={id} value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">none</option>
      {["WEST", "EAST", "ACME", "A1", "A2"].map((c) => (
        <option key={c} value={c}>
          {typeCode}:{c}
        </option>
      ))}
    </select>
  ),
}));

function MetadataRelationships(props: React.ComponentProps<typeof Relationships>) {
  const { Wrapper } = createQueryWrapper();
  return (
    <Wrapper>
      <Relationships {...props} />
    </Wrapper>
  );
}

const STORE = { metadataId: "meta_store", code: "S1", name: "Store 1", typeCode: "STORE" };

function actions() {
  return {
    onSetParent: vi.fn().mockResolvedValue(undefined),
    onRemoveParent: vi.fn().mockResolvedValue(undefined),
    onAddChild: vi.fn().mockResolvedValue(undefined),
    onRemoveChild: vi.fn().mockResolvedValue(undefined),
  };
}

describe("MetadataRelationships", () => {
  it("shows one parent slot per parent type and children per child type", async () => {
    render(<MetadataRelationships metadata={STORE} />);
    expect(await screen.findByText("West")).toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
    // No Brand parent yet.
    expect(screen.getByText("Brand").nextElementSibling?.textContent).toBe("None");
    expect(screen.getByText("Aisle 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("explains when the type has no parent or child types", async () => {
    render(<MetadataRelationships metadata={{ ...STORE, metadataId: "x", typeCode: "LONELY" }} />);
    expect(await screen.findByText(/no parent or child types/)).toBeInTheDocument();
  });

  it("sets, changes and removes a parent", async () => {
    const user = userEvent.setup();
    const handlers = actions();
    render(<MetadataRelationships metadata={STORE} actions={handlers} />);

    const region = await screen.findByLabelText("Region");
    expect((region as HTMLSelectElement).value).toBe("WEST");
    await user.selectOptions(region, "EAST");
    expect(handlers.onSetParent).toHaveBeenCalledWith("REGION", "EAST");

    await user.selectOptions(screen.getByLabelText("Brand"), "ACME");
    expect(handlers.onSetParent).toHaveBeenCalledWith("BRAND", "ACME");

    await user.click(screen.getByRole("button", { name: "Remove from West" }));
    expect(handlers.onRemoveParent).toHaveBeenCalledWith(
      expect.objectContaining({ metadataId: "meta_west" })
    );
  });

  it("adds and removes a child", async () => {
    const user = userEvent.setup();
    const handlers = actions();
    render(<MetadataRelationships metadata={STORE} actions={handlers} />);

    await user.selectOptions(await screen.findByLabelText("Add a Aisle"), "A2");
    expect(handlers.onAddChild).toHaveBeenCalledWith("AISLE", "A2");

    await user.click(screen.getByRole("button", { name: "Remove Aisle 1" }));
    expect(handlers.onRemoveChild).toHaveBeenCalledWith(
      expect.objectContaining({ metadataId: "meta_a1" })
    );
  });

  it("lists children from every page, not just the first 100", async () => {
    failChildren.on = false;
    render(<MetadataRelationships metadata={{ ...STORE, metadataId: "meta_big" }} />);
    expect(await screen.findByText("Aisle 100")).toBeInTheDocument();
    expect(screen.getByText("Aisle 0")).toBeInTheDocument();
    expect(screen.queryByText(/first 100 children/)).toBeNull();
  });

  it("reports an error instead of a partial list when a later page fails", async () => {
    failChildren.on = true;
    try {
      render(<MetadataRelationships metadata={{ ...STORE, metadataId: "meta_big" }} />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't load this entry's relationships."
      );
      expect(screen.queryByText("Aisle 0")).toBeNull();
    } finally {
      failChildren.on = false;
    }
  });

  it("shows a failed link inline", async () => {
    const user = userEvent.setup();
    const handlers = actions();
    handlers.onAddChild.mockRejectedValue(new Error("Invalid child metadata type"));
    render(<MetadataRelationships metadata={STORE} actions={handlers} />);

    await user.selectOptions(await screen.findByLabelText("Add a Aisle"), "A2");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid child metadata type");
  });
});
