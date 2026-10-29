/**
 * Read a whole Platform API list by walking its pages at the largest size the
 * API accepts. For pickers and lookups that need every row of a small, bounded
 * catalog (roles, scopes, countries, data-model types). A list a person browses
 * belongs in a paged table instead (`useListControls` + `DataTable` pagination).
 *
 * `isLoading` stays true until the last page lands, so a partial list never
 * reads as complete; `isError` marks a list that stopped short.
 */

import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { MAX_LIST_PAGE_SIZE } from "../data-display/list-search-schema";
import { getInfiniteNextPageParam } from "./infinite-query-helpers";
import { useLoadAllPages } from "./use-load-all-pages";

interface PagedPayload<T> {
  content?: T[];
  pageNumber?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/**
 * One SDK list response. A success carries a paged payload (or a bare array
 * from older endpoints); the SDK throws on error statuses, whose `data` shapes
 * the generated union also lists, so `data` is narrowed at runtime.
 */
export interface AllPagesResponse {
  data?: unknown;
}

function pagedPayload<T>(response: AllPagesResponse): PagedPayload<T> | T[] | undefined {
  const payload = response.data;
  if (payload == null || typeof payload !== "object") return undefined;
  return payload as PagedPayload<T> | T[];
}

export interface UseAllPagesOptions {
  /** Cache key for the list; the page number is not part of it. */
  queryKey: QueryKey;
  /** Fetch one zero-based page of `size` rows. */
  fetchPage: (page: number, size: number) => Promise<AllPagesResponse>;
  enabled?: boolean;
  staleTime?: number;
  /** Retries for a failed page; defaults to the QueryClient's setting. */
  retry?: boolean | number;
  /** Names the list in dev warnings about malformed page metadata. */
  source: string;
}

export interface UseAllPagesResult<T> {
  /** Every row fetched so far, in server order. */
  items: T[];
  /** True until every page has landed. */
  isLoading: boolean;
  /** True when a page failed and `items` is missing rows. */
  isError: boolean;
  error: Error | null;
  /** True while any page, including a retry, is in flight. */
  isFetching: boolean;
  refetch: () => void;
}

export function useAllPages<T>(options: UseAllPagesOptions): UseAllPagesResult<T> {
  const { queryKey, fetchPage, enabled = true, staleTime, retry, source } = options;

  const query = useInfiniteQuery({
    queryKey: [...queryKey, { mode: "all-pages" as const, pageSize: MAX_LIST_PAGE_SIZE }],
    queryFn: async ({ pageParam }) => {
      const response = await fetchPage(pageParam, MAX_LIST_PAGE_SIZE);
      const payload = pagedPayload<T>(response);
      if (
        payload &&
        !Array.isArray(payload) &&
        payload.content != null &&
        !Array.isArray(payload.content)
      ) {
        throw new Error(
          "List response contract violation: expected paged data.content to be an array."
        );
      }
      return { data: payload };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => getInfiniteNextPageParam(lastPage, source),
    enabled,
    staleTime,
    ...(retry !== undefined && { retry }),
  });

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isError, refetch } = query;
  const { isLoadingAll } = useLoadAllPages({
    enabled,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    loadedPageCount: data?.pages.length ?? 0,
    fetchNextPage,
    isError,
  });

  const items = useMemo(
    () =>
      (data?.pages ?? []).flatMap((page) => {
        const payload = page.data;
        if (Array.isArray(payload)) return payload;
        return payload?.content ?? [];
      }),
    [data]
  );

  const refetchAll = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    items,
    isLoading: enabled && (query.isPending || isLoadingAll),
    isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: refetchAll,
  };
}
