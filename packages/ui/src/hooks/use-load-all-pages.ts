/**
 * Auto-advance an infinite query to completion. While `enabled` and more pages
 * remain, fetch the next one — so a consumer that needs the FULL list (e.g. reward
 * grounding validating a code against every badge, not just page 1) isn't limited to
 * the first page. Mirrors the auto-advance pattern in `use-event-type-field.ts`, which
 * keeps its own dedup-aware variant; this is the plain shared version.
 *
 * `isLoadingAll` stays true until the last page is in, so callers can gate work that
 * needs the complete list (a submit that grounds against it) behind it.
 *
 * A failed page is terminal: react-query leaves `hasNextPage` true while
 * `isFetchingNextPage` settles back to false, so without an error stop the effect would
 * re-fire `fetchNextPage` forever and `isLoadingAll` would never clear (a permanently
 * stuck gate). Pass the query's `isError` so paging halts and `isLoadingAll` clears on
 * failure — the caller then falls back to the pages that did load (or prompt-only work).
 *
 * Pass the RAW react-query `fetchNextPage`/`hasNextPage`/`isFetchingNextPage` (react-query
 * keeps `fetchNextPage` referentially stable), not a per-render wrapper — the effect
 * depends on `fetchNextPage`, so an unstable identity would re-run it every render.
 */

import { useEffect } from "react";

export interface UseLoadAllPagesOptions {
  /** Drive pagination only while true (e.g. the field is actually in use). */
  enabled: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Increments after each successful page, ensuring the effect advances past page two. */
  loadedPageCount: number;
  fetchNextPage: () => void;
  /**
   * The query is in an error state. A failed page leaves `hasNextPage` true, so this
   * halts advancement and clears `isLoadingAll` instead of looping/handing forever.
   */
  isError: boolean;
}

export interface UseLoadAllPagesResult {
  /** True while more pages remain to load and no error has halted paging. */
  isLoadingAll: boolean;
}

export function useLoadAllPages(options: UseLoadAllPagesOptions): UseLoadAllPagesResult {
  const { enabled, hasNextPage, isFetchingNextPage, loadedPageCount, fetchNextPage, isError } =
    options;
  // An errored query never makes progress (the failed page isn't appended, so
  // hasNextPage stays true) — treat it as inactive so we neither re-fire nor hang.
  const active = enabled && !isError;

  useEffect(() => {
    if (active && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [active, hasNextPage, isFetchingNextPage, loadedPageCount, fetchNextPage]);

  return { isLoadingAll: active && hasNextPage };
}
