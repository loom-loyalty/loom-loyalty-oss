/**
 * Hook for fetching and creating metadata options. CATEGORY-AWARE — the four
 * list endpoints (METADATA, DATA_TYPE, LOCATION, ITEM) are collapsed into a
 * single paginated useInfiniteQuery dispatching by the type's category.
 *
 * `useAllDataModelTypes` for the DATA_TYPE create-sheet
 * dropdown stays eager (size 100) — that dropdown is short and rarely opened.
 *
 * Default pageSize is 100 to match today's eager behavior. The wrapper
 * exposes pagination state so a future MetadataSelectBox upgrade can wire
 * scroll-to-load-more without a follow-up wrapper change.
 */

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  getMetadataManagementListDataTypesByTypeQueryKey,
  getMetadataManagementListItemsByTypeQueryKey,
  getMetadataManagementListLocationsByTypeQueryKey,
  getMetadataManagementListMetadataByTypeQueryKey,
  metadataManagementListDataTypesByType,
  metadataManagementListItemsByType,
  metadataManagementListLocationsByType,
  metadataManagementListMetadataByType,
  useMetadataManagementCreateDataType,
  useMetadataManagementCreateItem,
  useMetadataManagementCreateLocation,
  useMetadataManagementCreateMetadata,
  useMetadataManagementGetMetadataTypeByCode,
  type CreateDataType,
  type CreateItem,
  type CreateLocation,
  type CreateMetadata,
  type DataType,
  type Item,
  type Location,
  type Metadata,
  type MetadataTypeCategory,
} from "@loom-loyalty/sdk";

import {
  resetInfiniteQueryToFirstPage,
  warnIfMissingTotalPages,
} from "../../hooks/infinite-query-helpers";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useAllDataModelTypes } from "../data-model-field/use-all-data-model-types";
import type { MetadataOption, SuggestedOption } from "../metadata-select-box";
import { filterDataModelTypeOptions } from "../metadata-sub-type-fields/use-metadata-sub-type-data";
import { SUGGESTED_OPTIONS_MAP } from "./suggested-options";

type AnyMetadataEntity = Metadata | DataType | Location | Item;

type CreateMetadataPayload = Omit<CreateMetadata, "typeCode">;
type CreateDataTypePayload = Omit<CreateDataType, "typeCode">;
type CreateLocationPayload = Omit<CreateLocation, "typeCode">;
type CreateItemPayload = Omit<CreateItem, "typeCode">;

export type AnyCreatePayload =
  | CreateMetadataPayload
  | CreateDataTypePayload
  | CreateLocationPayload
  | CreateItemPayload;

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 100;

interface NormalizedPage {
  content: AnyMetadataEntity[];
  pageNumber: number;
  totalPages: number;
  totalSize: number;
}

export interface UseMetadataFieldOptions {
  pageSize?: number;
}

export interface UseMetadataFieldReturn {
  category: MetadataTypeCategory | undefined;
  isLoadingType: boolean;
  isTypeNotFound: boolean;
  metadataOptions: MetadataOption[];
  /** All loaded metadata options regardless of search; for trigger lookup. */
  metadataOptionsAll: MetadataOption[];
  suggestedOptions: SuggestedOption[];
  allOptions: (MetadataOption | SuggestedOption)[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  createMetadata: (data: AnyCreatePayload) => Promise<void>;
  isCreating: boolean;
  createError: Error | null;
  findOption: (code: string) => MetadataOption | SuggestedOption | undefined;
  dataModelTypeOptions: MetadataOption[];
  isLoadingDataModelTypes: boolean;
}

export function useMetadataField(
  typeCode: string,
  options?: UseMetadataFieldOptions
): UseMetadataFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    data: metadataTypeResponse,
    isLoading: isLoadingType,
    error: typeError,
  } = useMetadataManagementGetMetadataTypeByCode(typeCode, {
    query: {
      enabled: !!typeCode,
      staleTime: 10 * 60 * 1000,
      retry: false,
    },
  });

  const category = metadataTypeResponse?.data?.category;
  const isTypeNotFound =
    !!typeError && "status" in typeError && (typeError as { status: number }).status === 404;

  const queryKey = useMemo(() => {
    if (!category) return ["metadata-options", typeCode, "pending"] as const;
    const suffix = { mode: "infinite" as const, pageSize };
    switch (category) {
      case "METADATA":
        return [...getMetadataManagementListMetadataByTypeQueryKey(typeCode), suffix] as const;
      case "DATA_TYPE":
        return [...getMetadataManagementListDataTypesByTypeQueryKey(typeCode), suffix] as const;
      case "LOCATION":
        return [...getMetadataManagementListLocationsByTypeQueryKey(typeCode), suffix] as const;
      case "ITEM":
        return [...getMetadataManagementListItemsByTypeQueryKey(typeCode), suffix] as const;
      default:
        return ["metadata-options", typeCode, category, suffix] as const;
    }
  }, [typeCode, category, pageSize]);

  const {
    data: pagesData,
    isLoading: isLoadingList,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery<NormalizedPage>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const params = { page: pageParam as number, size: pageSize };
      const response = await dispatchListByCategory(typeCode, category, params);
      return normalizePage(response);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pageNumber + 1 < lastPage.totalPages ? lastPage.pageNumber + 1 : undefined,
    enabled: !!typeCode && !!category,
    staleTime: 5 * 60 * 1000,
  });

  const dataModelTypesQuery = useAllDataModelTypes(category === "DATA_TYPE");

  const dataModelTypeOptions = useMemo<MetadataOption[]>(
    () => filterDataModelTypeOptions(dataModelTypesQuery.items, typeCode),
    [dataModelTypesQuery.items, typeCode]
  );

  const createMetadataMutation = useMetadataManagementCreateMetadata({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(
          queryClient,
          getMetadataManagementListMetadataByTypeQueryKey(typeCode)
        );
      },
    },
  });

  const createDataTypeMutation = useMetadataManagementCreateDataType({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(
          queryClient,
          getMetadataManagementListDataTypesByTypeQueryKey(typeCode)
        );
      },
    },
  });

  const createLocationMutation = useMetadataManagementCreateLocation({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(
          queryClient,
          getMetadataManagementListLocationsByTypeQueryKey(typeCode)
        );
      },
    },
  });

  const createItemMutation = useMetadataManagementCreateItem({
    mutation: {
      onSuccess: () => {
        resetInfiniteQueryToFirstPage(
          queryClient,
          getMetadataManagementListItemsByTypeQueryKey(typeCode)
        );
      },
    },
  });

  const resetMetadataMutation = createMetadataMutation.reset;
  const resetDataTypeMutation = createDataTypeMutation.reset;
  const resetLocationMutation = createLocationMutation.reset;
  const resetItemMutation = createItemMutation.reset;
  useEffect(() => {
    if (category !== "METADATA") resetMetadataMutation();
    if (category !== "DATA_TYPE") resetDataTypeMutation();
    if (category !== "LOCATION") resetLocationMutation();
    if (category !== "ITEM") resetItemMutation();
  }, [
    category,
    resetMetadataMutation,
    resetDataTypeMutation,
    resetLocationMutation,
    resetItemMutation,
  ]);

  const allEntities = useMemo<AnyMetadataEntity[]>(() => {
    return pagesData?.pages.flatMap((page) => page.content) ?? [];
  }, [pagesData]);

  const totalAvailable = useMemo(() => {
    const pages = pagesData?.pages;
    if (!pages || pages.length === 0) return allEntities.length;
    return pages[pages.length - 1]?.totalSize ?? allEntities.length;
  }, [pagesData, allEntities.length]);

  const filteredEntities = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return allEntities;
    return allEntities.filter((entity) => {
      const name = entity.name?.toLowerCase() ?? "";
      const code = entity.code?.toLowerCase() ?? "";
      return name.includes(needle) || code.includes(needle);
    });
  }, [allEntities, debouncedSearch]);

  // The by-type list endpoints take no search param, so the filter above only
  // sees loaded pages. While it hides every loaded row, keep paging until one
  // matches or the list runs out, so "no results" is never premature. The page
  // count is load-bearing: hasNextPage/isFetchingNextPage read the same before
  // and after a fetch, so without it the chain can stall one page in.
  const loadedPageCount = pagesData?.pages.length ?? 0;
  const searchFoundNothing = allEntities.length > 0 && filteredEntities.length === 0;
  useEffect(() => {
    if (!searchFoundNothing || listError) return;
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [
    searchFoundNothing,
    listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    loadedPageCount,
  ]);

  const toMetadataOption = (entity: AnyMetadataEntity): MetadataOption => {
    const rawDescription = pickEnDescription(entity.description);
    const description =
      rawDescription && rawDescription.trim().toLowerCase() === entity.name.trim().toLowerCase()
        ? undefined
        : rawDescription;
    return { code: entity.code, name: entity.name, description };
  };

  const metadataOptionsAll = useMemo<MetadataOption[]>(
    () => allEntities.map(toMetadataOption),
    [allEntities]
  );

  const metadataOptions = useMemo<MetadataOption[]>(
    () => filteredEntities.map(toMetadataOption),
    [filteredEntities]
  );

  // Dedupe suggestions against the UNFILTERED set so a search that matches
  // nothing doesn't suddenly resurrect raw suggestions whose canonical entries
  // already exist on the platform.
  const suggestedOptions = useMemo<SuggestedOption[]>(() => {
    const raw = SUGGESTED_OPTIONS_MAP[typeCode] ?? [];
    if (metadataOptionsAll.length === 0) return raw;
    const existingNames = new Set(metadataOptionsAll.map((o) => o.name.trim().toLowerCase()));
    return raw.filter((s) => !existingNames.has(s.name.trim().toLowerCase()));
  }, [typeCode, metadataOptionsAll]);

  const allOptions = useMemo(() => {
    const existingCodes = new Set(metadataOptionsAll.map((o) => o.code));
    const newSuggested = suggestedOptions.filter((s) => !existingCodes.has(s.code));
    return [...metadataOptions, ...newSuggested];
  }, [metadataOptions, metadataOptionsAll, suggestedOptions]);

  const createMetadata = async (data: AnyCreatePayload) => {
    if (!category) {
      if (isTypeNotFound) {
        throw new Error(`Cannot create metadata for "${typeCode}": metadata type not found (404)`);
      }
      throw new Error(`Cannot create metadata for "${typeCode}": metadata type is still loading`);
    }

    const payload = { ...data, typeCode };

    switch (category) {
      case "METADATA":
        await createMetadataMutation.mutateAsync({ data: payload as CreateMetadata });
        break;
      case "DATA_TYPE":
        await createDataTypeMutation.mutateAsync({ data: payload as CreateDataType });
        break;
      case "LOCATION":
        await createLocationMutation.mutateAsync({ data: payload as CreateLocation });
        break;
      case "ITEM":
        await createItemMutation.mutateAsync({ data: payload as CreateItem });
        break;
    }
  };

  const findOption = (code: string): MetadataOption | SuggestedOption | undefined => {
    return (
      metadataOptionsAll.find((o) => o.code === code) ??
      suggestedOptions.find((o) => o.code === code)
    );
  };

  const isLoading = isLoadingType || (!!category && isLoadingList);
  const error = (typeError ?? listError ?? dataModelTypesQuery.error ?? null) as Error | null;
  const isCreating =
    createMetadataMutation.isPending ||
    createDataTypeMutation.isPending ||
    createLocationMutation.isPending ||
    createItemMutation.isPending;

  const createError = useMemo(() => {
    switch (category) {
      case "METADATA":
        return createMetadataMutation.error;
      case "DATA_TYPE":
        return createDataTypeMutation.error;
      case "LOCATION":
        return createLocationMutation.error;
      case "ITEM":
        return createItemMutation.error;
      default:
        return null;
    }
  }, [
    category,
    createMetadataMutation.error,
    createDataTypeMutation.error,
    createLocationMutation.error,
    createItemMutation.error,
  ]) as Error | null;

  return {
    category,
    isLoadingType,
    isTypeNotFound,
    metadataOptions,
    metadataOptionsAll,
    suggestedOptions,
    allOptions,
    isLoading,
    error,
    searchValue,
    setSearchValue,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      if (!hasNextPage || isFetchingNextPage) return;
      void fetchNextPage();
    },
    totalLoaded: allEntities.length,
    totalAvailable,
    createMetadata,
    isCreating,
    createError,
    findOption,
    dataModelTypeOptions,
    isLoadingDataModelTypes: dataModelTypesQuery.isLoading,
  };
}

async function dispatchListByCategory(
  typeCode: string,
  category: MetadataTypeCategory | undefined,
  params: { page: number; size: number }
): Promise<{ data: unknown }> {
  if (!category) {
    return { data: { content: [], pageNumber: 0, totalPages: 0, totalSize: 0 } };
  }
  switch (category) {
    case "METADATA":
      return metadataManagementListMetadataByType(typeCode, params);
    case "DATA_TYPE":
      return metadataManagementListDataTypesByType(typeCode, params);
    case "LOCATION":
      return metadataManagementListLocationsByType(typeCode, params);
    case "ITEM":
      return metadataManagementListItemsByType(typeCode, params);
  }
}

function normalizePage(response: { data: unknown }): NormalizedPage {
  const data = response.data;
  if (Array.isArray(data)) {
    return {
      content: data as AnyMetadataEntity[],
      pageNumber: 0,
      totalPages: 1,
      totalSize: data.length,
    };
  }
  const paged = data as
    | {
        content?: AnyMetadataEntity[];
        pageNumber?: number;
        totalPages?: number;
        totalSize?: number;
      }
    | undefined;
  warnIfMissingTotalPages(paged, "metadata-field");
  return {
    content: paged?.content ?? [],
    pageNumber: paged?.pageNumber ?? 0,
    totalPages: paged?.totalPages ?? 0,
    totalSize: paged?.totalSize ?? 0,
  };
}

function pickEnDescription(description: unknown): string | undefined {
  if (typeof description === "object" && description !== null) {
    return (description as Record<string, string>).en;
  }
  return undefined;
}
