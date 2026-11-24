/**
 * Lists the records an event type's sub type can name, for the sub type
 * picker: targets for target.achieved, tiers for tier.issued, and so on.
 * Every option's id is the record's code, because the code is what the event
 * carries as its sub type and what a rule or configuration stores.
 *
 * Tenant-scoped like every other list read: the SDK sends the caller's
 * organization environment, so the picker never sees another tenant's rows.
 */

import {
  customerAudienceManagementListCustomerAudiences,
  customerOfferListCoupons,
  customerStatusManagementListBadges,
  customerStatusManagementListTiers,
  eventEngineManagementListEventRules,
  eventEngineManagementListTargets,
  getCustomerAudienceManagementListCustomerAudiencesQueryKey,
  getCustomerOfferListCouponsQueryKey,
  getCustomerStatusManagementListBadgesQueryKey,
  getCustomerStatusManagementListTiersQueryKey,
  getEventEngineManagementListEventRulesQueryKey,
  getEventEngineManagementListTargetsQueryKey,
  getOfferManagementListOffersQueryKey,
  getProgramManagementListProgramsQueryKey,
  offerManagementListOffers,
  programManagementListPrograms,
} from "@loom-loyalty/sdk";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useDebouncedValue } from "../../hooks/use-debounced-value";
import {
  useSearchableInfiniteList,
  type SearchableInfiniteFetchParams,
} from "../../hooks/use-searchable-infinite-list";
import type { EntityOption } from "../entity-select-box";
import type { EventSubTypeSource } from "./sub-type-sources";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PAGE_SIZE = 50;

/** A record as the picker shows it: the code it stores, and what a person reads. */
export interface EventSubTypeRecord {
  code: string;
  name: string;
  secondaryText?: string;
}

interface SourceConfig {
  queryKey: () => QueryKey;
  fetchPage: (params: SearchableInfiniteFetchParams) => Promise<unknown>;
  /** Whether the list endpoint narrows by a search term itself. */
  serverSearch: boolean;
  toRecord: (row: unknown) => EventSubTypeRecord | null;
}

interface CodeNameRow {
  code?: string | null;
  name?: string | null;
}

function codeNameRecord(row: unknown): EventSubTypeRecord | null {
  const { code, name } = (row ?? {}) as CodeNameRow;
  if (!code) return null;
  return { code, name: name || code, secondaryText: code };
}

const withSearch = (params: SearchableInfiniteFetchParams) => ({
  page: params.page,
  size: params.size,
  ...(params.search ? { search: params.search } : {}),
});

export const EVENT_SUB_TYPE_SOURCE_CONFIGS: Record<EventSubTypeSource, SourceConfig> = {
  TARGET: {
    queryKey: () => getEventEngineManagementListTargetsQueryKey(),
    fetchPage: (params) => eventEngineManagementListTargets(withSearch(params)),
    serverSearch: true,
    toRecord: codeNameRecord,
  },
  TIER: {
    queryKey: () => getCustomerStatusManagementListTiersQueryKey(),
    fetchPage: (params) => customerStatusManagementListTiers(withSearch(params)),
    serverSearch: true,
    toRecord: codeNameRecord,
  },
  BADGE: {
    queryKey: () => getCustomerStatusManagementListBadgesQueryKey(),
    fetchPage: (params) => customerStatusManagementListBadges(withSearch(params)),
    serverSearch: true,
    toRecord: codeNameRecord,
  },
  OFFER: {
    queryKey: () => getOfferManagementListOffersQueryKey(),
    // `search` matches an offer's code or name, so a lookup by code finds it.
    fetchPage: (params) => offerManagementListOffers(withSearch(params)),
    serverSearch: true,
    toRecord: codeNameRecord,
  },
  CUSTOMER_AUDIENCE: {
    queryKey: () => getCustomerAudienceManagementListCustomerAudiencesQueryKey(),
    fetchPage: (params) => customerAudienceManagementListCustomerAudiences(withSearch(params)),
    serverSearch: true,
    toRecord: codeNameRecord,
  },
  PROGRAM: {
    queryKey: () => getProgramManagementListProgramsQueryKey(),
    fetchPage: (params) => programManagementListPrograms(withSearch(params)),
    serverSearch: true,
    toRecord: codeNameRecord,
  },
  EVENT_RULE: {
    queryKey: () => getEventEngineManagementListEventRulesQueryKey({ currentVersionsOnly: true }),
    fetchPage: (params) =>
      eventEngineManagementListEventRules({ ...withSearch(params), currentVersionsOnly: true }),
    serverSearch: true,
    toRecord: codeNameRecord,
  },
  COUPON: {
    queryKey: () => getCustomerOfferListCouponsQueryKey(),
    // A coupon event's sub type is the coupon code itself, not its offer's code.
    fetchPage: ({ page, size }) => customerOfferListCoupons({ page, size }),
    serverSearch: false,
    toRecord: (row) => {
      const coupon = (row ?? {}) as {
        couponCode?: string | null;
        couponOffer?: { name?: string | null } | null;
      };
      if (!coupon.couponCode) return null;
      return {
        code: coupon.couponCode,
        name: coupon.couponCode,
        secondaryText: coupon.couponOffer?.name ?? undefined,
      };
    },
  },
};

/** Cache-key marker so these pages never share an entry with another picker's own cache shape. */
const PICKER_SCOPE = { picker: "event-sub-type" } as const;

export interface UseEventSubTypeOptionsReturn {
  options: EntityOption[];
  /** Every loaded record, regardless of the search, for showing the picked value's name. */
  optionsAll: EntityOption[];
  isLoading: boolean;
  error: Error | null;
  searchValue: string;
  setSearchValue: (value: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /**
   * Whether a stored code names no record: `true` once a lookup by that code came back
   * without an exact match, `false` when one matched, `undefined` while unknown or when
   * the source can't be searched (coupon codes).
   */
  isValueMissing: boolean | undefined;
  /** The picked value's record, once found. */
  valueRecord: EventSubTypeRecord | undefined;
}

function toOption(record: EventSubTypeRecord): EntityOption {
  return { id: record.code, name: record.name, secondaryText: record.secondaryText };
}

function recordsOf(rows: unknown[], config: SourceConfig): EventSubTypeRecord[] {
  const out: EventSubTypeRecord[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const record = config.toRecord(row);
    if (!record || seen.has(record.code)) continue;
    seen.add(record.code);
    out.push(record);
  }
  return out;
}

function pageContent(page: unknown): unknown[] {
  const data = (page as { data?: unknown } | undefined)?.data;
  if (Array.isArray(data)) return data;
  const content = (data as { content?: unknown[] } | undefined)?.content;
  return Array.isArray(content) ? content : [];
}

export function useEventSubTypeOptions(
  source: EventSubTypeSource,
  value: string,
  options?: { pageSize?: number; enabled?: boolean }
): UseEventSubTypeOptionsReturn {
  const config = EVENT_SUB_TYPE_SOURCE_CONFIGS[source];
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = options?.enabled ?? true;

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const filter = useMemo(
    () => (row: unknown, needle: string) => {
      if (!needle) return true;
      const record = config.toRecord(row);
      if (!record) return false;
      return (
        record.code.toLowerCase().includes(needle) ||
        record.name.toLowerCase().includes(needle) ||
        (record.secondaryText?.toLowerCase().includes(needle) ?? false)
      );
    },
    [config]
  );
  const getKey = useMemo(() => (row: unknown) => config.toRecord(row)?.code, [config]);

  const list = useSearchableInfiniteList<unknown>({
    queryKey: config.queryKey(),
    fetchPage: config.fetchPage,
    pageSize,
    search: debouncedSearch,
    serverSearch: config.serverSearch,
    scope: PICKER_SCOPE,
    filter,
    getKey,
    enabled,
    source: `event-sub-type-field:${source}`,
  });

  const visible = useMemo(() => recordsOf(list.visibleRows, config), [list.visibleRows, config]);
  const all = useMemo(() => recordsOf(list.rows, config), [list.rows, config]);
  const loadedMatch = value ? all.find((record) => record.code === value) : undefined;

  // A stored code that isn't on a loaded page may still exist further down the list, so look
  // it up by searching for it. Codes match exactly: "summer" doesn't find "SUMMER".
  const lookupEnabled = enabled && Boolean(value) && !loadedMatch && config.serverSearch;
  const lookup = useQuery({
    queryKey: [...config.queryKey(), { ...PICKER_SCOPE, lookup: value }],
    queryFn: () => config.fetchPage({ page: 0, size: pageSize, search: value }),
    enabled: lookupEnabled,
    staleTime: 60_000,
  });
  const lookedUpMatch = useMemo(() => {
    if (!lookup.data) return undefined;
    return recordsOf(pageContent(lookup.data), config).find((record) => record.code === value);
  }, [lookup.data, config, value]);

  const valueRecord = loadedMatch ?? lookedUpMatch;
  let isValueMissing: boolean | undefined;
  if (!value) isValueMissing = false;
  else if (valueRecord) isValueMissing = false;
  else if (lookupEnabled && lookup.isSuccess) isValueMissing = true;
  else isValueMissing = undefined;

  const optionsAll = useMemo(() => {
    const merged = all.map(toOption);
    if (lookedUpMatch && !all.some((record) => record.code === lookedUpMatch.code)) {
      merged.push(toOption(lookedUpMatch));
    }
    return merged;
  }, [all, lookedUpMatch]);

  return {
    options: useMemo(() => visible.map(toOption), [visible]),
    optionsAll,
    isLoading: list.isLoading,
    error: list.error,
    searchValue,
    setSearchValue,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    isValueMissing,
    valueRecord,
  };
}
