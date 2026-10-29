// Server-paginated wrapper for customer-audiences; the 250ms-debounced search goes to the API.

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

export interface UseCustomerAudienceFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UseCustomerAudienceFieldReturn {
  options: EntityOption[];
  /** All loaded audiences as EntityOptions; stable across search changes. */
  optionsAll: EntityOption[];
  /** Raw loaded audiences; exposed for tests + display-mode consumers. */
  audiences: CustomerAudience[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Resolve an audience by id or code; for display-mode rendering. */
  findCustomerAudience: (id: string) => CustomerAudience | undefined;
}

export function useCustomerAudienceField(
  options?: UseCustomerAudienceFieldOptions
): UseCustomerAudienceFieldReturn {
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
  } = useSearchableInfiniteList<CustomerAudience>({
    queryKey: getCustomerAudienceManagementListCustomerAudiencesQueryKey(),
    fetchPage: fetchAudiencePage,
    pageSize,
    search: debouncedSearch,
    filter: matchesAudience,
    getKey: audienceKey,
    enabled,
    source: "customer-audience-field",
  });

  const optionsAll = useMemo<EntityOption[]>(
    () => audiences.map(toOption).filter((o): o is EntityOption => o !== null),
    [audiences]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredAudiences.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredAudiences]
  );

  const findCustomerAudience = useCallback(
    (id: string): CustomerAudience | undefined => {
      return audiences.find((a) => (a.customerAudienceId ?? a.code) === id);
    },
    [audiences]
  );

  return {
    options: optionsList,
    optionsAll,
    audiences,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    findCustomerAudience,
  };
}
