/**
 * Hook for fetching metadata types. Server-paginated; the debounced search
 * term and `category` go to the list endpoint (`search`, `category`).
 * `childOf` reads that type's complete children list instead. Metadata expressions
 * reference types by code, so option.id is the type code.
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import {
  getMetadataManagementListMetadataTypesQueryKey,
  metadataManagementListMetadataTypes,
  type MetadataType,
  type MetadataTypeCategory,
} from "@loom-loyalty/sdk";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useSearchableInfiniteList } from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";
import { metadataTypeChildrenQueryOptions } from "./metadata-type-children-query";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;
const NO_TYPES: MetadataType[] = [];

const metadataTypeKey = (mt: MetadataType) => mt.code;

export interface UseMetadataTypeFieldOptions {
  pageSize?: number;
  enabled?: boolean;
  /** Only offer types of this category (e.g. LOCATION). Sent to the server as `category`. */
  category?: MetadataTypeCategory;
  /**
   * Only offer the types allowed directly below this type code. The options then
   * come from that type's children, not from the paged type list.
   */
  childOf?: string;
  /** Type codes to leave out (e.g. the type itself, or types already linked). */
  excludeCodes?: readonly string[];
}

export interface UseMetadataTypeFieldReturn {
  options: EntityOption[];
  /** All loaded metadata types as EntityOptions, regardless of search. Use for trigger lookup. */
  optionsAll: EntityOption[];
  metadataTypes: MetadataType[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  findMetadataType: (code: string) => MetadataType | undefined;
}

export function useMetadataTypeField(
  options?: UseMetadataTypeFieldOptions
): UseMetadataTypeFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;
  const category = options?.category;
  const childOf = options?.childOf || undefined;
  const excludeCodes = options?.excludeCodes;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  // Keyed by content so a fresh array literal each render keeps the filter stable.
  const excludeKey = JSON.stringify(excludeCodes ?? []);
  const excluded = useMemo(() => new Set<string>(JSON.parse(excludeKey) as string[]), [excludeKey]);
  const matchesType = useCallback(
    (mt: MetadataType, needle: string): boolean => {
      if (category && mt.category !== category) return false;
      if (mt.code != null && excluded.has(mt.code)) return false;
      return (
        !needle ||
        (mt.name?.toLowerCase() ?? "").includes(needle) ||
        (mt.code?.toLowerCase() ?? "").includes(needle)
      );
    },
    [category, excluded]
  );

  const {
    visibleRows: pagedMatches,
    rows: metadataTypes,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<MetadataType>({
    queryKey: getMetadataManagementListMetadataTypesQueryKey(),
    fetchPage: ({ page, size, search }) =>
      metadataManagementListMetadataTypes({
        page,
        size,
        ...(category ? { category } : {}),
        ...(search ? { search } : {}),
      }),
    pageSize,
    search: debouncedSearch,
    ...(category ? { scope: { category } } : {}),
    filter: matchesType,
    getKey: metadataTypeKey,
    enabled: enabled && !childOf,
    source: "metadata-type-field",
  });

  const childQuery = useQuery({
    ...metadataTypeChildrenQueryOptions(childOf ?? ""),
    enabled: enabled && !!childOf,
  });

  const sourceTypes = childOf ? (childQuery.data ?? NO_TYPES) : metadataTypes;

  const scopedTypes = useMemo<MetadataType[]>(
    () => sourceTypes.filter((mt) => matchesType(mt, "")),
    [sourceTypes, matchesType]
  );

  const filtered = useMemo(() => {
    if (!childOf) return pagedMatches;
    const needle = debouncedSearch.trim().toLowerCase();
    return scopedTypes.filter((mt) => matchesType(mt, needle));
  }, [childOf, pagedMatches, scopedTypes, matchesType, debouncedSearch]);

  const toOption = (mt: MetadataType): EntityOption | null =>
    mt.code != null ? { id: mt.code, name: mt.name, secondaryText: mt.code } : null;

  const optionsAll = useMemo<EntityOption[]>(
    () => scopedTypes.map(toOption).filter((o): o is EntityOption => o !== null),
    [scopedTypes]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filtered.map(toOption).filter((o): o is EntityOption => o !== null),
    [filtered]
  );

  const findMetadataType = useCallback(
    (code: string): MetadataType | undefined => {
      return sourceTypes.find((mt) => mt.code === code);
    },
    [sourceTypes]
  );

  return {
    options: optionsList,
    optionsAll,
    metadataTypes: sourceTypes,
    isLoading: childOf ? childQuery.isLoading : isLoading,
    error: ((childOf ? childQuery.error : listError) ?? null) as Error | null,
    searchValue,
    setSearchValue,
    hasNextPage: !childOf && hasNextPage,
    isFetchingNextPage: !childOf && isFetchingNextPage,
    fetchNextPage,
    totalLoaded: sourceTypes.length,
    totalAvailable: childOf ? sourceTypes.length : totalAvailable,
    findMetadataType,
  };
}
