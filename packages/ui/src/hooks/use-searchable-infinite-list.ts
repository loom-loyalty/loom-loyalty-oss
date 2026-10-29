/**
 * Shared data plumbing for the infinite-scroll entity pickers (tier, program,
 * partner, event rule, ...). Browsing pages through the list at `pageSize`;
 * typing a search term asks the server for matches instead of filtering only
 * the pages already loaded, so a row on page five is found without scrolling.
 *
 * - `serverSearch` (default true) sends the trimmed term as the endpoint's
 *   `search` param under its own cache entry. Until the first search page
 *   lands, the browsed rows (narrowed by `filter`) stay on screen.
 * - Endpoints without a search param pass `serverSearch: false`; the term then
 *   only feeds `filter`, and the hook keeps loading pages while the filter
 *   hides every loaded row, so "no results" means the list is exhausted.
 *
 * `rows` merges browsed rows with every row an earlier search found (deduped by
 * `getKey`) so a trigger and `find*` still resolve a value picked from search
 * results after the term clears.
 */

import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getInfiniteNextPageParam } from "./infinite-query-helpers";
import { useLoadAllPages } from "./use-load-all-pages";

const DEFAULT_STALE_MS = 5 * 60 * 1000;
// Short GC for per-term cache entries so typing doesn't pile up orphans.
const SEARCH_GC_MS = 2 * 60 * 1000;

export interface SearchableInfiniteFetchParams {
  page: number;
  size: number;
  /** Trimmed, non-empty search term; absent while browsing. */
  search?: string;
}

interface PagedShape<T> {
  content?: T[];
  pageNumber?: number;
  totalPages?: number;
  totalSize?: number;
  [key: string]: unknown;
}

type ListPage<T> = { data?: PagedShape<T> | T[] | unknown };

export interface UseSearchableInfiniteListOptions<T> {
  /** Resource prefix of the list's cache key (e.g. `getXQueryKey()`). */
  queryKey: QueryKey;
  /** Fetch one zero-based page; forward `search` to the endpoint when set. */
  fetchPage: (params: SearchableInfiniteFetchParams) => Promise<unknown>;
  pageSize: number;
  /** Search term, already debounced by the caller. */
  search: string;
  /** Whether the endpoint filters by `search` server-side. Defaults to true. */
  serverSearch?: boolean;
  /**
   * Server-side filters that narrow the list (e.g. `{ category }`). Added to the
   * cache key; `fetchPage` must send them itself.
   */
  scope?: Record<string, unknown>;
  /**
   * Client-side predicate for the visible rows, called with the trimmed,
   * lower-cased term ("" while browsing). Keep it referentially stable.
   */
  filter?: (row: T, needle: string) => boolean;
  /** Identity used to merge browsed and searched rows. */
  getKey: (row: T) => string | null | undefined;
  enabled?: boolean;
  /**
   * Walk every browse page up front (for callers that ground against the full
   * list). Search then filters the complete list client-side.
   */
  loadAll?: boolean;
  staleTime?: number;
  /** Names the list in dev warnings about malformed page metadata. */
  source: string;
}

export interface UseSearchableInfiniteListResult<T> {
  /** Rows to offer in the dropdown: search results once they land, else browsed rows. */
  visibleRows: T[];
  /** Browsed rows plus every row a search found, deduped; for trigger lookup and `find*`. */
  rows: T[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Safe to call at any time; a no-op while a page is in flight or none remain. */
  fetchNextPage: () => void;
  /** Total rows the server reports for the active list (browse or search). */
  totalAvailable: number;
  /** With `loadAll`: true until every browse page has landed or one failed. */
  isLoadingAll: boolean;
}

function pageRows<T>(page: ListPage<T>): T[] {
  const payload = page.data;
  if (Array.isArray(payload)) return payload as T[];
  if (payload == null || typeof payload !== "object") return [];
  return (payload as PagedShape<T>).content ?? [];
}

function nextPageParam<T>(page: ListPage<T>, source: string): number | undefined {
  const payload = page.data;
  if (payload == null || typeof payload !== "object") return undefined;
  return getInfiniteNextPageParam({ data: payload as PagedShape<T> | unknown[] }, source);
}

export function useSearchableInfiniteList<T>(
  options: UseSearchableInfiniteListOptions<T>
): UseSearchableInfiniteListResult<T> {
  const {
    queryKey,
    fetchPage,
    pageSize,
    search,
    serverSearch = true,
    scope,
    filter,
    getKey,
    enabled = true,
    loadAll = false,
    staleTime = DEFAULT_STALE_MS,
    source,
  } = options;

  const term = search.trim();
  const needle = term.toLowerCase();
  const searching = serverSearch && !loadAll && term.length > 0;

  const browse = useInfiniteQuery({
    queryKey: [...queryKey, { mode: "infinite" as const, pageSize, ...scope }],
    queryFn: ({ pageParam }) =>
      fetchPage({ page: pageParam, size: pageSize }) as Promise<ListPage<T>>,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => nextPageParam(lastPage, source),
    staleTime,
    enabled,
  });

  const searched = useInfiniteQuery({
    queryKey: [...queryKey, { mode: "infinite" as const, pageSize, ...scope, search: term }],
    queryFn: ({ pageParam }) =>
      fetchPage({ page: pageParam, size: pageSize, search: term }) as Promise<ListPage<T>>,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => nextPageParam(lastPage, source),
    staleTime,
    gcTime: SEARCH_GC_MS,
    enabled: enabled && searching,
  });

  const { isLoadingAll } = useLoadAllPages({
    enabled: enabled && loadAll,
    hasNextPage: !!browse.hasNextPage,
    isFetchingNextPage: browse.isFetchingNextPage,
    loadedPageCount: browse.data?.pages.length ?? 0,
    // react-query keeps this stable; the load-all effect depends on it.
    fetchNextPage: browse.fetchNextPage,
    isError: browse.isError,
  });

  const browseRows = useMemo(() => (browse.data?.pages ?? []).flatMap(pageRows<T>), [browse.data]);
  const searchRows = useMemo(
    () => (searching ? (searched.data?.pages ?? []).flatMap(pageRows<T>) : []),
    [searching, searched.data]
  );

  // Search results replace the browsed rows only once they land.
  const showSearch = searching && searched.data != null;
  const active = showSearch ? searched : browse;
  const activeRows = showSearch ? searchRows : browseRows;
  // The first search page counts as "loading more" so the dropdown says so
  // instead of reporting no matches among the browsed rows.
  const searchPending = searching && searched.isPending && !searched.isError;

  const visibleRows = useMemo(
    () => (filter ? activeRows.filter((row) => filter(row, needle)) : activeRows),
    [activeRows, filter, needle]
  );

  // Rows found by earlier searches stay resolvable after the term changes or
  // clears (a value picked from search results must keep its label and
  // `find*` lookup). Reset when the list itself changes (key or scope).
  const listIdentity = JSON.stringify([queryKey, scope ?? null]);
  const foundRef = useRef<{ identity: string; rows: Map<string, T> }>({
    identity: listIdentity,
    rows: new Map(),
  });
  if (foundRef.current.identity !== listIdentity) {
    foundRef.current = { identity: listIdentity, rows: new Map() };
  }
  const found = foundRef.current.rows;
  for (const row of searchRows) {
    const key = getKey(row);
    if (key != null) found.set(key, row);
  }
  const foundCount = found.size;

  const rows = useMemo(() => {
    if (foundCount === 0) return browseRows;
    const merged: T[] = [];
    const seen = new Set<string>();
    for (const row of browseRows) {
      const key = getKey(row);
      if (key != null) seen.add(key);
      merged.push(row);
    }
    for (const [key, row] of found) {
      if (!seen.has(key)) merged.push(row);
    }
    return merged;
    // `found` mutates in place; its size and the search rows mark changes.
  }, [browseRows, searchRows, foundCount, found, getKey]);

  const totalAvailable = useMemo(() => {
    const pages = active.data?.pages;
    const last = pages?.[pages.length - 1]?.data;
    if (last == null || Array.isArray(last) || typeof last !== "object") return activeRows.length;
    return (last as PagedShape<T>).totalSize ?? activeRows.length;
  }, [active.data, activeRows.length]);

  const error = (browse.error ?? (searching ? searched.error : null)) as Error | null;
  const hasNextPage = !searchPending && !!active.hasNextPage;
  const isFetchingNextPage = searchPending || active.isFetchingNextPage;
  const activeFetchNextPage = active.fetchNextPage;
  const activeHasNext = !!active.hasNextPage;
  const activeFetching = active.isFetchingNextPage;

  const fetchNextPage = useCallback(() => {
    if (searchPending || !activeHasNext || activeFetching) return;
    void activeFetchNextPage();
  }, [searchPending, activeHasNext, activeFetching, activeFetchNextPage]);

  // When the client-side filter hides every loaded row, keep paging until a
  // row survives or the list runs out, so "no results" is never premature.
  const filteredToNothing = activeRows.length > 0 && visibleRows.length === 0;
  const activeError = active.isError;
  // Page count is load-bearing: hasNextPage/isFetchingNextPage read the same
  // before and after a fetch, so without it the chain can stall one page in.
  const activePageCount = active.data?.pages.length ?? 0;
  useEffect(() => {
    if (!enabled || !filteredToNothing || activeError) return;
    if (searchPending || !activeHasNext || activeFetching) return;
    void activeFetchNextPage();
  }, [
    enabled,
    filteredToNothing,
    activeError,
    searchPending,
    activeHasNext,
    activeFetching,
    activeFetchNextPage,
    activePageCount,
  ]);

  return {
    visibleRows,
    rows,
    isLoading: enabled && browse.isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
    isLoadingAll,
  };
}
