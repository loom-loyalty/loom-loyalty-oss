import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useBadgeField } from "./use-badge-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface BadgeLike {
  badgeId: string;
  name: string;
  code: string;
}

const BADGES: BadgeLike[] = Array.from({ length: 137 }, (_, i) => ({
  badgeId: `badge-${i}`,
  name: `Badge ${i}`,
  code: `B${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useBadgeField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/badges`, items: BADGES }));
  });

  it("fetches the first page on mount", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useBadgeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.badges).toHaveLength(50));
    expect(result.current.hasNextPage).toBe(true);
  });

  it("respects caller pageSize", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useBadgeField({ pageSize: 25 }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.badges).toHaveLength(25));
  });

  it("fetchNextPage concatenates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useBadgeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.badges).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.badges).toHaveLength(100));
  });

  it("hasNextPage flips to false on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useBadgeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.badges).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.badges).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.badges).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("debounces search and filters by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useBadgeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.badges).toHaveLength(50));
    act(() => result.current.setSearchValue("B017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("badge-17");
    vi.useRealTimers();
  });

  it("falls back to badge code when badgeId is missing", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/badges`,
        items: [{ badgeId: null as unknown as string, name: "Code-only", code: "X" }],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useBadgeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.badges).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("X");
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/badges`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useBadgeField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.options).toEqual([]);
  });
});
