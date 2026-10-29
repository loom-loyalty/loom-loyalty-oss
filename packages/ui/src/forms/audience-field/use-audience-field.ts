import { useCallback, useMemo, useState } from "react";

import {
  customerAudienceManagementListCustomerAudiences,
  getCustomerAudienceManagementListCustomerAudiencesQueryKey,
  type CustomerAudience,
} from "@loom-loyalty/sdk";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

const fetchAudiencePage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  customerAudienceManagementListCustomerAudiences({ page, size, ...(search ? { search } : {}) });

const matchesAudience = (row: CustomerAudience, needle: string): boolean =>
  !needle ||
  (row.name?.toLowerCase() ?? "").includes(needle) ||
  (row.code?.toLowerCase() ?? "").includes(needle);

const audienceKey = (row: CustomerAudience) => row.customerAudienceId ?? row.code;

function toOption(audience: CustomerAudience): EntityOption | null {
  const id = audience.customerAudienceId ?? audience.code;
  return id != null ? { id, name: audience.name ?? id, secondaryText: audience.code } : null;
}

export interface UseAudienceFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UseAudienceFieldReturn {
  options: EntityOption[];
  /** All loaded audiences as EntityOptions, regardless of search. Use for trigger lookup. */
  optionsAll: EntityOption[];
  audiences: CustomerAudience[];
  /** Audiences after the debounced search filter. For consumers that build code-keyed options. */
  filteredAudiences: CustomerAudience[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  findAudience: (id: string) => CustomerAudience | undefined;
}

export function useAudienceField(options?: UseAudienceFieldOptions): UseAudienceFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: filteredAudiences,
    rows: audiences,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<CustomerAudience>({
    queryKey: getCustomerAudienceManagementListCustomerAudiencesQueryKey(),
    fetchPage: fetchAudiencePage,
    pageSize,
    search: debouncedSearch,
    filter: matchesAudience,
    getKey: audienceKey,
    enabled,
    source: "audience-field",
  });

  const optionsAll = useMemo<EntityOption[]>(
    () => audiences.map(toOption).filter((o): o is EntityOption => o !== null),
    [audiences]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredAudiences.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredAudiences]
  );

  const findAudience = useCallback(
    (id: string): CustomerAudience | undefined => {
      return audiences.find((a) => (a.customerAudienceId ?? a.code) === id);
    },
    [audiences]
  );

  return {
    options: optionsList,
    optionsAll,
    audiences,
    filteredAudiences,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalLoaded: audiences.length,
    totalAvailable,
    findAudience,
  };
}
