/**
 * Registry query: "which activities does this operator surface offer?"
 *
 * Wraps the generated `listEventTypeActions` hook so every consumer (the hub
 * care surface today, the dashboard developer surface later) answers that
 * question the same way, and so the paged-envelope trap below is handled once.
 */

import {
  useEventEngineManagementListEventTypeActions,
  type EventActionSurface,
  type EventTypeAction,
  type MatchMode,
} from "@loom-loyalty/sdk";
import { useMemo } from "react";

/** Registry page size. The care surface is curated, so one page is plenty; a
 * tenant with more registrations than this needs a paged admin surface, not a
 * bigger picker. */
const DEFAULT_PAGE_SIZE = 100;

export interface UseEventTypeActionsOptions {
  /** Which operator surface to list registrations for. */
  surface: EventActionSurface;
  /**
   * Server-side search term. Passed through to the endpoint rather than
   * filtered after fetch. Tenant-defined activities are unbounded, so
   * client-side filtering would silently miss anything past the first page.
   */
  search?: string;
  /** Server-side match mode paired with `search`. */
  matchMode?: MatchMode;
  /**
   * Server-side sort. Optional and unset by default: consumers group the list
   * themselves, and unsorted requests come back newest-first with a stable
   * tiebreak, so paging never duplicates or skips a row.
   *
   * If you do pass one, the syntax is `field:asc` / `field:desc`, with a COLON, not
   * a bare field name and not a comma. Only `createdDateTime`,
   * `modifiedDateTime`, and `eventTypeCode` are accepted; anything else is a
   * 400, which surfaces here as an empty list.
   */
  sort?: string;
  /** Skip the query entirely (e.g. the surface is not open yet). */
  enabled?: boolean;
  pageSize?: number;
}

export interface UseEventTypeActionsResult {
  /** Registrations for the requested surface. Never undefined. */
  actions: EventTypeAction[];
  /** Canonical count from the envelope, independent of `content`. */
  totalSize: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Shape of the paged envelope we actually read.
 *
 * Micronaut Data omits `content` **entirely** when `totalSize` is 0. It is an
 * absent key, not an empty array. The care surface returns exactly that on an
 * organization with no registrations, so `content.map(...)` would be a
 * TypeError on the very first render. `totalSize` is the canonical count and
 * `content` is defaulted here, at this boundary, so no call site can trip on it.
 */
interface PagedEventTypeActionsEnvelope {
  content?: EventTypeAction[];
  totalSize?: number;
}

/** List the activities registered for one operator surface. */
export function useEventTypeActions(
  options: UseEventTypeActionsOptions
): UseEventTypeActionsResult {
  const {
    surface,
    search,
    matchMode,
    sort,
    enabled = true,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;

  const query = useEventEngineManagementListEventTypeActions(
    {
      surface,
      page: 0,
      size: pageSize,
      ...(sort ? { sort } : {}),
      ...(search ? { search } : {}),
      ...(matchMode ? { matchMode } : {}),
    },
    { query: { enabled } }
  );

  const { actions, totalSize } = useMemo(() => {
    const response = query.data;
    if (!response || response.status !== 200) {
      return { actions: [] as EventTypeAction[], totalSize: 0 };
    }
    const envelope = response.data as unknown as PagedEventTypeActionsEnvelope | undefined;
    return {
      actions: envelope?.content ?? [],
      totalSize: envelope?.totalSize ?? 0,
    };
  }, [query.data]);

  return {
    actions,
    totalSize,
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}
