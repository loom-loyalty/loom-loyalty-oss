/**
 * Every DataModelType in the environment, read page by page.
 *
 * `/data-model-types` has no server-side search, and resolving a type family
 * (`COFFEELOYALTY_PURCHASE → CUSTOMEVENT → EVENT`) needs every intermediate
 * row, so pickers read the whole set and filter it client-side.
 */

import {
  dataModelManagementListDataModelTypes,
  getDataModelManagementListDataModelTypesQueryKey,
  type DataModelType,
} from "@loom-loyalty/sdk";

import { useAllPages, type UseAllPagesResult } from "../../hooks/use-all-pages";

/** Data-model types change rarely; a picker does not need them fresh per mount. */
const DATA_MODEL_TYPES_STALE_MS = 10 * 60 * 1000;

export function useAllDataModelTypes(enabled = true): UseAllPagesResult<DataModelType> {
  return useAllPages<DataModelType>({
    queryKey: getDataModelManagementListDataModelTypesQueryKey(),
    fetchPage: (page, size) => dataModelManagementListDataModelTypes({ page, size }),
    enabled,
    staleTime: DATA_MODEL_TYPES_STALE_MS,
    source: "data-model-types",
  });
}
