import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "./use-searchable-infinite-list";

interface Row {
  id: string;
  name: string;
}

const ROWS: Row[] = Array.from({ length: 25 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

/** Serves ROWS in pages, filtering by `search` the way the Platform API does. */
function serve(rows: Row[] = ROWS) {
  return vi.fn(({ page, size, search }: SearchableInfiniteFetchParams) => {
    const matches = search
      ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
      : rows;
    return Promise.resolve({
      data: {
        content: matches.slice(page * size, (page + 1) * size),
        pageNumber: page,
        totalPages: Math.ceil(matches.length / size),
        totalSize: matches.length,
      },
    });
  });
}

const byName = (row: Row, needle: string) => !needle || row.name.toLowerCase().includes(needle);
const rowKey = (row: Row) => row.id;

describe("useSearchableInfiniteList", () => {
  it("browses page by page at the given size", async () => {
    const fetchPage = serve();
    const { result } = renderHook(
      () =>
        useSearchableInfiniteList<Row>({
          queryKey: ["rows-browse"],
          fetchPage,
          pageSize: 10,
          search: "",
          getKey: rowKey,
          source: "test",
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.visibleRows).toHaveLength(10));
    expect(fetchPage).toHaveBeenCalledWith({ page: 0, size: 10 });
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.totalAvailable).toBe(25);

    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.visibleRows).toHaveLength(20));
  });

  it("asks the server for a search term and keeps found rows after it clears", async () => {
    const fetchPage = serve();
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) =>
        useSearchableInfiniteList<Row>({
          queryKey: ["rows-search"],
          fetchPage,
          pageSize: 10,
          search,
          filter: byName,
          getKey: rowKey,
          source: "test",
        }),
      { wrapper: wrapper(), initialProps: { search: "" } }
    );
    await waitFor(() => expect(result.current.visibleRows).toHaveLength(10));

    rerender({ search: " Row 24 " });
    // Until the search page lands the dropdown reports loading, not "no results".
    expect(result.current.isFetchingNextPage).toBe(true);
    expect(result.current.hasNextPage).toBe(false);
    await waitFor(() => expect(result.current.visibleRows.map((r) => r.id)).toEqual(["r24"]));
    expect(fetchPage).toHaveBeenCalledWith({ page: 0, size: 10, search: "Row 24" });
    expect(result.current.totalAvailable).toBe(1);

    rerender({ search: "" });
    await waitFor(() => expect(result.current.visibleRows).toHaveLength(10));
    expect(result.current.rows.map((r) => r.id)).toContain("r24");
  });

  it("without server search, keeps paging until the filter matches a row", async () => {
    const fetchPage = serve();
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) =>
        useSearchableInfiniteList<Row>({
          queryKey: ["rows-client"],
          fetchPage,
          pageSize: 10,
          search,
          serverSearch: false,
          filter: byName,
          getKey: rowKey,
          source: "test",
        }),
      { wrapper: wrapper(), initialProps: { search: "" } }
    );
    await waitFor(() => expect(result.current.visibleRows).toHaveLength(10));

    rerender({ search: "Row 22" });
    await waitFor(() => expect(result.current.visibleRows.map((r) => r.id)).toEqual(["r22"]));
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.every(([params]) => params.search === undefined)).toBe(true);
  });

  it("stops paging once the list is exhausted with no match", async () => {
    const fetchPage = serve();
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) =>
        useSearchableInfiniteList<Row>({
          queryKey: ["rows-none"],
          fetchPage,
          pageSize: 10,
          search,
          serverSearch: false,
          filter: byName,
          getKey: rowKey,
          source: "test",
        }),
      { wrapper: wrapper(), initialProps: { search: "" } }
    );
    await waitFor(() => expect(result.current.visibleRows).toHaveLength(10));

    rerender({ search: "nothing" });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.isFetchingNextPage).toBe(false);
    expect(result.current.visibleRows).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("surfaces a failed search instead of the browsed rows", async () => {
    const browse = serve();
    const fetchPage = vi.fn((params: SearchableInfiniteFetchParams) =>
      params.search ? Promise.reject(new Error("search failed")) : browse(params)
    );
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) =>
        useSearchableInfiniteList<Row>({
          queryKey: ["rows-error"],
          fetchPage,
          pageSize: 10,
          search,
          filter: byName,
          getKey: rowKey,
          source: "test",
        }),
      { wrapper: wrapper(), initialProps: { search: "" } }
    );
    await waitFor(() => expect(result.current.visibleRows).toHaveLength(10));

    rerender({ search: "Row 3" });
    await waitFor(() => expect(result.current.error?.message).toBe("search failed"));
    expect(result.current.isFetchingNextPage).toBe(false);
  });

  it("with loadAll, walks every page and searches the full list client-side", async () => {
    const fetchPage = serve();
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) =>
        useSearchableInfiniteList<Row>({
          queryKey: ["rows-all"],
          fetchPage,
          pageSize: 10,
          search,
          filter: byName,
          getKey: rowKey,
          loadAll: true,
          source: "test",
        }),
      { wrapper: wrapper(), initialProps: { search: "" } }
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(25));
    expect(result.current.isLoadingAll).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(3);

    rerender({ search: "Row 24" });
    await waitFor(() => expect(result.current.visibleRows.map((r) => r.id)).toEqual(["r24"]));
    expect(fetchPage.mock.calls.every(([params]) => params.search === undefined)).toBe(true);
  });
});
