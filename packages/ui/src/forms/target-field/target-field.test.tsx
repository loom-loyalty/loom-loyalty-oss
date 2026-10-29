import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useTargetField } from "./use-target-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface TargetLike {
  targetId: string;
  name: string;
  code: string;
  type?: string;
}

const TARGETS: TargetLike[] = Array.from({ length: 137 }, (_, i) => ({
  targetId: `tgt-${i}`,
  name: `Target ${i}`,
  code: `TG${String(i).padStart(3, "0")}`,
  type: i % 2 === 0 ? "COMPLETION" : "COUNTER",
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useTargetField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/targets`, items: TARGETS }));
  });

  it("fetches the first page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.targets).toHaveLength(50));
    expect(result.current.hasNextPage).toBe(true);
  });

  it("auto-advances through every page when loadAll is enabled", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField({ loadAll: true }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.targets).toHaveLength(137);
      expect(result.current.isLoadingAll).toBe(false);
    });
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.targets[result.current.targets.length - 1]?.targetId).toBe("tgt-136");
  });

  it("reports an incomplete list when a later load-all page fails", async () => {
    server.use(
      http.get(`${API_BASE}/targets`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        if (page > 0) {
          return HttpResponse.json(
            { success: false, errors: [{ code: "E", message: "page failed" }] },
            { status: 500 }
          );
        }
        return HttpResponse.json({
          content: TARGETS.slice(0, 50),
          totalSize: 100,
          totalPages: 2,
          pageNumber: 0,
          pageSize: 50,
        });
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField({ loadAll: true }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.targets).toHaveLength(50);
      expect(result.current.isLoadingAll).toBe(false);
      expect(result.current.hasLoadAllError).toBe(true);
    });
    expect(result.current.error).not.toBeNull();
    expect(result.current.hasNextPage).toBe(true);
  });

  it("preserves polymorphic target shape (Counter, Completion, etc.)", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.targets).toHaveLength(50));
    expect(
      result.current.targets.filter((t) => (t as TargetLike).type === "COUNTER")
    ).not.toHaveLength(0);
  });

  it("paginates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.targets).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.targets).toHaveLength(100));
  });

  it("debounces search and filters by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.targets).toHaveLength(50));
    act(() => result.current.setSearchValue("TG017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("tgt-17");
    vi.useRealTimers();
  });

  it("hasNextPage flips on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.targets).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.targets).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.targets).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/targets`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTargetField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
