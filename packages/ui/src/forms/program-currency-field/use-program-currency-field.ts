/**
 * Hook for fetching program currencies. Server-paginated; a debounced search
 * term goes to the list endpoint's `search` param (name/code). The
 * `programId` filter applies client-side so currencies without programIds
 * stay available to every program; when it hides every loaded row, the
 * shared list hook keeps paging until a match appears or the list ends.
 */

import { useCallback, useMemo, useState } from "react";

import {
  getProgramBankManagementListProgramCurrenciesQueryKey,
  programBankManagementListProgramCurrencies,
  type ProgramCurrency,
} from "@loom-loyalty/sdk";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

const fetchCurrencyPage = ({ page, size, search }: SearchableInfiniteFetchParams) =>
  programBankManagementListProgramCurrencies({ page, size, ...(search ? { search } : {}) });

const currencyKey = (currency: ProgramCurrency) => currency.programCurrencyId ?? currency.code;

export interface UseProgramCurrencyFieldOptions {
  pageSize?: number;
}

export interface UseProgramCurrencyFieldReturn {
  options: EntityOption[];
  /** All loaded currencies (after programId filter, before search) as EntityOptions. Use for trigger lookup. */
  optionsAll: EntityOption[];
  currencies: ProgramCurrency[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  findCurrency: (code: string) => ProgramCurrency | undefined;
}

export function useProgramCurrencyField(
  programId?: string,
  options?: UseProgramCurrencyFieldOptions
): UseProgramCurrencyFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  // programId scoping stays client-side: currencies with undefined programIds
  // are a permissive fallback (they may belong to any program), which the
  // endpoint's `programId` filter would drop.
  const matchesCurrency = useCallback(
    (currency: ProgramCurrency, needle: string): boolean => {
      if (programId && currency.programIds && !currency.programIds.includes(programId)) {
        return false;
      }
      return (
        !needle ||
        (currency.name?.toLowerCase() ?? "").includes(needle) ||
        (currency.code?.toLowerCase() ?? "").includes(needle)
      );
    },
    [programId]
  );

  const {
    visibleRows: filteredCurrencies,
    rows: allCurrencies,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalAvailable,
  } = useSearchableInfiniteList<ProgramCurrency>({
    queryKey: getProgramBankManagementListProgramCurrenciesQueryKey(),
    fetchPage: fetchCurrencyPage,
    pageSize,
    search: debouncedSearch,
    scope: { programId: programId ?? null },
    filter: matchesCurrency,
    getKey: currencyKey,
    source: "program-currency-field",
  });

  const currencies = useMemo<ProgramCurrency[]>(
    () => allCurrencies.filter((currency) => matchesCurrency(currency, "")),
    [allCurrencies, matchesCurrency]
  );

  const toOption = (currency: ProgramCurrency): EntityOption | null =>
    currency.code != null
      ? { id: currency.code, name: currency.name, secondaryText: currency.code }
      : null;

  const optionsAll = useMemo<EntityOption[]>(
    () => currencies.map(toOption).filter((o): o is EntityOption => o !== null),
    [currencies]
  );

  const optionsList = useMemo<EntityOption[]>(
    () => filteredCurrencies.map(toOption).filter((o): o is EntityOption => o !== null),
    [filteredCurrencies]
  );

  const findCurrency = useCallback(
    (code: string): ProgramCurrency | undefined => {
      return currencies.find((c) => c.code === code);
    },
    [currencies]
  );

  return {
    options: optionsList,
    optionsAll,
    currencies,
    isLoading,
    error: listError,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalLoaded: currencies.length,
    totalAvailable,
    findCurrency,
  };
}
