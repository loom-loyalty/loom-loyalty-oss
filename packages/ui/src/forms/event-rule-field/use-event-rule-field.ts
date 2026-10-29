/**
 * Hook for fetching event rules. Server-paginated; a debounced search term
 * goes to the list endpoint's `search` param (name/code). The endpoint
 * accepts date and category filters too, but this wrapper only consumes
 * page+size+search — date filtering belongs in caller-specific hooks if ever
 * needed.
 */

import { useCallback, useMemo, useState } from "react";

import {
  eventEngineManagementListEventRules,
  getEventEngineManagementListEventRulesQueryKey,
  type EventRule,
} from "@loom-loyalty/sdk";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

const fetchEventRulePage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  eventEngineManagementListEventRules({ page, size, ...(search ? { search } : {}) });

const matchesEventRule = (row: EventRule, needle: string): boolean =>
  !needle ||
  (row.name?.toLowerCase() ?? "").includes(needle) ||
  (row.code?.toLowerCase() ?? "").includes(needle);

const eventRuleKey = (row: EventRule) => row.eventRuleId ?? row.code;

export interface UseEventRuleFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UseEventRuleFieldReturn {
  options: EntityOption[];
  /** All loaded event rules as EntityOptions, regardless of search. Use for trigger lookup. */
  optionsAll: EntityOption[];
  eventRules: EventRule[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  findEventRule: (id: string) => EventRule | undefined;
}

export function useEventRuleField(options?: UseEventRuleFieldOptions): UseEventRuleFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: filteredRules,
    rows: eventRules,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<EventRule>({
    queryKey: getEventEngineManagementListEventRulesQueryKey(),
    fetchPage: fetchEventRulePage,
    pageSize,
    search: debouncedSearch,
    filter: matchesEventRule,
    getKey: eventRuleKey,
    enabled,
    source: "event-rule-field",
  });

  const toOption = (rule: EventRule): EntityOption | null => {
    const id = rule.eventRuleId ?? rule.code;
    return id != null ? { id, name: rule.name, secondaryText: rule.code } : null;
  };

  const optionsAll = useMemo<EntityOption[]>(
    () => eventRules.map(toOption).filter((o): o is EntityOption => o !== null),
    [eventRules]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredRules.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredRules]
  );

  const findEventRule = useCallback(
    (id: string): EventRule | undefined => {
      return eventRules.find((r) => (r.eventRuleId ?? r.code) === id);
    },
    [eventRules]
  );

  return {
    options: optionsList,
    optionsAll,
    eventRules,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalLoaded: eventRules.length,
    totalAvailable,
    findEventRule,
  };
}
