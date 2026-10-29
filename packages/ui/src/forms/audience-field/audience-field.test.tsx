import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useAudienceField } from "./use-audience-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface AudienceLike {
  customerAudienceId: string | null;
  name: string;
  code: string;
}

const AUDIENCES: AudienceLike[] = Array.from({ length: 137 }, (_, i) => ({
  customerAudienceId: `aud_${i.toString(16).padStart(32, "0")}`,
  name: `Audience ${i}`,
  code: `AUD${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useAudienceField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/customer-audiences`, items: AUDIENCES }));
  });

  it("fetches the first page on mount", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    expect(result.current.hasNextPage).toBe(true);
  });

  it("respects caller pageSize", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField({ pageSize: 25 }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.audiences).toHaveLength(25));
  });

  it("fetchNextPage concatenates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.audiences).toHaveLength(100));
  });

  it("hasNextPage flips to false on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.audiences).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.audiences).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("debounces search and filters by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    act(() => result.current.setSearchValue("AUD017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.name).toBe("Audience 17");
    vi.useRealTimers();
  });

  it("optionsAll preserves the full set across search-term changes (selected-label regression guard)", async () => {
    // The OfferField bug from #331's review: server-side filter on search
    // means selected items disappear from optionsAll when user types. This
    // hook does CLIENT-side filter, so optionsAll should stay stable across
    // search changes — the trigger label can always resolve.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    const initialAllCount = result.current.optionsAll.length;
    act(() => result.current.setSearchValue("AUD000"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.options).toHaveLength(1);
    expect(result.current.optionsAll).toHaveLength(initialAllCount);
    vi.useRealTimers();
  });

  it("falls back to audience code when customerAudienceId is missing", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/customer-audiences`,
        items: [{ customerAudienceId: null, name: "Code-only", code: "X" }],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.audiences).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("X");
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/customer-audiences`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAudienceField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.options).toEqual([]);
  });
});
