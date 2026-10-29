import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

interface PagedShape {
  pageNumber?: number;
  totalPages?: number;
  [key: string]: unknown;
}

const warnedSources = new Set<string>();

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Dev-only one-time warn when a paged BE response omits `totalPages`. */
export function warnIfMissingTotalPages(payload: PagedShape | undefined, source: string): void {
  if (!isDev()) return;
  if (!payload) return;
  if (payload.totalPages !== undefined) return;
  if (warnedSources.has(source)) return;
  warnedSources.add(source);
  console.warn(
    `[${source}] BE response is missing totalPages — pagination is locked at page 0. ` +
      `Verify the list endpoint's response schema (likely an SDK regen or a BE drift).`
  );
}

/** Test-only: clear the per-source dedupe set. */
export function __resetInfiniteQueryWarnDedupe(): void {
  warnedSources.clear();
}

/** `getNextPageParam` for `{ data: { pageNumber, totalPages, content[] } }`; array payloads end pagination. */
export function getInfiniteNextPageParam(
  lastPage: { data: PagedShape | unknown[] | undefined },
  source: string
): number | undefined {
  const payload = lastPage.data;
  if (Array.isArray(payload)) return undefined;
  if (!payload) return undefined;
  warnIfMissingTotalPages(payload, source);
  const pageNumber = payload.pageNumber ?? 0;
  const totalPages = payload.totalPages ?? 0;
  return pageNumber + 1 < totalPages ? pageNumber + 1 : undefined;
}

/**
 * Trim cached pages to the first + invalidate, so a create mutation's new
 * entity can re-emerge on page 0.
 *
 * `queryKey` is deliberately a partial prefix (no `mode`/`pageSize` suffix)
 * so this matches an infinite query's cache entry regardless of the exact
 * page size a given caller used. `setQueriesData`'s partial matching means
 * that same prefix can also match a *different*, non-infinite `useQuery`
 * cache entry that happens to share it (e.g. a plain paginated list query
 * on the same page, same base resource) — its cached shape has no `.pages`
 * array. Guard for that shape before touching it, and leave it untouched
 * rather than crash; `invalidateQueries` below still refetches it normally.
 */
export function resetInfiniteQueryToFirstPage(queryClient: QueryClient, queryKey: QueryKey): void {
  queryClient.setQueriesData<InfiniteData<unknown>>({ queryKey }, (old) => {
    if (!old || !Array.isArray(old.pages) || old.pages.length <= 1) return old;
    return {
      pages: old.pages.slice(0, 1),
      pageParams: old.pageParams.slice(0, 1),
    };
  });
  queryClient.invalidateQueries({ queryKey });
}
