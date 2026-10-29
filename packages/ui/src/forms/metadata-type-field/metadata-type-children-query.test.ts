import { beforeEach, describe, expect, it, vi } from "vitest";

const listChildren = vi.fn();
const listParents = vi.fn();

vi.mock("@loom-loyalty/sdk", () => ({
  PLATFORM_MAX_PAGE_SIZE: 100,
  getMetadataManagementListMetadataTypeChildrenByCodeQueryKey: (code: string, params: unknown) => [
    "children",
    code,
    params,
  ],
  getMetadataManagementListMetadataTypeParentsByCodeQueryKey: (code: string, params: unknown) => [
    "parents",
    code,
    params,
  ],
  metadataManagementListMetadataTypeChildrenByCode: (code: string, params: unknown) =>
    listChildren(code, params),
  metadataManagementListMetadataTypeParentsByCode: (code: string, params: unknown) =>
    listParents(code, params),
}));

import {
  metadataTypeChildrenQueryKey,
  metadataTypeChildrenQueryOptions,
  metadataTypeParentsQueryOptions,
} from "./metadata-type-children-query";

function typePage(page: number, totalPages: number) {
  return Promise.resolve({
    status: 200,
    data: {
      content: [{ code: `TYPE_${page}` }, { code: "" }],
      pageNumber: page,
      totalPages,
    },
  });
}

describe("metadata type children/parents queries", () => {
  beforeEach(() => {
    listChildren.mockReset();
    listParents.mockReset();
  });

  it("keeps the cache key callers invalidate", () => {
    expect(metadataTypeChildrenQueryKey("STORE")).toEqual([
      "children",
      "STORE",
      { page: 0, size: 100 },
    ]);
  });

  it("reads every page of children at size 100", async () => {
    listChildren.mockImplementation((_code: string, { page }: { page: number }) =>
      typePage(page, 3)
    );
    const types = await metadataTypeChildrenQueryOptions("STORE").queryFn();
    expect(types.map((t) => t.code)).toEqual(["TYPE_0", "TYPE_1", "TYPE_2"]);
    expect(listChildren).toHaveBeenCalledTimes(3);
    expect(listChildren).toHaveBeenLastCalledWith("STORE", { page: 2, size: 100 });
  });

  it("fails the read when a later page fails", async () => {
    listParents.mockImplementation((_code: string, { page }: { page: number }) =>
      page === 0 ? typePage(0, 2) : Promise.reject(new Error("page 2 failed"))
    );
    await expect(metadataTypeParentsQueryOptions("AISLE").queryFn()).rejects.toThrow(
      "page 2 failed"
    );
  });

  it("stops on a server that repeats a page", async () => {
    listChildren.mockImplementation(() => typePage(0, 5));
    const types = await metadataTypeChildrenQueryOptions("STORE").queryFn();
    // Page 1 answers as page 0 again, so the walk ends instead of looping.
    expect(listChildren).toHaveBeenCalledTimes(2);
    expect(types.map((t) => t.code)).toEqual(["TYPE_0", "TYPE_0"]);
  });
});
