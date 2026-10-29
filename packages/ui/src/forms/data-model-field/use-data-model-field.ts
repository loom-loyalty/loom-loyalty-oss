/**
 * Hook for selecting an EXISTING DataModelType from a type family (e.g. every
 * event-shaped schema under `EVENT`). Output is `MetadataOption`-shaped so it
 * drops straight into `MetadataSelectBox` or a plain `Select`.
 *
 * `/data-model-types` supports no server-side search, and family membership
 * needs the whole set anyway: resolving `COFFEELOYALTY_PURCHASE → CUSTOMEVENT
 * → EVENT` requires the intermediate row to be present. So every page of the
 * list is read once and both the ancestor walk and search run client-side.
 */

import type { DataModelType } from "@loom-loyalty/sdk";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import type { MetadataOption } from "../metadata-select-box";
import { filterTypesInFamily } from "./type-family";
import { useAllDataModelTypes } from "./use-all-data-model-types";

const SEARCH_DEBOUNCE_MS = 250;

export interface UseDataModelFieldReturn {
  /** Family members matching the current search. */
  dataModelOptions: MetadataOption[];
  /** All family members regardless of search; for trigger/selection lookup. */
  dataModelOptionsAll: MetadataOption[];
  isLoadingDataModelOptions: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
}

export function useDataModelField(rootTypeCode: string): UseDataModelFieldReturn {
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const query = useAllDataModelTypes(!!rootTypeCode);
  const allTypes: DataModelType[] = query.items;

  const { types: familyTypes, unresolvedParentRefs } = useMemo(
    () => filterTypesInFamily(allTypes, rootTypeCode),
    [allTypes, rootTypeCode]
  );

  // A parent reference pointing at a type the API didn't return breaks the
  // ancestor chain — legitimate nested types then silently vanish from the
  // dropdown, which looks identical to having none. Warn unconditionally (large
  // orgs only exist in production), once per mount so refetches don't spam.
  // Wait for every page first: a parent on a later page is not missing.
  const unresolvedWarnedRef = useRef(false);
  useEffect(() => {
    if (query.isLoading) return;
    if (unresolvedParentRefs.length > 0 && !unresolvedWarnedRef.current) {
      unresolvedWarnedRef.current = true;
      console.warn(
        `[data-model-field] unresolved parentTypeReference values while resolving the "${rootTypeCode}" family:`,
        unresolvedParentRefs
      );
    }
  }, [query.isLoading, rootTypeCode, unresolvedParentRefs]);

  const dataModelOptionsAll = useMemo<MetadataOption[]>(
    () => familyTypes.map(toMetadataOption),
    [familyTypes]
  );

  const dataModelOptions = useMemo<MetadataOption[]>(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return dataModelOptionsAll;
    return dataModelOptionsAll.filter(
      (option) =>
        option.name.toLowerCase().includes(needle) || option.code.toLowerCase().includes(needle)
    );
  }, [dataModelOptionsAll, debouncedSearch]);

  return {
    dataModelOptions,
    dataModelOptionsAll,
    isLoadingDataModelOptions: query.isLoading,
    error: query.error,
    searchValue,
    setSearchValue,
  };
}

function toMetadataOption(type: DataModelType): MetadataOption {
  const raw = type.description?.en;
  const description =
    raw && raw.trim().toLowerCase() === type.name.trim().toLowerCase() ? undefined : raw;
  return { code: type.code, name: type.name, description };
}
