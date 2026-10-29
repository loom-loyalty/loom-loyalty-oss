import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useLoadAllPages, type UseLoadAllPagesOptions } from "./use-load-all-pages";

describe("useLoadAllPages", () => {
  it("fetches the next page while enabled and more pages remain", () => {
    const fetchNextPage = vi.fn();
    const { result } = renderHook(() =>
      useLoadAllPages({
        enabled: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        loadedPageCount: 1,
        fetchNextPage,
        isError: false,
      })
    );
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.isLoadingAll).toBe(true);
  });

  it("does not fetch while a page is already in flight (but stays loading-all)", () => {
    const fetchNextPage = vi.fn();
    const { result } = renderHook(() =>
      useLoadAllPages({
        enabled: true,
        hasNextPage: true,
        isFetchingNextPage: true,
        loadedPageCount: 1,
        fetchNextPage,
        isError: false,
      })
    );
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(result.current.isLoadingAll).toBe(true);
  });

  it("does nothing when disabled", () => {
    const fetchNextPage = vi.fn();
    const { result } = renderHook(() =>
      useLoadAllPages({
        enabled: false,
        hasNextPage: true,
        isFetchingNextPage: false,
        loadedPageCount: 1,
        fetchNextPage,
        isError: false,
      })
    );
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(result.current.isLoadingAll).toBe(false);
  });

  it("keeps advancing when a new page arrives without a boolean dependency change", () => {
    const fetchNextPage = vi.fn();
    const props: UseLoadAllPagesOptions = {
      enabled: true,
      hasNextPage: true,
      isFetchingNextPage: false,
      loadedPageCount: 1,
      fetchNextPage,
      isError: false,
    };
    const { rerender } = renderHook((p: UseLoadAllPagesOptions) => useLoadAllPages(p), {
      initialProps: props,
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    // React-query can commit the completed page with the same true/false pair
    // that preceded the previous fetch. Page count is the state transition that
    // must trigger the next request.
    rerender({ ...props, loadedPageCount: 2 });
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("advances page-by-page and clears isLoadingAll when the last page arrives", () => {
    const fetchNextPage = vi.fn();
    const props: UseLoadAllPagesOptions = {
      enabled: true,
      hasNextPage: true,
      isFetchingNextPage: false,
      loadedPageCount: 1,
      fetchNextPage,
      isError: false,
    };
    const { result, rerender } = renderHook((p: UseLoadAllPagesOptions) => useLoadAllPages(p), {
      initialProps: props,
    });
    // First render: request the next page.
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.isLoadingAll).toBe(true);

    // That page is now fetching — no duplicate request.
    rerender({ ...props, isFetchingNextPage: true });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.isLoadingAll).toBe(true);

    // A new page arrived while pagination still has more → request the next.
    rerender({ ...props, loadedPageCount: 2 });
    expect(fetchNextPage).toHaveBeenCalledTimes(2);

    // Last page in: pagination ends, loading-all clears, no further request.
    rerender({ ...props, hasNextPage: false });
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
    expect(result.current.isLoadingAll).toBe(false);
  });

  it("stops advancing and clears isLoadingAll when the query errors mid-load", () => {
    // The dangerous mode: a page failed, so react-query keeps hasNextPage true while
    // isFetchingNextPage settles false. Without the isError stop the effect would re-fire
    // fetchNextPage forever and isLoadingAll would stick true (a permanently stuck gate).
    const fetchNextPage = vi.fn();
    const props: UseLoadAllPagesOptions = {
      enabled: true,
      hasNextPage: true,
      isFetchingNextPage: false,
      loadedPageCount: 1,
      fetchNextPage,
      isError: false,
    };
    const { result, rerender } = renderHook((p: UseLoadAllPagesOptions) => useLoadAllPages(p), {
      initialProps: props,
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    // The page errors: hasNextPage stays true, isFetchingNextPage false, isError true.
    rerender({ ...props, isError: true });
    expect(result.current.isLoadingAll).toBe(false);

    // The effect deps churn (a settled fetch) but no further fetch is attempted.
    rerender({ ...props, isError: true, isFetchingNextPage: true });
    rerender({ ...props, isError: true, isFetchingNextPage: false });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.isLoadingAll).toBe(false);
  });
});
