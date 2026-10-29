/**
 * Hook for fetching offers. Server-paginated WITH a server-side `name`
 * filter — the offer list endpoint is the only one that accepts it
 * (verified against `OfferManagementListOffersParams`). Search input is
 * debounced 250ms before flowing into the query key + ?name= param.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import {
  getOfferManagementListOffersQueryKey,
  offerManagementListOffers,
  type Offer,
  type PagedOfferData,
} from "@loom-loyalty/sdk";

import { getInfiniteNextPageParam } from "../../hooks/infinite-query-helpers";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import type { EntityOption } from "../entity-select-box";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;
// Trimmed from the 5-min default so orphaned search-variant cache entries
// don't accumulate while typing. 2 min still survives typical form-fill
// durations after the user picks an offer and closes the dropdown.
const GC_TIME_MS = 2 * 60 * 1000;

export interface UseOfferFieldOptions {
  pageSize?: number;
  enabled?: boolean;
}

export interface UseOfferFieldReturn {
  options: EntityOption[];
  /** Same as `options` for offer-field (server-driven filter); kept for API parity. */
  optionsAll: EntityOption[];
  offers: Offer[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalLoaded: number;
  totalAvailable: number;
  findOffer: (id: string) => Offer | undefined;
}

export function useOfferField(options?: UseOfferFieldOptions): UseOfferFieldReturn {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);
  const trimmedSearch = debouncedSearch.trim();

  const {
    data,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      ...getOfferManagementListOffersQueryKey(),
      { mode: "infinite" as const, pageSize, name: trimmedSearch || null },
    ] as const,
    queryFn: ({ pageParam }) =>
      offerManagementListOffers({
        page: pageParam as number,
        size: pageSize,
        ...(trimmedSearch ? { name: trimmedSearch } : {}),
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getInfiniteNextPageParam(lastPage as { data: PagedOfferData | Offer[] }, "offer-field"),
    staleTime: 5 * 60 * 1000,
    gcTime: GC_TIME_MS,
    enabled,
  });

  const offers = useMemo<Offer[]>(() => {
    return (
      data?.pages.flatMap((page) => {
        const payload = (page as { data: PagedOfferData | Offer[] }).data;
        if (Array.isArray(payload)) return payload;
        return payload?.content ?? [];
      }) ?? []
    );
  }, [data]);

  const totalAvailable = useMemo(() => {
    const pages = data?.pages;
    if (!pages || pages.length === 0) return offers.length;
    const last = pages[pages.length - 1] as { data: PagedOfferData | Offer[] };
    if (Array.isArray(last.data)) return offers.length;
    return last.data?.totalSize ?? offers.length;
  }, [data, offers.length]);

  const optionsList = useMemo<EntityOption[]>(() => {
    return offers
      .filter((offer) => offer.offerId != null || offer.code != null)
      .map((offer) => ({
        id: offer.offerId ?? offer.code,
        name: offer.name,
        secondaryText: offer.code,
      }));
  }, [offers]);

  const findOffer = useCallback(
    (id: string): Offer | undefined => {
      return offers.find((o) => (o.offerId ?? o.code) === id);
    },
    [offers]
  );

  return {
    options: optionsList,
    optionsAll: optionsList,
    offers,
    isLoading,
    error: (listError ?? null) as Error | null,
    searchValue,
    setSearchValue,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      if (!hasNextPage || isFetchingNextPage) return;
      void fetchNextPage();
    },
    totalLoaded: offers.length,
    totalAvailable,
    findOffer,
  };
}
