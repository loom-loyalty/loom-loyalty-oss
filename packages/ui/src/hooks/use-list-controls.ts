// URL-bound orchestrator for list views: search/filters/sort/pagination live in the route's search params (shareable, restore on reload, survive back/forward). State is derived from the URL each render; the only local state is the live search input + its debounce. All writes funnel through one `writeSearch`. Pair the spec const with the route's `listSearchSchema(SPEC)` so keys can't drift.
// Do NOT migrate PII-bearing search criteria (names, emails, phones) onto this framework — URLs leak via browser history, referrers, and server logs. Keep those in transient component state.

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PaginationConfig, SortState } from "../data-display/data-table";
import type {
  AnyFilterConfig,
  FilterConfig,
  FilterOption,
  MultiFilterConfig,
} from "../data-display/filter-bar";
import {
  cleanListSearch,
  decodeListSearch,
  formatSort,
  parseSort,
  type ListSearchSchemaSpec,
} from "../data-display/list-search-schema";
import { useDebouncedValue } from "./use-debounced-value";

interface PaginationState {
  page: number;
  pageSize: number;
}

const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

/** UI description of a filter, turned into FilterBar configs by {@link ListControls.buildFilterConfigs}. */
export interface FilterDef {
  key: string;
  type?: "single" | "multi";
  placeholder: string;
  options: FilterOption[];
}

export interface UseListControlsOptions {
  /** URL schema spec; the same const the route binds to `validateSearch`. */
  spec: ListSearchSchemaSpec;
  /** Search debounce in ms (default 300). */
  searchDebounceMs?: number;
  /** Min search length before the query fires (0 = always); 1..n-1 gate off via `queryArgs.enabled`. */
  searchMinChars?: number;
  /** Extra enabled gate ANDed into `queryArgs.enabled`. */
  enabled?: boolean;
}

export interface ListControls {
  /** Live (un-debounced) search box value. */
  searchInput: string;
  /** Decoded filter values: single → string, multi → string[]. */
  filters: Record<string, string | string[]>;
  /** Decoded sort, or undefined. */
  sort: SortState | undefined;
  page: number;
  pageSize: number;
  setSearch: (value: string) => void;
  setFilter: (key: string, value: string | string[] | null) => void;
  toggleFilterValue: (key: string, value: string) => void;
  setSort: (sort: SortState | null) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  clearAll: () => void;
  /** True when search or any filter is non-default (drives the Clear button). */
  hasActiveFilters: boolean;
  /** True when the URL holds non-default committed state — use for canSave (saved-view) gating. */
  hasCommittedState: boolean;
  /** Spread into `<FilterBar>` (search + clear wiring). */
  filterBarProps: {
    searchValue: string;
    onSearchChange: (value: string) => void;
    onClearAll: () => void;
    showClear: boolean;
  };
  /** Build FilterBar filter configs wired to the current state. */
  buildFilterConfigs: (defs: FilterDef[]) => AnyFilterConfig[];
  /** Build a DataTable pagination config for a given total. */
  paginationProps: (total: number) => PaginationConfig;
  /** Args for `useEntityList` (debounced search, normalized filters/sort/pagination, enabled). */
  queryArgs: {
    pagination: PaginationState;
    search: string | undefined;
    sort: SortState | undefined;
    filters: Record<string, unknown>;
    enabled: boolean;
  };
  /** Cleaned, control-only URL search (no `detail`) — snapshot for saved views. */
  currentSearch: Record<string, unknown>;
  /** Apply a saved-view search snapshot: keeps `detail`, resets page. */
  applySearch: (search: Record<string, unknown>) => void;
}

function pickControlKeys(
  search: Record<string, unknown>,
  controlKeys: Set<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(search)) {
    if (controlKeys.has(key)) out[key] = value;
  }
  return out;
}

function normalizeFiltersForQuery(
  filters: Record<string, string | string[]>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value;
    } else if (value) {
      out[key] = value;
    }
  }
  return out;
}

export function useListControls(options: UseListControlsOptions): ListControls {
  const { spec, searchDebounceMs = DEFAULT_SEARCH_DEBOUNCE_MS, searchMinChars = 0 } = options;

  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();

  const controlKeys = useMemo(
    () => new Set<string>(["q", "page", "size", "sort", ...Object.keys(spec.filters ?? {})]),
    [spec]
  );
  // Saved-view snapshot excludes pagination so the active chip stays lit across pages.
  const snapshotKeys = useMemo(
    () => new Set<string>(["q", "sort", ...Object.keys(spec.filters ?? {})]),
    [spec]
  );

  const cleaned = useMemo(() => cleanListSearch(spec, rawSearch), [spec, rawSearch]);
  const decoded = useMemo(() => decodeListSearch(spec, cleaned), [spec, cleaned]);
  const currentSearch = useMemo(
    () => pickControlKeys(cleaned, snapshotKeys),
    [cleaned, snapshotKeys]
  );

  const writeSearch = useCallback(
    (patch: Record<string, unknown>) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) =>
          cleanListSearch(spec, { ...prev, ...patch }) as Record<string, unknown>,
        replace: true,
      });
    },
    [navigate, spec]
  );

  // Live search input; URL `q` is the committed value written after debounce.
  const urlQ = decoded.q;
  const [searchInput, setSearchInput] = useState(urlQ);
  const debounced = useDebouncedValue(searchInput, searchDebounceMs);
  const lastWrittenQRef = useRef(urlQ);

  // Commit the settled input to the URL. Sub-threshold values are never written —
  // they wouldn't fire a query and would create unshareable URLs; if the URL holds
  // a stale above-threshold value while the input drops below threshold, clear it.
  useEffect(() => {
    if (debounced !== searchInput) return;
    const inThreshold =
      searchMinChars <= 0 || debounced.length === 0 || debounced.length >= searchMinChars;
    if (inThreshold) {
      if (debounced === urlQ) return;
      lastWrittenQRef.current = debounced;
      writeSearch({ q: debounced || undefined, page: undefined });
    } else if (urlQ !== "") {
      lastWrittenQRef.current = "";
      writeSearch({ q: undefined, page: undefined });
    }
  }, [debounced, searchInput, urlQ, writeSearch, searchMinChars]);

  // Sync external URL changes (back/forward, applied view) back into the input.
  useEffect(() => {
    if (urlQ !== lastWrittenQRef.current) {
      lastWrittenQRef.current = urlQ;
      setSearchInput(urlQ);
    }
  }, [urlQ]);

  const setSearch = useCallback((value: string) => setSearchInput(value), []);

  const setFilter = useCallback(
    (key: string, value: string | string[] | null) => {
      writeSearch({ [key]: value === null ? undefined : value, page: undefined });
    },
    [writeSearch]
  );

  const toggleFilterValue = useCallback(
    (key: string, value: string) => {
      const current = decoded.filters[key];
      const arr = Array.isArray(current) ? current : [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      writeSearch({ [key]: next, page: undefined });
    },
    [decoded.filters, writeSearch]
  );

  const setSort = useCallback(
    (sort: SortState | null) => {
      writeSearch({ sort: sort ? formatSort(sort) : undefined, page: undefined });
    },
    [writeSearch]
  );

  const setPage = useCallback((page: number) => writeSearch({ page }), [writeSearch]);

  const setPageSize = useCallback(
    (size: number) => writeSearch({ size, page: undefined }),
    [writeSearch]
  );

  const clearAll = useCallback(() => {
    setSearchInput("");
    lastWrittenQRef.current = "";
    const patch: Record<string, unknown> = { q: undefined, sort: undefined, page: undefined };
    for (const key of Object.keys(spec.filters ?? {})) patch[key] = undefined;
    writeSearch(patch);
  }, [spec, writeSearch]);

  const applySearch = useCallback(
    (viewSearch: Record<string, unknown>) => {
      const nextQ = typeof viewSearch.q === "string" ? viewSearch.q : "";
      setSearchInput(nextQ);
      lastWrittenQRef.current = nextQ;
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => {
          // Keep non-control keys (e.g. detail), replace all control keys, reset page.
          const next: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(prev)) {
            if (!controlKeys.has(key)) next[key] = value;
          }
          Object.assign(next, viewSearch);
          delete next.page;
          return cleanListSearch(spec, next) as Record<string, unknown>;
        },
        replace: true,
      });
    },
    [navigate, spec, controlKeys]
  );

  const hasActiveFilters = useMemo(() => {
    if (searchInput.trim().length > 0) return true;
    return Object.entries(decoded.filters).some(([key, value]) => {
      if (Array.isArray(value)) {
        const def = spec.filters?.[key]?.default;
        const defArr = Array.isArray(def) ? def : [];
        if (value.length !== defArr.length) return true;
        const defSet = new Set(defArr);
        return value.some((v) => !defSet.has(v));
      }
      const def = (spec.filters?.[key]?.default as string | undefined) ?? "";
      return value !== def;
    });
  }, [searchInput, decoded.filters, spec]);

  // Committed (URL-based) state — gate saved-view creation on this, not the live input,
  // so a save click mid-debounce doesn't snapshot an empty `q`.
  const hasCommittedState = useMemo(() => Object.keys(currentSearch).length > 0, [currentSearch]);

  const filterBarProps = useMemo(
    () => ({
      searchValue: searchInput,
      onSearchChange: setSearch,
      onClearAll: clearAll,
      showClear: hasActiveFilters,
    }),
    [searchInput, setSearch, clearAll, hasActiveFilters]
  );

  const buildFilterConfigs = useCallback(
    (defs: FilterDef[]): AnyFilterConfig[] =>
      defs.map((def) => {
        if (def.type === "multi") {
          return {
            type: "multi",
            key: def.key,
            placeholder: def.placeholder,
            options: def.options,
            values: (decoded.filters[def.key] as string[] | undefined) ?? [],
            onChange: (values: string[]) => setFilter(def.key, values),
          } satisfies MultiFilterConfig;
        }
        return {
          key: def.key,
          placeholder: def.placeholder,
          options: def.options,
          value: (decoded.filters[def.key] as string | undefined) || null,
          onChange: (value: string | null) => setFilter(def.key, value),
        } satisfies FilterConfig;
      }),
    [decoded.filters, setFilter]
  );

  const paginationProps = useCallback(
    (total: number): PaginationConfig => ({
      page: decoded.page,
      pageSize: decoded.size,
      total,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
    }),
    [decoded.page, decoded.size, setPage, setPageSize]
  );

  // Gate on the live input so sub-threshold typing never fires a transient empty-search query.
  const searchGateOk =
    searchMinChars <= 0 || searchInput.length === 0 || debounced.length >= searchMinChars;
  const queryEnabled = (options.enabled ?? true) && searchGateOk;

  const queryArgs = useMemo(
    () => ({
      pagination: { page: decoded.page, pageSize: decoded.size },
      // When the user clears the input, drop immediately — don't wait for debounce to release the stale value.
      search: searchInput === "" ? undefined : debounced || undefined,
      sort: parseSort(decoded.sort, spec.sortableColumns),
      filters: normalizeFiltersForQuery(decoded.filters),
      enabled: queryEnabled,
    }),
    [
      decoded.page,
      decoded.size,
      debounced,
      searchInput,
      decoded.sort,
      decoded.filters,
      spec.sortableColumns,
      queryEnabled,
    ]
  );

  return {
    searchInput,
    filters: decoded.filters,
    sort: queryArgs.sort,
    page: decoded.page,
    pageSize: decoded.size,
    setSearch,
    setFilter,
    toggleFilterValue,
    setSort,
    setPage,
    setPageSize,
    clearAll,
    hasActiveFilters,
    hasCommittedState,
    filterBarProps,
    buildFilterConfigs,
    paginationProps,
    queryArgs,
    currentSearch,
    applySearch,
  };
}
