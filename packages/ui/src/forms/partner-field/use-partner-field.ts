/**
 * Hook for fetching and creating partners. Server-paginated; a debounced
 * search term goes to the list endpoint's `search` param (name/code).
 */

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  getProgramManagementListPartnersQueryKey,
  programManagementListPartners,
  useProgramManagementCreatePartner,
  type CreatePartner,
  type Partner,
} from "@loom-loyalty/sdk";

import { resetInfiniteQueryToFirstPage } from "../../hooks/infinite-query-helpers";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

const fetchPartnerPage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  programManagementListPartners({ page, size, ...(search ? { search } : {}) });

const matchesPartner = (partner: Partner, needle: string): boolean =>
  !needle ||
  (partner.name?.toLowerCase() ?? "").includes(needle) ||
  (partner.code?.toLowerCase() ?? "").includes(needle);

const partnerKey = (partner: Partner) => partner.partnerId;

export interface UsePartnerFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UsePartnerFieldReturn {
  options: EntityOption[];
  /** All loaded partners as EntityOptions, regardless of search. Use for badge/trigger lookup. */
  optionsAll: EntityOption[];
  partners: Partner[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  createPartner: (data: CreatePartner) => Promise<Partner>;
  isCreating: boolean;
  createError: Error | null;
  findPartner: (id: string) => Partner | undefined;
}

export function usePartnerField(options?: UsePartnerFieldOptions): UsePartnerFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: filteredPartners,
    rows: partners,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<Partner>({
    queryKey: getProgramManagementListPartnersQueryKey(),
    fetchPage: fetchPartnerPage,
    pageSize,
    search: debouncedSearch,
    filter: matchesPartner,
    getKey: partnerKey,
    enabled,
    source: "partner-field",
  });

  const createMutation = useProgramManagementCreatePartner({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(queryClient, getProgramManagementListPartnersQueryKey());
      },
    },
  });

  const toOption = (partner: Partner): EntityOption | null =>
    partner.partnerId != null
      ? { id: partner.partnerId, name: partner.name, secondaryText: partner.code }
      : null;

  const optionsAll = useMemo<EntityOption[]>(
    () => partners.map(toOption).filter((o): o is EntityOption => o !== null),
    [partners]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredPartners.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredPartners]
  );

  const createPartner = async (input: CreatePartner): Promise<Partner> => {
    const response = await createMutation.mutateAsync({ data: input });
    return response.data as Partner;
  };

  const findPartner = (id: string): Partner | undefined => {
    return partners.find((p) => p.partnerId === id);
  };

  return {
    options: optionsList,
    optionsAll,
    partners,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalLoaded: partners.length,
    totalAvailable,
    createPartner,
    isCreating: createMutation.isPending,
    createError: (createMutation.error ?? null) as Error | null,
    findPartner,
  };
}
