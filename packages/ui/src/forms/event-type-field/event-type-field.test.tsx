import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useEventTypeField } from "./use-event-type-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface ConfigLike {
  configurationId: string;
  eventTypeCode: string;
  name: string;
}

// Includes intentional dupes: PURCHASE appears 3x with different config ids,
// SIGNUP twice, etc. After dedup we should see ~unique eventTypeCodes only.
const CONFIGS: ConfigLike[] = [
  ...Array.from({ length: 50 }, (_, i) => ({
    configurationId: `cfg-${i}`,
    eventTypeCode: `EVENT_${i % 5}`,
    name: `Config ${i}`,
  })),
];

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useEventTypeField paginated wrapper", () => {
  beforeEach(() => {
    server.use(
      paginatedListHandler({ url: `${API_BASE}/event-type-configurations`, items: CONFIGS })
    );
  });

  it("dedupes by eventTypeCode", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.eventTypeConfigurations).toHaveLength(50));
    expect(result.current.options).toHaveLength(5);
    expect(new Set(result.current.options.map((o) => o.id)).size).toBe(5);
  });

  it("paginates", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/event-type-configurations`,
        items: Array.from({ length: 137 }, (_, i) => ({
          configurationId: `cfg-${i}`,
          eventTypeCode: `EVENT_${i}`,
          name: `Config ${i}`,
        })),
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.eventTypeConfigurations).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.eventTypeConfigurations).toHaveLength(100));
  });

  it("emits eventTypeCode as the option id", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.options).toHaveLength(5));
    expect(result.current.options[0]?.id).toBe("EVENT_0");
  });

  it("falls back to nested eventType.code when top-level eventTypeCode is missing", async () => {
    // Server returns the event-type code on the nested `eventType.code`
    // even though the SDK type declares a top-level `eventTypeCode`.
    // Without this fallback the dropdown is silently empty against the
    // real BE — pre-fix regression that broke the trigger panel.
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/event-type-configurations`,
        items: [
          { configurationId: "cfg-A", name: "Config A", eventType: { code: "PURCHASE" } },
          { configurationId: "cfg-B", name: "Config B", eventType: { code: "REFUND" } },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.options.map((o) => o.id).sort()).toEqual(["PURCHASE", "REFUND"]);
  });

  it("prefers top-level eventTypeCode when both top-level and nested are present", async () => {
    // Defensive: if the BE later adds the top-level field alongside the
    // nested one, it should win (closer to the SDK type contract).
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/event-type-configurations`,
        items: [
          {
            configurationId: "cfg-A",
            name: "Config A",
            eventTypeCode: "TOP_LEVEL_WINS",
            eventType: { code: "NESTED_LOSES" },
          },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("TOP_LEVEL_WINS");
  });

  it("debounces search and filters by name+eventTypeCode", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.options).toHaveLength(5));
    act(() => result.current.setSearchValue("EVENT_3"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("EVENT_3");
    vi.useRealTimers();
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/event-type-configurations`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("auto-skips through pages that yield zero new unique types after a manual fetchNextPage", async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => ({
      configurationId: `cfg-p1-${i}`,
      eventTypeCode: `EVENT_${i % 3}`,
      name: `Config ${i}`,
    }));
    const page2 = Array.from({ length: 25 }, (_, i) => ({
      configurationId: `cfg-p2-${i}`,
      eventTypeCode: `EVENT_${i % 3}`,
      name: `Config p2-${i}`,
    }));
    const page3 = Array.from({ length: 25 }, (_, i) => ({
      configurationId: `cfg-p3-${i}`,
      eventTypeCode: `EVENT_NEW_${i % 2}`,
      name: `Config p3-${i}`,
    }));

    server.use(
      http.get(`${API_BASE}/event-type-configurations`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? "0");
        const pages = [page1, page2, page3];
        const content = pages[page] ?? [];
        return HttpResponse.json({
          content,
          totalSize: 75,
          totalPages: 3,
          pageNumber: page,
          pageSize: 25,
        });
      })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField({ pageSize: 25 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.options).toHaveLength(3));

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.options).toHaveLength(5), { timeout: 3000 });
    expect(result.current.hasNextPage).toBe(false);
  });

  it("stops auto-skipping when hasNextPage flips false", async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => ({
      configurationId: `cfg-p1-${i}`,
      eventTypeCode: `EVENT_${i % 3}`,
      name: `Config ${i}`,
    }));
    const page2 = Array.from({ length: 25 }, (_, i) => ({
      configurationId: `cfg-p2-${i}`,
      eventTypeCode: `EVENT_${i % 3}`,
      name: `Config p2-${i}`,
    }));

    server.use(
      http.get(`${API_BASE}/event-type-configurations`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? "0");
        const pages = [page1, page2];
        const content = pages[page] ?? [];
        return HttpResponse.json({
          content,
          totalSize: 50,
          totalPages: 2,
          pageNumber: page,
          pageSize: 25,
        });
      })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventTypeField({ pageSize: 25 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.options).toHaveLength(3));
    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.hasNextPage).toBe(false), { timeout: 3000 });
    expect(result.current.options).toHaveLength(3);
    expect(result.current.eventTypeConfigurations).toHaveLength(50);
  });
});
