import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useMetadataField } from "./use-metadata-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface EntityLike {
  code: string;
  name: string;
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockType(code: string, category: "METADATA" | "DATA_TYPE" | "LOCATION" | "ITEM") {
  return http.get(`${API_BASE}/metadata-types/by-code/${code}`, () =>
    HttpResponse.json({ success: true, data: { code, category, name: code } })
  );
}

function items(count: number, prefix: string): EntityLike[] {
  return Array.from({ length: count }, (_, i) => ({
    code: `${prefix}_${String(i).padStart(3, "0")}`,
    name: `${prefix} ${i}`,
  }));
}

describe("[audit] useMetadataField category-aware paginated dispatch", () => {
  beforeEach(() => {
    // dataModelTypes call (eager — fed to create-sheet dropdown)
    server.use(
      paginatedListHandler({ url: `${API_BASE}/data-model-types`, items: [] }),
      mockType("PROGRAM_TYPE", "METADATA"),
      mockType("CURRENCY_TYPE", "DATA_TYPE"),
      mockType("STORE_TYPE", "LOCATION"),
      mockType("PRODUCT_TYPE", "ITEM")
    );
  });

  it("METADATA category routes to /metadata/by-type/{type}", async () => {
    const data = items(137, "META");
    server.use(
      paginatedListHandler({ url: `${API_BASE}/metadata/by-type/PROGRAM_TYPE`, items: data })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("PROGRAM_TYPE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.category).toBe("METADATA"));
    await waitFor(() => expect(result.current.metadataOptions.length).toBeGreaterThan(0));
    expect(result.current.metadataOptions).toHaveLength(100);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("DATA_TYPE category routes to /data-types/by-type/{type}", async () => {
    const data = items(50, "DT");
    server.use(
      paginatedListHandler({ url: `${API_BASE}/data-types/by-type/CURRENCY_TYPE`, items: data })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("CURRENCY_TYPE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.category).toBe("DATA_TYPE"));
    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(50));
  });

  it("filters dataModelTypeOptions by folded code, matching post-migration kebab spellings", async () => {
    // typeCode "COUNTER_TARGET_TYPE" derives the filter "COUNTER_TARGET" (still
    // UPPER_SNAKE — MetadataType codes are unvalidated and unaffected by the
    // migration). DataModelType.code and .parentTypeReference ARE migrating to
    // lowercase-hyphenated resource codes, so an exact === against the
    // UPPER_SNAKE filter stops matching once the platform returns them
    // migrated. This asserts the fold-based comparison still finds both the
    // type itself and its child by parentTypeReference.
    server.use(
      mockType("COUNTER_TARGET_TYPE", "DATA_TYPE"),
      paginatedListHandler({
        url: `${API_BASE}/data-model-types`,
        items: [
          { code: "counter-target", name: "Counter Target" },
          {
            code: "counter-target-detail",
            name: "Counter Target Detail",
            parentTypeReference: "counter-target",
          },
          { code: "customer", name: "Customer" },
        ],
      })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("COUNTER_TARGET_TYPE"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.dataModelTypeOptions.length).toBe(2));
    expect(result.current.dataModelTypeOptions.map((o) => o.code).sort()).toEqual([
      "counter-target",
      "counter-target-detail",
    ]);
  });

  it("LOCATION category routes to /locations/by-type/{type}", async () => {
    const data = items(20, "LOC");
    server.use(
      paginatedListHandler({ url: `${API_BASE}/locations/by-type/STORE_TYPE`, items: data })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("STORE_TYPE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.category).toBe("LOCATION"));
    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(20));
  });

  it("ITEM category routes to /items/by-type/{type}", async () => {
    const data = items(10, "ITM");
    server.use(
      paginatedListHandler({ url: `${API_BASE}/items/by-type/PRODUCT_TYPE`, items: data })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("PRODUCT_TYPE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.category).toBe("ITEM"));
    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(10));
  });

  it("paginates across pages within a single category", async () => {
    const data = items(137, "META");
    server.use(
      paginatedListHandler({ url: `${API_BASE}/metadata/by-type/PROGRAM_TYPE`, items: data })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("PROGRAM_TYPE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("debounces search and filters loaded entities by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const data = items(50, "META");
    server.use(
      paginatedListHandler({ url: `${API_BASE}/metadata/by-type/PROGRAM_TYPE`, items: data })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("PROGRAM_TYPE"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(50));

    act(() => result.current.setSearchValue("META_017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(1));
    expect(result.current.metadataOptions[0]?.code).toBe("META_017");
    vi.useRealTimers();
  });

  it("keeps loading pages while a search matches nothing loaded", async () => {
    const data = items(250, "META");
    server.use(
      paginatedListHandler({ url: `${API_BASE}/metadata/by-type/PROGRAM_TYPE`, items: data })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("PROGRAM_TYPE"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.metadataOptions).toHaveLength(100));

    // META_240 sits on the third page; the by-type endpoint has no search param.
    act(() => result.current.setSearchValue("META_240"));
    await waitFor(() =>
      expect(result.current.metadataOptions.map((o) => o.code)).toEqual(["META_240"])
    );
    expect(result.current.totalLoaded).toBe(250);
  });

  it("surfaces a 404 metadata-type error as isTypeNotFound (not a generic error)", async () => {
    server.use(
      http.get(`${API_BASE}/metadata-types/by-code/UNKNOWN`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "NOT_FOUND", message: "not found" }] },
          { status: 404 }
        )
      )
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMetadataField("UNKNOWN"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isTypeNotFound).toBe(true));
    expect(result.current.metadataOptions).toEqual([]);
  });

  it("clears stale createError on category flip and on flip-back to the failed category", async () => {
    server.use(
      paginatedListHandler({ url: `${API_BASE}/metadata/by-type/PROGRAM_TYPE`, items: [] }),
      paginatedListHandler({ url: `${API_BASE}/locations/by-type/STORE_TYPE`, items: [] }),
      http.post(`${API_BASE}/metadata`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "BOOM", message: "create failed" }] },
          { status: 500 }
        )
      )
    );

    const { Wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(({ typeCode }) => useMetadataField(typeCode), {
      wrapper: Wrapper,
      initialProps: { typeCode: "PROGRAM_TYPE" },
    });

    await waitFor(() => expect(result.current.category).toBe("METADATA"));

    await act(async () => {
      await result.current.createMetadata({ code: "X", name: "X" }).catch(() => {});
    });

    await waitFor(() => expect(result.current.createError).not.toBeNull());

    rerender({ typeCode: "STORE_TYPE" });
    await waitFor(() => expect(result.current.category).toBe("LOCATION"));
    expect(result.current.createError).toBeNull();
    expect(result.current.isCreating).toBe(false);

    rerender({ typeCode: "PROGRAM_TYPE" });
    await waitFor(() => expect(result.current.category).toBe("METADATA"));
    expect(result.current.createError).toBeNull();
  });

  it("clears stale isCreating across category flips even mid-flight", async () => {
    let resolvePost: ((value: unknown) => void) | undefined;
    server.use(
      paginatedListHandler({ url: `${API_BASE}/metadata/by-type/PROGRAM_TYPE`, items: [] }),
      paginatedListHandler({ url: `${API_BASE}/locations/by-type/STORE_TYPE`, items: [] }),
      http.post(
        `${API_BASE}/metadata`,
        () =>
          new Promise((resolve) => {
            resolvePost = (value) =>
              resolve(
                HttpResponse.json(
                  { success: true, data: value as Record<string, unknown> },
                  { status: 200 }
                )
              );
          })
      )
    );

    const { Wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(({ typeCode }) => useMetadataField(typeCode), {
      wrapper: Wrapper,
      initialProps: { typeCode: "PROGRAM_TYPE" },
    });

    await waitFor(() => expect(result.current.category).toBe("METADATA"));

    act(() => {
      void result.current.createMetadata({ code: "X", name: "X" });
    });
    await waitFor(() => expect(result.current.isCreating).toBe(true));

    rerender({ typeCode: "STORE_TYPE" });
    await waitFor(() => expect(result.current.category).toBe("LOCATION"));
    expect(result.current.isCreating).toBe(false);

    await act(async () => {
      resolvePost?.({ code: "X" });
      await Promise.resolve();
    });
  });
});
