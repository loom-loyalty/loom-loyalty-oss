import { setApiBaseUrl, type DataModelType } from "@loom-loyalty/sdk";
import { paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useDataModelField } from "./use-data-model-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function type(code: string, overrides: Partial<Omit<DataModelType, "code">> = {}): DataModelType {
  return { code, name: code, dataModelTypeId: `dmt_${code}`, ...overrides };
}

const TYPES: DataModelType[] = [
  type("EVENT", { name: "Event", system: true }),
  type("CUSTOMEVENT", { name: "CustomEvent", system: true, parentTypeReference: "EVENT" }),
  type("COFFEELOYALTY_PURCHASE", {
    name: "Purchase Event Schema",
    description: { en: "A coffee purchase" },
    parentTypeReference: "CUSTOMEVENT",
  }),
  type("STRING", { name: "String", primitive: true }),
  type("CUSTOMER", { name: "Customer", system: true }),
];

function serveTypes(items: DataModelType[] = TYPES) {
  server.use(paginatedListHandler({ url: `${API_BASE}/data-model-types`, items }));
}

describe("useDataModelField", () => {
  it("returns every member of the family, including nested custom types", async () => {
    serveTypes();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDataModelField("EVENT"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoadingDataModelOptions).toBe(false));

    expect(result.current.dataModelOptions.map((o) => o.code)).toEqual([
      "EVENT",
      "CUSTOMEVENT",
      "COFFEELOYALTY_PURCHASE",
    ]);
  });

  it("shapes options for MetadataSelectBox, carrying the English description", async () => {
    serveTypes();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDataModelField("EVENT"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.dataModelOptions.length).toBe(3));

    expect(result.current.dataModelOptions).toContainEqual({
      code: "COFFEELOYALTY_PURCHASE",
      name: "Purchase Event Schema",
      description: "A coffee purchase",
    });
  });

  it("debounces search and filters on name and code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveTypes();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDataModelField("EVENT"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.dataModelOptions.length).toBe(3));

    act(() => result.current.setSearchValue("purchase"));
    expect(result.current.dataModelOptions).toHaveLength(3);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => expect(result.current.dataModelOptions).toHaveLength(1));
    expect(result.current.dataModelOptions[0]?.code).toBe("COFFEELOYALTY_PURCHASE");
    // The unfiltered set stays available for selection lookup.
    expect(result.current.dataModelOptionsAll).toHaveLength(3);
    vi.useRealTimers();
  });

  it("warns when an ancestor is missing, so a dropped descendant is diagnosable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // CUSTOMEVENT is absent, so COFFEELOYALTY_PURCHASE's chain can't reach EVENT.
    serveTypes([TYPES[0]!, TYPES[2]!]);

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDataModelField("EVENT"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.dataModelOptions).toHaveLength(1));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unresolved parentTypeReference"), [
      "CUSTOMEVENT",
    ]);
    warn.mockRestore();
  });

  it("reads every page, so a family member past the first 100 types is still offered", async () => {
    const filler = Array.from({ length: 150 }, (_, i) => type(`FILLER_${String(i)}`));
    serveTypes([...filler, ...TYPES]);
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDataModelField("EVENT"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoadingDataModelOptions).toBe(false));

    expect(result.current.dataModelOptions.map((o) => o.code)).toEqual([
      "EVENT",
      "CUSTOMEVENT",
      "COFFEELOYALTY_PURCHASE",
    ]);
  });

  it("treats a null `content` as an empty page, not an error", async () => {
    server.use(
      http.get(`${API_BASE}/data-model-types`, () =>
        HttpResponse.json({
          content: null,
          totalSize: 0,
          totalPages: 0,
          pageNumber: 0,
          pageSize: 100,
        })
      )
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDataModelField("EVENT"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoadingDataModelOptions).toBe(false));

    expect(result.current.dataModelOptions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("regression: surfaces a malformed (non-array) `content` as an error instead of crashing on types.map", async () => {
    // A truthy but non-array `content` (a real contract-violation shape seen
    // from the platform API) must not reach `filterTypesInFamily`'s
    // `types.map`, which throws "types.map is not a function" uncaught.
    server.use(
      http.get(`${API_BASE}/data-model-types`, () =>
        HttpResponse.json({
          content: { unexpected: "shape" },
          totalSize: 1,
          totalPages: 1,
          pageNumber: 0,
          pageSize: 100,
        })
      )
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDataModelField("EVENT"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoadingDataModelOptions).toBe(false));

    expect(result.current.dataModelOptions).toEqual([]);
    expect(result.current.error?.message).toBe(
      "List response contract violation: expected paged data.content to be an array."
    );
  });
});
