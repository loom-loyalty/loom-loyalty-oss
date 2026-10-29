/**
 * Hook for fetching and creating targets. Server-paginated; a debounced search
 * term goes to the list endpoint's `search` param (name/code). Targets are polymorphic
 * (CompletionTarget, CounterTarget, etc.) — the union type
 * `PagedTargetDataContentItem` flows through.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import {
  eventEngineManagementListTargets,
  getEventEngineManagementListTargetsQueryKey,
  useEventEngineManagementCreateTarget,
  type CreateTarget,
  type PagedTargetDataContentItem,
  type ResponseTargetData,
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

const fetchTargetPage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  eventEngineManagementListTargets({ page, size, ...(search ? { search } : {}) });

const matchesTarget = (target: PagedTargetDataContentItem, needle: string): boolean =>
  !needle ||
  (target.name?.toLowerCase() ?? "").includes(needle) ||
  (target.code?.toLowerCase() ?? "").includes(needle);

const targetKey = (target: PagedTargetDataContentItem) => target.targetId ?? target.code;

export interface UseTargetFieldOptions {
  pageSize?: number;
  enabled?: boolean;
  /**
   * Auto-advance through every page until the full target list is loaded. Set for
   * consumers that need every target up front, not just the first page. Gate
   * list-dependent work on the returned `isLoadingAll`. Off by default — the
   * picker lazy-loads on scroll.
   */
  loadAll?: boolean;
}

export interface UseTargetFieldReturn {
  options: EntityOption[];
  /** All loaded targets as EntityOptions, regardless of search. Use for trigger lookup. */
  optionsAll: EntityOption[];
  targets: PagedTargetDataContentItem[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** True while `loadAll` is still paging through the remaining targets. */
  isLoadingAll: boolean;
  /** True when `loadAll` stopped on an error before every target was fetched. */
  hasLoadAllError: boolean;
  totalLoaded: number;
  totalAvailable: number;
  createTarget: (data: CreateTarget) => Promise<ResponseTargetData>;
  isCreating: boolean;
  createError: Error | null;
  findTarget: (id: string) => PagedTargetDataContentItem | undefined;
}

export function useTargetField(options?: UseTargetFieldOptions): UseTargetFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;
  const loadAll = options?.loadAll ?? false;

  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    visibleRows: filteredTargets,
    rows: targets,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
    isLoadingAll,
  } = useSearchableInfiniteList<PagedTargetDataContentItem>({
    queryKey: getEventEngineManagementListTargetsQueryKey(),
    fetchPage: fetchTargetPage,
    pageSize,
    search: debouncedSearch,
    filter: matchesTarget,
    getKey: targetKey,
    enabled,
    loadAll,
    source: "target-field",
  });
  const hasLoadAllError = enabled && loadAll && !!listError && hasNextPage;

  const createMutation = useEventEngineManagementCreateTarget({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(queryClient, getEventEngineManagementListTargetsQueryKey());
      },
    },
  });

  const toOption = (target: PagedTargetDataContentItem): EntityOption | null => {
    const id = target.targetId ?? target.code;
    return id != null ? { id, name: target.name, secondaryText: target.code } : null;
  };

  const optionsAll = useMemo<EntityOption[]>(
    () => targets.map(toOption).filter((o): o is EntityOption => o !== null),
    [targets]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredTargets.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredTargets]
  );

  const createTarget = useCallback(
    async (input: CreateTarget): Promise<ResponseTargetData> => {
      const response = await createMutation.mutateAsync({ data: input });
      return response.data as ResponseTargetData;
    },
    [createMutation]
  );

  const findTarget = useCallback(
    (id: string): PagedTargetDataContentItem | undefined => {
      return targets.find((t) => (t.targetId ?? t.code) === id);
    },
    [targets]
  );

  return {
    options: optionsList,
    optionsAll,
    targets,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoadingAll,
    hasLoadAllError,
    totalLoaded: targets.length,
    totalAvailable,
    createTarget,
    isCreating: createMutation.isPending,
    createError: (createMutation.error ?? null) as Error | null,
    findTarget,
  };
}
