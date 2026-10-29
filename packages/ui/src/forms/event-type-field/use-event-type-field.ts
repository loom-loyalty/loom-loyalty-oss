/**
 * Hook for fetching event types. Server-paginated with debounced
 * client-side substring filter on `eventTypeCode` and `name`; while the
 * filter hides every loaded row, more pages load until one matches. Dedupes
 * by `eventTypeCode` because multiple configurations may exist for the
 * same event type — the trigger panel cares about which type, not
 * which config.
 *
 * The dropdown emits the eventTypeCode (e.g. "PURCHASE"), matching the
 * existing trigger panel storage semantics.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  eventEngineManagementListEventTypeConfigurations,
  getEventEngineManagementListEventTypeConfigurationsQueryKey,
  type EventTypeConfiguration,
} from "@loom-loyalty/sdk";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

const fetchEventTypeConfigurationPage = ({ page, size }: SearchableInfiniteFetchParams) =>
  eventEngineManagementListEventTypeConfigurations({ page, size });

// Server returns the event-type code on the nested `eventType.code`; the spec
// also declares a top-level `eventTypeCode` but the runtime payload omits it.
// Fall back to the nested code so the dropdown populates against the real wire shape.
const eventTypeCodeOf = (config: EventTypeConfiguration) =>
  config.eventTypeCode ?? config.eventType?.code;

const matchesEventType = (config: EventTypeConfiguration, needle: string): boolean => {
  if (!needle) return true;
  const code = eventTypeCodeOf(config);
  if (!code) return false;
  return (
    (config.name ?? code).toLowerCase().includes(needle) || code.toLowerCase().includes(needle)
  );
};

const configurationKey = (config: EventTypeConfiguration) => config.eventTypeConfigurationId;

function toOptions(configs: EventTypeConfiguration[]): EntityOption[] {
  const seen = new Set<string>();
  const out: EntityOption[] = [];
  for (const config of configs) {
    const code = eventTypeCodeOf(config);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ id: code, name: config.name ?? code, secondaryText: code });
  }
  return out;
}

export interface UseEventTypeFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UseEventTypeFieldReturn {
  options: EntityOption[];
  /** All loaded event-type options (deduped), regardless of search. Use for trigger lookup. */
  optionsAll: EntityOption[];
  eventTypeConfigurations: EventTypeConfiguration[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  findEventType: (eventTypeCode: string) => EventTypeConfiguration | undefined;
}

export function useEventTypeField(options?: UseEventTypeFieldOptions): UseEventTypeFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: matchingConfigurations,
    rows: eventTypeConfigurations,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<EventTypeConfiguration>({
    queryKey: getEventEngineManagementListEventTypeConfigurationsQueryKey(),
    fetchPage: fetchEventTypeConfigurationPage,
    pageSize,
    search: debouncedSearch,
    // The endpoint's `search` matches the configuration's own code/name, not
    // the event-type code this picker shows, so search stays client-side and
    // the shared hook keeps paging until a loaded row matches.
    serverSearch: false,
    filter: matchesEventType,
    getKey: configurationKey,
    enabled,
    source: "event-type-field",
  });

  const optionsAll = useMemo(() => toOptions(eventTypeConfigurations), [eventTypeConfigurations]);

  // Rows only grow when a page lands, so the row count marks page arrival.
  const pagesLoaded = eventTypeConfigurations.length;
  const prevPagesLoadedRef = useRef(0);
  const prevUniqueCountRef = useRef(0);
  useEffect(() => {
    const newPageArrived = pagesLoaded > prevPagesLoadedRef.current;
    if (
      newPageArrived &&
      hasNextPage &&
      !isFetchingNextPage &&
      optionsAll.length === prevUniqueCountRef.current
    ) {
      void fetchNextPage();
    }
    prevPagesLoadedRef.current = pagesLoaded;
    prevUniqueCountRef.current = optionsAll.length;
  }, [pagesLoaded, hasNextPage, isFetchingNextPage, optionsAll.length, fetchNextPage]);

  const optionsList = useMemo(() => toOptions(matchingConfigurations), [matchingConfigurations]);

  const findEventType = useCallback(
    (eventTypeCode: string): EventTypeConfiguration | undefined => {
      return eventTypeConfigurations.find(
        (c) => (c.eventTypeCode ?? c.eventType?.code) === eventTypeCode
      );
    },
    [eventTypeConfigurations]
  );

  return {
    options: optionsList,
    optionsAll,
    eventTypeConfigurations,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalLoaded: eventTypeConfigurations.length,
    totalAvailable,
    findEventType,
  };
}
