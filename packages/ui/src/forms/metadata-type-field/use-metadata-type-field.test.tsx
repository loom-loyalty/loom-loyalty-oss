import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useMetadataTypeField } from "./use-metadata-type-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface TypeLike {
  code: string;
  name: string;
}

const TYPES: TypeLike[] = Array.from({ length: 137 }, (_, i) => ({
  code: `MT_${String(i).padStart(3, "0")}`,
  name: `Metadata Type ${i}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useMetadataTypeField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/metadata-types`, items: TYPES }));
  });

  it("fetches the first page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(50));
  });

  it("paginates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(100));
  });

  it("uses code as the option id", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.options.length).toBeGreaterThan(0));
    expect(result.current.options[0]?.id).toBe("MT_000");
    expect(result.current.options[0]?.secondaryText).toBe("MT_000");
  });

  it("debounces search and filters by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(50));
    act(() => result.current.setSearchValue("MT_017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("MT_017");
    vi.useRealTimers();
  });

  it("hasNextPage flips on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/metadata-types`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("offers only types of the requested category", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/metadata-types`,
        items: [
          { code: "STORE", name: "Store", category: "LOCATION" },
          { code: "PROGRAM_TYPE", name: "Program Type", category: "METADATA" },
          { code: "WAREHOUSE", name: "Warehouse", category: "LOCATION" },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField({ category: "LOCATION" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.metadataTypes).toHaveLength(3));
    expect(result.current.options.map((o) => o.id)).toEqual(["STORE", "WAREHOUSE"]);
    expect(result.current.optionsAll.map((o) => o.id)).toEqual(["STORE", "WAREHOUSE"]);
  });

  it("sends the category and search term to the server", async () => {
    const seen: Array<{ category: string | null; search: string | null }> = [];
    const many = Array.from({ length: 120 }, (_, i) => ({
      code: `META_${i}`,
      name: `Meta ${i}`,
      category: "METADATA",
    }));
    const locations = [
      { code: "STORE", name: "Store", category: "LOCATION" },
      { code: "WAREHOUSE", name: "Warehouse", category: "LOCATION" },
    ];
    server.use(
      http.get(`${API_BASE}/metadata-types`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push({ category: params.get("category"), search: params.get("search") });
        return undefined;
      }),
      paginatedListHandler({
        url: `${API_BASE}/metadata-types`,
        items: [...many, ...locations],
        filter: (type, params) => {
          const category = params.get("category");
          const search = params.get("search")?.toLowerCase();
          if (category && type.category !== category) return false;
          return !search || type.name.toLowerCase().includes(search);
        },
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField({ category: "LOCATION" }), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(result.current.options.map((o) => o.id)).toEqual(["STORE", "WAREHOUSE"])
    );
    expect(seen[0]).toEqual({ category: "LOCATION", search: null });

    act(() => result.current.setSearchValue("ware"));
    await waitFor(() => expect(result.current.options.map((o) => o.id)).toEqual(["WAREHOUSE"]));
    expect(seen).toContainEqual({ category: "LOCATION", search: "ware" });
  });
});

describe("useMetadataTypeField childOf / excludeCodes", () => {
  it("offers only the children of `childOf`, without paging the type list", async () => {
    let listCalls = 0;
    server.use(
      http.get(`${API_BASE}/metadata-types`, () => {
        listCalls += 1;
        return HttpResponse.json({ success: true, data: { content: TYPES, totalSize: 137 } });
      }),
      http.get(`${API_BASE}/metadata-types/by-code/REGION/children`, () =>
        HttpResponse.json({
          success: true,
          data: {
            content: [
              { code: "STORE", name: "Store" },
              { code: "KIOSK", name: "Kiosk" },
            ],
          },
        })
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataTypeField({ childOf: "REGION" }), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(result.current.options.map((o) => o.id)).toEqual(["STORE", "KIOSK"])
    );
    expect(result.current.hasNextPage).toBe(false);
    expect(listCalls).toBe(0);
  });

  it("leaves out excluded codes", async () => {
    server.use(paginatedListHandler({ url: `${API_BASE}/metadata-types`, items: TYPES }));
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useMetadataTypeField({ excludeCodes: ["MT_000", "MT_001"] }),
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(result.current.options.length).toBe(48));
    expect(result.current.options[0]?.id).toBe("MT_002");
  });
});
