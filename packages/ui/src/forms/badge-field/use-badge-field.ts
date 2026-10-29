/**
 * Hook for fetching badges. Server-paginated; a debounced search term goes to
 * the list endpoint's `search` param (name/code). With `loadAll`, every page
 * loads up front and search filters the full list client-side.
 */

import { useCallback, useMemo, useState } from "react";

import {
  customerStatusManagementListBadges,
  getCustomerStatusManagementListBadgesQueryKey,
  type Badge,
} from "@loom-loyalty/sdk";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

const fetchBadgePage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  customerStatusManagementListBadges({ page, size, ...(search ? { search } : {}) });

const matchesBadge = (badge: Badge, needle: string): boolean =>
  !needle ||
  (badge.name?.toLowerCase() ?? "").includes(needle) ||
  (badge.code?.toLowerCase() ?? "").includes(needle);

const badgeKey = (badge: Badge) => badge.badgeId ?? badge.code;

export interface UseBadgeFieldOptions {
  pageSize?: number;
  enabled?: boolean;
  /**
   * Auto-advance through every page until the full badge list is loaded. Set for
   * consumers that must ground against ALL badges (e.g. the NL → reward generator
   * validating a `badgeCode`), not just the first page. Gate list-dependent work on
   * the returned `isLoadingAll`. Off by default — the picker lazy-loads on scroll.
   */
  loadAll?: boolean;
}

export interface UseBadgeFieldReturn {
  options: EntityOption[];
  /** All loaded badges as EntityOptions, regardless of search. Use for badge/trigger lookup. */
  optionsAll: EntityOption[];
  badges: Badge[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** True while `loadAll` is still paging through the remaining badges. */
  isLoadingAll: boolean;
  totalLoaded: number;
  totalAvailable: number;
  findBadge: (id: string) => Badge | undefined;
}

export function useBadgeField(options?: UseBadgeFieldOptions): UseBadgeFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;
  const loadAll = options?.loadAll ?? false;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: filteredBadges,
    rows: badges,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
    isLoadingAll,
  } = useSearchableInfiniteList<Badge>({
    queryKey: getCustomerStatusManagementListBadgesQueryKey(),
    fetchPage: fetchBadgePage,
    pageSize,
    search: debouncedSearch,
    filter: matchesBadge,
    getKey: badgeKey,
    enabled,
    // On a failed page load-all halts and `isLoadingAll` clears; the reward
    // step's `fetchContext` then omits the badge list (prompt-only grounding).
    loadAll,
    source: "badge-field",
  });

  const toOption = (badge: Badge): EntityOption | null => {
    const id = badge.badgeId ?? badge.code;
    return id != null ? { id, name: badge.name, secondaryText: badge.code } : null;
  };

  const optionsAll = useMemo<EntityOption[]>(
    () => badges.map(toOption).filter((o): o is EntityOption => o !== null),
    [badges]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredBadges.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredBadges]
  );

  const findBadge = useCallback(
    (id: string): Badge | undefined => {
      return badges.find((b) => (b.badgeId ?? b.code) === id);
    },
    [badges]
  );

  return {
    options: optionsList,
    optionsAll,
    badges,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoadingAll,
    totalLoaded: badges.length,
    totalAvailable,
    findBadge,
  };
}
