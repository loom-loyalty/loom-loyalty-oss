import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ListSearchSchemaSpec } from "../data-display/list-search-schema";
import { useListControls } from "./use-list-controls";

let currentSearch: Record<string, unknown> = {};
const navigateMock = vi.fn(
  (opts: { search?: (prev: Record<string, unknown>) => Record<string, unknown> }) => {
    if (opts && typeof opts.search === "function") {
      currentSearch = opts.search(currentSearch);
    }
  }
);

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => currentSearch,
  useNavigate: () => navigateMock,
}));

const SPEC = {
  filters: {
    type: { type: "single", values: ["COUPON", "EXTERNAL"] },
    status: { type: "multi", values: ["A", "B", "C"] },
  },
  defaultPageSize: 25,
} satisfies ListSearchSchemaSpec;

describe("useListControls", () => {
  beforeEach(() => {
    currentSearch = {};
    navigateMock.mockClear();
  });

  it("derives defaults from an empty URL", () => {
    const { result } = renderHook(() => useListControls({ spec: SPEC }));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.filters).toEqual({ type: "", status: [] });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.queryArgs.enabled).toBe(true);
  });

  it("setFilter writes the value, resets page, and preserves detail", () => {
    currentSearch = { page: 3, detail: "off_1" };
    const { result, rerender } = renderHook(() => useListControls({ spec: SPEC }));

    act(() => result.current.setFilter("type", "COUPON"));
    rerender();

    expect(currentSearch).toEqual({ type: "COUPON", detail: "off_1" });
    expect(result.current.filters.type).toBe("COUPON");
    expect(result.current.page).toBe(1);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("toggleFilterValue maintains a canonical, deduped multi set", () => {
    const { result, rerender } = renderHook(() => useListControls({ spec: SPEC }));

    act(() => result.current.toggleFilterValue("status", "B"));
    rerender();
    act(() => result.current.toggleFilterValue("status", "A"));
    rerender();
    expect(currentSearch.status).toBe("A,B");
    expect(result.current.filters.status).toEqual(["A", "B"]);

    act(() => result.current.toggleFilterValue("status", "A"));
    rerender();
    expect(result.current.filters.status).toEqual(["B"]);
  });

  it("clearAll resets controls but preserves detail", () => {
    currentSearch = { type: "COUPON", status: "A", detail: "x", page: 2 };
    const { result } = renderHook(() => useListControls({ spec: SPEC }));

    act(() => result.current.clearAll());

    expect(currentSearch).toEqual({ detail: "x" });
  });

  it("applySearch applies a snapshot, keeps detail, and resets page", () => {
    currentSearch = { detail: "x", page: 4, type: "EXTERNAL" };
    const { result } = renderHook(() => useListControls({ spec: SPEC }));

    act(() => result.current.applySearch({ type: "COUPON", status: "A,B" }));

    expect(currentSearch).toEqual({ detail: "x", type: "COUPON", status: "A,B" });
  });

  it("setPage writes page and paginationProps reflects it", () => {
    const { result, rerender } = renderHook(() => useListControls({ spec: SPEC }));

    act(() => result.current.setPage(3));
    rerender();

    expect(currentSearch.page).toBe(3);
    expect(result.current.paginationProps(100)).toMatchObject({
      page: 3,
      pageSize: 25,
      total: 100,
    });
  });

  it("queryArgs normalizes filters and pagination", () => {
    currentSearch = { type: "COUPON", status: "A" };
    const { result } = renderHook(() => useListControls({ spec: SPEC }));

    expect(result.current.queryArgs.pagination).toEqual({ page: 1, pageSize: 25 });
    expect(result.current.queryArgs.filters).toEqual({ type: "COUPON", status: ["A"] });
  });

  it("drops queryArgs.search immediately when the input is cleared (no stale debounce)", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() =>
        useListControls({ spec: SPEC, searchDebounceMs: 300 })
      );

      act(() => result.current.setSearch("foo"));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      rerender();
      expect(result.current.queryArgs.search).toBe("foo");

      // Clear: input goes to "" instantly, debounced still holds "foo" briefly —
      // queryArgs.search must drop to undefined immediately, not after the next debounce cycle.
      act(() => result.current.setSearch(""));
      expect(result.current.queryArgs.search).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hasCommittedState reflects URL state, not live input", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() =>
        useListControls({ spec: SPEC, searchDebounceMs: 300 })
      );

      expect(result.current.hasCommittedState).toBe(false);

      act(() => result.current.setSearch("foo"));
      // Live input has content, but nothing committed to URL yet.
      expect(result.current.hasCommittedState).toBe(false);

      act(() => {
        vi.advanceTimersByTime(300);
      });
      rerender();
      expect(result.current.hasCommittedState).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gates both the query and the URL write below searchMinChars", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() =>
        useListControls({
          spec: SPEC,
          searchMinChars: 3,
          searchDebounceMs: 300,
        })
      );

      // Sub-threshold input never reaches the URL — partial searches aren't shareable.
      act(() => result.current.setSearch("ab"));
      expect(result.current.queryArgs.enabled).toBe(false);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      rerender();
      expect(currentSearch.q).toBeUndefined();
      expect(result.current.queryArgs.enabled).toBe(false);

      // Reaching the threshold commits to URL and enables the query.
      act(() => result.current.setSearch("abc"));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      rerender();
      expect(currentSearch.q).toBe("abc");
      expect(result.current.queryArgs.enabled).toBe(true);

      // Backing off below threshold clears the stale URL value.
      act(() => result.current.setSearch("ab"));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      rerender();
      expect(currentSearch.q).toBeUndefined();
      expect(result.current.queryArgs.enabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
