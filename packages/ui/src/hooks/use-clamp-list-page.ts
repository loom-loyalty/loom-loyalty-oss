import { useEffect } from "react";

export interface UseClampListPageOptions {
  /** Current page, 1-indexed. */
  page: number;
  pageSize: number;
  /** Rows the server reports for the current filters (a floor is fine). */
  total: number;
  /** Rows the current page actually returned. */
  rowsOnPage: number;
  /**
   * True only once the current page's data has arrived. Keep it false while
   * the query is loading, fetching, failed, or disabled: a disabled query is
   * not fetching but has no rows yet either.
   */
  ready: boolean;
  setPage: (page: number) => void;
}

/**
 * Moves a paged list back when its page comes back empty: a stale `?page=`
 * link, deleting the last row of the last page, or stepping past the end of a
 * list whose total was only a floor. It lands on the last page the total says
 * exists, and never further forward than the page before.
 */
export function useClampListPage({
  page,
  pageSize,
  total,
  rowsOnPage,
  ready,
  setPage,
}: UseClampListPageOptions): void {
  useEffect(() => {
    if (!ready || rowsOnPage > 0 || page <= 1) return;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    setPage(Math.min(page - 1, lastPage));
  }, [ready, rowsOnPage, page, pageSize, total, setPage]);
}
