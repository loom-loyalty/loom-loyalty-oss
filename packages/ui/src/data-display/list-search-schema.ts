// URL codec for list-view filter state (q/page/size/sort/filters ↔ URL). Idempotent, strips defaults, preserves unknown keys like `detail`.

import type { SortState } from "./data-table";

/** Default page size when a spec doesn't override it. */
export const DEFAULT_LIST_PAGE_SIZE = 25;

/** Largest page size a list may request; the Platform API rejects anything above it. */
export const MAX_LIST_PAGE_SIZE = 100;

/** Reserved top-level keys; filter keys must not collide with these. */
const RESERVED_KEYS = new Set(["q", "page", "size", "sort"]);

const SORT_DIRECTIONS = new Set(["asc", "desc"]);

/** Declares one filter's encoding. `single` → string value; `multi` → string[]. */
export interface ListFilterSpec {
  type: "single" | "multi";
  /** Allow-list of valid values. Decoded values outside it are dropped. */
  values?: readonly string[];
  /** Default value, omitted from the URL. single → string; multi → string[]. */
  default?: string | readonly string[];
}

/** Full declaration for a list view's URL state. */
export interface ListSearchSchemaSpec {
  /** Filter key → spec. Each key becomes a URL param. */
  filters?: Record<string, ListFilterSpec>;
  /** Allow-listed sortable columns (the part before `:` in `sort`). */
  sortableColumns?: readonly string[];
  /** Default sort (`"col:dir"`), omitted from the URL. */
  defaultSort?: string;
  /** Default page size, omitted from the URL. Defaults to {@link DEFAULT_LIST_PAGE_SIZE}. */
  defaultPageSize?: number;
  /** Strip `q` from cleaned + decoded output. Use for routes that hide the search input. */
  disableQ?: boolean;
}

/** Cleaned URL search object: only non-default known keys, plus unknown keys. */
export interface CleanedListSearch {
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
  [key: string]: unknown;
}

/** Fully-defaulted state for a list view, derived from a cleaned search. */
export interface ListSearchState {
  q: string;
  page: number;
  size: number;
  sort: string | undefined;
  /** Per declared filter: single → string, multi → string[]. */
  filters: Record<string, string | string[]>;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function coerceInt(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : undefined;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }
  return undefined;
}

/** Normalize a raw filter value to a sorted, deduped, allow-listed string[]. */
function toStringArray(value: unknown, values?: readonly string[], warnKey?: string): string[] {
  let parts: string[];
  if (Array.isArray(value)) {
    parts = value.map((v) => coerceString(v) ?? "").filter(Boolean);
  } else {
    const str = coerceString(value);
    parts = str
      ? str
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }
  const allow = values ? new Set(values) : undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  const dropped: string[] = [];
  for (const part of parts) {
    if (allow && !allow.has(part)) {
      if (warnKey && !dropped.includes(part)) dropped.push(part);
      continue;
    }
    if (seen.has(part)) continue;
    seen.add(part);
    result.push(part);
  }
  if (warnKey && dropped.length > 0) {
    const list = dropped.map((v) => `"${v}"`).join(", ");
    console.warn(`[list-search-schema] dropped invalid value(s) ${list} for filter "${warnKey}"`);
  }
  // Canonical order so default-comparison and URLs are order-independent.
  return result.sort();
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((v) => set.has(v));
}

function isValidSort(
  sort: string,
  sortableColumns?: readonly string[],
  warnValue?: string
): boolean {
  const [column, direction, ...rest] = sort.split(":");
  const ok =
    rest.length === 0 &&
    !!column &&
    !!direction &&
    SORT_DIRECTIONS.has(direction) &&
    (!sortableColumns || sortableColumns.includes(column));
  if (!ok && warnValue) {
    console.warn(`[list-search-schema] dropped invalid sort "${warnValue}"`);
  }
  return ok;
}

/** Parse a `"col:dir"` sort string into a {@link SortState}, or `undefined`. */
export function parseSort(
  sort: string | undefined,
  sortableColumns?: readonly string[]
): SortState | undefined {
  if (!sort || !isValidSort(sort, sortableColumns)) return undefined;
  const [column, direction] = sort.split(":");
  if (!column || !direction) return undefined;
  return { column, direction: direction as "asc" | "desc" };
}

/** Serialize a {@link SortState} back to a `"col:dir"` string. */
export function formatSort(sort: SortState): string {
  return `${sort.column}:${sort.direction}`;
}

/** Strip a single filter value to its canonical form, or `undefined` if default/empty. */
function cleanSingleFilter(
  spec: ListFilterSpec,
  raw: unknown,
  warnKey?: string
): string | undefined {
  const value = coerceString(raw);
  if (!value) return undefined;
  if (spec.values && !spec.values.includes(value)) {
    if (warnKey) {
      console.warn(`[list-search-schema] dropped invalid value "${value}" for filter "${warnKey}"`);
    }
    return undefined;
  }
  const def = typeof spec.default === "string" ? spec.default : "";
  return value === def ? undefined : value;
}

/** Strip a multi filter value to a canonical comma-joined string, or `undefined`. */
function cleanMultiFilter(
  spec: ListFilterSpec,
  raw: unknown,
  warnKey?: string
): string | undefined {
  const values = toStringArray(raw, spec.values, warnKey);
  if (values.length === 0) return undefined;
  const def = Array.isArray(spec.default) ? toStringArray(spec.default, spec.values) : [];
  if (sameStringSet(values, def)) return undefined;
  return values.join(",");
}

// Old links and saved views may carry sizes above the API limit; cap them instead of dropping them.
function clampPageSize(size: number | undefined): number | undefined {
  if (size === undefined || size <= 0) return undefined;
  return Math.min(size, MAX_LIST_PAGE_SIZE);
}

// Strip defaults, validate/coerce known keys, drop invalid values, preserve unknown keys.
export function cleanListSearch(
  spec: ListSearchSchemaSpec,
  raw: Record<string, unknown>
): CleanedListSearch {
  const out: CleanedListSearch = {};
  const filterKeys = new Set(Object.keys(spec.filters ?? {}));
  const defaultPageSize = spec.defaultPageSize ?? DEFAULT_LIST_PAGE_SIZE;

  // Passthrough: anything not reserved and not a declared filter (e.g. `detail`).
  for (const [key, value] of Object.entries(raw)) {
    if (RESERVED_KEYS.has(key) || filterKeys.has(key) || value === undefined) continue;
    out[key] = value;
  }

  if (!spec.disableQ) {
    const q = coerceString(raw.q);
    if (q) out.q = q;
  }

  const page = coerceInt(raw.page);
  if (page !== undefined && page > 1) out.page = page;

  const size = clampPageSize(coerceInt(raw.size));
  if (size !== undefined && size !== defaultPageSize) out.size = size;

  const sort = coerceString(raw.sort);
  if (sort && isValidSort(sort, spec.sortableColumns, sort) && sort !== spec.defaultSort) {
    out.sort = sort;
  }

  for (const [key, filterSpec] of Object.entries(spec.filters ?? {})) {
    const cleaned =
      filterSpec.type === "multi"
        ? cleanMultiFilter(filterSpec, raw[key], key)
        : cleanSingleFilter(filterSpec, raw[key], key);
    if (cleaned !== undefined) out[key] = cleaned;
  }

  return out;
}

// Build a TanStack Router `validateSearch` from a spec (cleans the incoming search).
export function listSearchSchema(
  spec: ListSearchSchemaSpec
): (raw: Record<string, unknown>) => CleanedListSearch {
  return (raw) => cleanListSearch(spec, raw ?? {});
}

// Derive fully-defaulted list state from a search object; invalid values fall back to defaults.
export function decodeListSearch(
  spec: ListSearchSchemaSpec,
  search: Record<string, unknown>
): ListSearchState {
  const defaultPageSize = spec.defaultPageSize ?? DEFAULT_LIST_PAGE_SIZE;

  const page = coerceInt(search.page);
  const size = clampPageSize(coerceInt(search.size));
  const sort = coerceString(search.sort);

  const filters: Record<string, string | string[]> = {};
  for (const [key, filterSpec] of Object.entries(spec.filters ?? {})) {
    if (filterSpec.type === "multi") {
      const values = toStringArray(search[key], filterSpec.values);
      const def = Array.isArray(filterSpec.default)
        ? toStringArray(filterSpec.default, filterSpec.values)
        : [];
      filters[key] = values.length > 0 ? values : def;
    } else {
      const value = cleanSingleFilter(filterSpec, search[key]);
      const def = typeof filterSpec.default === "string" ? filterSpec.default : "";
      filters[key] = value ?? def;
    }
  }

  return {
    q: spec.disableQ ? "" : (coerceString(search.q) ?? ""),
    page: page !== undefined && page > 1 ? page : 1,
    size: size ?? defaultPageSize,
    sort: sort && isValidSort(sort, spec.sortableColumns) ? sort : spec.defaultSort,
    filters,
  };
}
