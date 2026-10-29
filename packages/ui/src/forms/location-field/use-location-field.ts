/**
 * Hook for fetching locations. Server-paginated with debounced client-side
 * substring filter on `name` and `code` (the platform list endpoint does not
 * accept a `q` param). Because the filter can only see pages already loaded,
 * an active search auto-fetches remaining pages (see the effect below) so a
 * match beyond the first page is still findable, not silently invisible.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  getMetadataManagementListLocationsQueryKey,
  metadataManagementListLocations,
  type Location,
  type PagedLocationData,
} from "@loom-loyalty/sdk";

import { getInfiniteNextPageParam } from "../../hooks/infinite-query-helpers";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;
// Caps the auto-fetch-while-searching effect below (code review finding:
// unbounded for a tenant with hundreds/thousands of Locations, and
// EntitySelectBox's dropdown isn't virtualized). At the default page size,
// 10 pages covers 500 locations -- comfortably past any real tenant seen so
// far -- while still bounding the worst case to a fixed number of round
// trips rather than however many pages a huge catalog happens to have.
const MAX_AUTO_FETCH_PAGES = 10;

export interface UseLocationFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UseLocationFieldReturn {
  options: EntityOption[];
  /** All loaded locations as EntityOptions, regardless of search. Use for badge/trigger lookup. */
  optionsAll: EntityOption[];
  locations: Location[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  findLocation: (id: string) => Location | undefined;
}

export function useLocationField(options?: UseLocationFieldOptions): UseLocationFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    data,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      ...getMetadataManagementListLocationsQueryKey(),
      { mode: "infinite" as const, pageSize },
    ] as const,
    queryFn: ({ pageParam }) =>
      metadataManagementListLocations({ page: pageParam as number, size: pageSize }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getInfiniteNextPageParam(lastPage as { data: PagedLocationData }, "location-field"),
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // The substring filter below only ever sees pages already loaded -- with
  // no server-side `q` param, a location beyond the first page would
  // otherwise be unsearchable and never surface, indistinguishable from not
  // existing (code review finding). While a search is active, keep fetching
  // remaining pages until either they run out or the search clears, so the
  // filter eventually runs over the full result set rather than a partial
  // one. Keyed off the debounced value so a still-typing burst doesn't
  // trigger a fetch per keystroke; inert while idle (no search) so plain
  // browsing keeps its existing lazy, load-more-on-demand behavior.
  //
  // `loadedPageCount` (not just hasNextPage/isFetchingNextPage) is a
  // deliberate, load-bearing dependency: those two booleans return to the
  // exact same pair of values both right before a fetch starts and right
  // after it finishes (true/false in both cases, for every non-final page).
  // With only those as deps, React's Object.is comparison sees no change
  // between the "about to fetch" and "just fetched" commits and never
  // re-runs the effect past the first page -- the chain silently stalls one
  // page in, with no error and no visible symptom beyond "search sometimes
  // doesn't find things page 2+" (caught only by driving this through real
  // async ticks in a test, not by reasoning about the dependency array in
  // isolation). Page count strictly increases with each successful fetch,
  // so it's the one dependency that actually distinguishes "before this
  // fetch" from "after this fetch."
  const loadedPageCount = data?.pages.length ?? 0;
  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    if (!hasNextPage || isFetchingNextPage) return;
    if (loadedPageCount >= MAX_AUTO_FETCH_PAGES) return;
    void fetchNextPage();
  }, [debouncedSearch, hasNextPage, isFetchingNextPage, fetchNextPage, loadedPageCount]);

  const locations = useMemo<Location[]>(() => {
    return data?.pages.flatMap((page) => page.data?.content ?? []) ?? [];
  }, [data]);

  const totalAvailable = useMemo(() => {
    const pages = data?.pages;
    const last = pages && pages.length > 0 ? pages[pages.length - 1]?.data : undefined;
    return last?.totalSize ?? locations.length;
  }, [data, locations.length]);

  const filteredLocations = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return locations;
    return locations.filter((location) => {
      const name = location.name?.toLowerCase() ?? "";
      const code = location.code?.toLowerCase() ?? "";
      return name.includes(needle) || code.includes(needle);
    });
  }, [locations, debouncedSearch]);

  const toOption = (location: Location): EntityOption | null =>
    location.locationId != null
      ? { id: location.locationId, name: location.name, secondaryText: location.code }
      : null;

  const optionsAll = useMemo<EntityOption[]>(
    () => locations.map(toOption).filter((o): o is EntityOption => o !== null),
    [locations]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredLocations.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredLocations]
  );

  const findLocation = (id: string): Location | undefined => {
    return locations.find((l) => l.locationId === id);
  };

  return {
    options: optionsList,
    optionsAll,
    locations,
    isLoading,
    error: (listError ?? null) as Error | null,
    searchValue,
    setSearchValue,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      if (!hasNextPage || isFetchingNextPage) return;
      void fetchNextPage();
    },
    totalLoaded: locations.length,
    totalAvailable,
    findLocation,
  };
}
