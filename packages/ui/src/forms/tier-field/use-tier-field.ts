// Tier list+create hook. Defaults options to tierId (FK target) with code fallback; idField="code" opts into legacy tierCode binding.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import {
  customerStatusManagementListTiers,
  getCustomerStatusManagementListTiersQueryKey,
  useCustomerStatusManagementCreateTier,
  type CreateTier,
  type Tier,
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

const fetchTierPage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  customerStatusManagementListTiers({ page, size, ...(search ? { search } : {}) });

const matchesTier = (tier: Tier, needle: string): boolean =>
  !needle ||
  (tier.name?.toLowerCase() ?? "").includes(needle) ||
  (tier.code?.toLowerCase() ?? "").includes(needle);

const tierKey = (tier: Tier) => tier.tierId ?? tier.code;

export type TierIdField = "tierId" | "code";

export interface UseTierFieldOptions {
  pageSize?: number;
  enabled?: boolean;
  /** Which tier identifier the consumer binds to. Defaults to `tierId`. */
  idField?: TierIdField;
  /** Identifiers to hide from the dropdown (e.g. self-exclusion when editing). */
  excludeIds?: readonly string[];
}

export interface UseTierFieldReturn {
  options: EntityOption[];
  /** All loaded tiers as EntityOptions, regardless of search. Use for trigger lookup. */
  optionsAll: EntityOption[];
  tiers: Tier[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  createTier: (data: CreateTier) => Promise<Tier>;
  isCreating: boolean;
  createError: Error | null;
  findTier: (id: string) => Tier | undefined;
}

export function useTierField(options?: UseTierFieldOptions): UseTierFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;
  const idField: TierIdField = options?.idField ?? "tierId";
  const excludeIds = options?.excludeIds;

  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: filteredTiers,
    rows: tiers,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<Tier>({
    queryKey: getCustomerStatusManagementListTiersQueryKey(),
    fetchPage: fetchTierPage,
    pageSize,
    search: debouncedSearch,
    filter: matchesTier,
    getKey: tierKey,
    enabled,
    source: "tier-field",
  });

  const createMutation = useCustomerStatusManagementCreateTier({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(queryClient, getCustomerStatusManagementListTiersQueryKey());
      },
    },
  });

  const toOption = useCallback(
    (tier: Tier): EntityOption | null => {
      const id = idField === "code" ? tier.code : (tier.tierId ?? tier.code);
      if (id == null) return null;
      return { id, name: tier.name, secondaryText: tier.code };
    },
    [idField]
  );

  const excludeSet = useMemo(
    () => (excludeIds && excludeIds.length > 0 ? new Set(excludeIds) : null),
    [excludeIds]
  );

  const optionsAll = useMemo<EntityOption[]>(
    () =>
      tiers
        .map(toOption)
        .filter((o): o is EntityOption => o !== null)
        .filter((o) => !excludeSet || !excludeSet.has(o.id)),
    [tiers, toOption, excludeSet]
  );

  const optionsList = useMemo<EntityOption[]>(
    () =>
      filteredTiers
        .map(toOption)
        .filter((o): o is EntityOption => o !== null)
        .filter((o) => !excludeSet || !excludeSet.has(o.id)),
    [filteredTiers, toOption, excludeSet]
  );

  const createTier = useCallback(
    async (input: CreateTier): Promise<Tier> => {
      const response = await createMutation.mutateAsync({ data: input });
      return response.data as Tier;
    },
    [createMutation]
  );

  const findTier = useCallback(
    (id: string): Tier | undefined => {
      if (idField === "code") return tiers.find((t) => t.code === id);
      return tiers.find((t) => (t.tierId ?? t.code) === id);
    },
    [tiers, idField]
  );

  return {
    options: optionsList,
    optionsAll,
    tiers,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalLoaded: tiers.length,
    totalAvailable,
    createTier,
    isCreating: createMutation.isPending,
    createError: (createMutation.error ?? null) as Error | null,
    findTier,
  };
}
