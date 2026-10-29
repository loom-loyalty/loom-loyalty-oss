/**
 * Data hooks behind the metadata sub-type fields: resolving a metadata type's
 * category, and loading the option lists the DATA_TYPE and LOCATION branches
 * need.
 */

import { useMemo } from "react";

import {
  getMetadataManagementListMetadataByTypeQueryKey,
  metadataManagementListMetadataByType,
  useMetadataManagementGetMetadataTypeByCode,
  type DataModelType,
  type Metadata,
  type MetadataTypeCategory,
} from "@loom-loyalty/sdk";

import { dataModelCodeKey } from "../../entity/features/data-models/code-key.js";
import { useAllPages } from "../../hooks/use-all-pages";
import { useAllDataModelTypes } from "../data-model-field/use-all-data-model-types";
import type { MetadataOption } from "../metadata-select-box";
import type { DataModelOption } from "./types";

const TYPE_STALE_TIME_MS = 10 * 60 * 1000;
const COUNTRY_TYPE_CODE = "COUNTRY";

export interface UseMetadataTypeCategoryReturn {
  /** Undefined until the type resolves, or when no type is selected. */
  category: MetadataTypeCategory | undefined;
  /** True while the type lookup is in flight. */
  isLoading: boolean;
  /** The type code does not exist, so its category can never resolve. */
  isTypeNotFound: boolean;
}

/**
 * Resolve a metadata type's category from its code.
 *
 * `Metadata` and its sub-types are a `oneOf` with no discriminator, so an
 * entry cannot say which category it belongs to. The type record can.
 */
export function useMetadataTypeCategory(typeCode: string): UseMetadataTypeCategoryReturn {
  const { data, isLoading, error } = useMetadataManagementGetMetadataTypeByCode(typeCode, {
    query: {
      enabled: !!typeCode,
      staleTime: TYPE_STALE_TIME_MS,
      retry: false,
    },
  });

  const isTypeNotFound =
    !!error && "status" in error && (error as { status: number }).status === 404;

  return {
    category: data?.data?.category,
    isLoading: !!typeCode && isLoading,
    isTypeNotFound,
  };
}

export interface UseMetadataSubTypeOptionsReturn {
  dataModelOptions: DataModelOption[];
  isLoadingDataModels: boolean;
  countryOptions: MetadataOption[];
  isLoadingCountries: boolean;
}

/**
 * Load the option lists the sub-type fields select from. Each query is gated
 * on the category that needs it, so a plain METADATA type fetches neither.
 */
export function useMetadataSubTypeOptions(
  typeCode: string,
  category: MetadataTypeCategory | undefined
): UseMetadataSubTypeOptionsReturn {
  const dataModelTypesQuery = useAllDataModelTypes(category === "DATA_TYPE");

  // About 250 countries: more than one page, so read them all.
  const countriesQuery = useAllPages<Metadata>({
    queryKey: getMetadataManagementListMetadataByTypeQueryKey(COUNTRY_TYPE_CODE),
    fetchPage: (page, size) =>
      metadataManagementListMetadataByType(COUNTRY_TYPE_CODE, { page, size }),
    enabled: category === "LOCATION",
    staleTime: TYPE_STALE_TIME_MS,
    source: "country-options",
  });

  const dataModelOptions = useMemo<DataModelOption[]>(
    () => filterDataModelTypeOptions(dataModelTypesQuery.items, typeCode),
    [dataModelTypesQuery.items, typeCode]
  );

  const countryOptions = useMemo<MetadataOption[]>(() => {
    return countriesQuery.items.map((country) => ({
      code: country.code,
      name: country.name,
      description: pickEnDescription(country.description),
    }));
  }, [countriesQuery.items]);

  return {
    dataModelOptions,
    isLoadingDataModels: category === "DATA_TYPE" && dataModelTypesQuery.isLoading,
    countryOptions,
    isLoadingCountries: category === "LOCATION" && countriesQuery.isLoading,
  };
}

/**
 * Narrow the data-model types to the family a DATA_TYPE metadata type names,
 * e.g. `RECEIPT_TYPE` keeps `RECEIPT` and anything parented to it. A type code
 * without the `_TYPE` suffix names no family, so the whole list is offered.
 */
export function filterDataModelTypeOptions(
  content: DataModelType[] | undefined,
  typeCode: string
): DataModelOption[] {
  if (!content) return [];

  const filter = typeCode.replace(/_TYPE$/, "");
  if (filter === typeCode) {
    return content.map(toDataModelOption);
  }

  // `filter` is derived from a MetadataType code (unvalidated, UPPER_SNAKE by
  // convention, e.g. "COUNTER_TARGET_TYPE" -> "COUNTER_TARGET"), but `t.code`
  // and `t.parentTypeReference` are DataModelType fields migrating to
  // lowercase-hyphenated resource codes. An exact `===` stopped matching once
  // the platform returns "counter-target" for what this filter still spells
  // "COUNTER_TARGET". Fold both sides so it matches either spelling.
  const filterKey = dataModelCodeKey(filter);
  return content
    .filter(
      (t) =>
        dataModelCodeKey(t.code) === filterKey ||
        dataModelCodeKey(t.parentTypeReference) === filterKey
    )
    .map(toDataModelOption);
}

function toDataModelOption(type: DataModelType): DataModelOption {
  return {
    code: type.code,
    name: type.name,
    description: pickEnDescription(type.description),
  };
}

function pickEnDescription(description: unknown): string | undefined {
  if (typeof description === "object" && description !== null) {
    return (description as Record<string, string>).en;
  }
  return undefined;
}
