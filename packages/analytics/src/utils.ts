import type {
  CurrencyByCode,
  CurrencyTrendRow,
  DashboardSummaryRow,
  TinybirdResponse,
} from "./types";

// ─── Per-currency-code helpers ──────────────────────────
// The currency analytics pipes break results out per `program_currency_code`.
// These collapse/select that map shape for the KPI cards, the currency selector,
// and the trend chart. All tolerate undefined/null/{} and the unattributed "" key.

/** Sum every value in a per-code map, including the unattributed `""` key. */
export function sumCurrencyMap(map?: CurrencyByCode | null): number {
  if (!map) return 0;
  let total = 0;
  for (const value of Object.values(map)) {
    if (typeof value === "number" && Number.isFinite(value)) total += value;
  }
  return total;
}

/** Sorted, unique, non-empty currency codes across the summary's four maps. */
export function listCurrencyCodes(summary?: DashboardSummaryRow | null): string[] {
  if (!summary) return [];
  const codes = new Set<string>();
  const maps = [
    summary.currency_issued_by_code,
    summary.currency_debit_issued_by_code,
    summary.currency_redeemed_by_code,
    summary.currency_credit_withdrawn_by_code,
  ];
  for (const map of maps) {
    if (!map) continue;
    for (const code of Object.keys(map)) {
      if (code !== "") codes.add(code);
    }
  }
  return Array.from(codes).sort();
}

/**
 * Default currency code: the highest-issued non-empty code, ties broken
 * alphabetically; falls back to the first code alphabetically when nothing was
 * issued, and to undefined when the tenant has no codes at all.
 */
export function primaryCurrencyCode(summary?: DashboardSummaryRow | null): string | undefined {
  const codes = listCurrencyCodes(summary);
  if (codes.length === 0) return undefined;
  // Seed with the alphabetically-first code; strict `>` keeps it on ties, so a
  // tie resolves alphabetically while a strictly-higher issued value wins.
  const issued = summary?.currency_issued_by_code ?? {};
  let best = codes[0]!;
  let bestValue = issued[best] ?? 0;
  for (const code of codes) {
    const value = issued[code] ?? 0;
    if (value > bestValue) {
      best = code;
      bestValue = value;
    }
  }
  return best;
}

/** Value for a single code from a per-code map, defaulting to 0. */
export function currencyValue(map?: CurrencyByCode | null, code?: string): number {
  if (!map || code === undefined) return 0;
  return map[code] ?? 0;
}

/**
 * Collapse per-code trend rows into one row per period (sum issued/redeemed,
 * recompute net). A no-op when the server already filtered to a single code.
 * First-seen period order is preserved, matching the pipe's period ordering.
 */
export function aggregateCurrencyTrendByPeriod(
  rows: CurrencyTrendRow[]
): Array<{ period: string; issued_amount: number; redeemed_amount: number; net_change: number }> {
  const byPeriod = new Map<
    string,
    { period: string; issued_amount: number; redeemed_amount: number }
  >();
  for (const row of rows) {
    const existing = byPeriod.get(row.period);
    if (existing) {
      existing.issued_amount += row.issued_amount;
      existing.redeemed_amount += row.redeemed_amount;
    } else {
      byPeriod.set(row.period, {
        period: row.period,
        issued_amount: row.issued_amount,
        redeemed_amount: row.redeemed_amount,
      });
    }
  }
  return Array.from(byPeriod.values()).map((p) => ({
    ...p,
    net_change: p.issued_amount - p.redeemed_amount,
  }));
}

/** Build URL query string from a params object, omitting empty values */
export function buildQueryParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams.toString();
}

// Strip a single leading SQL table-alias prefix ("c.total_customers" → "total_customers").
function stripAliasPrefix(name: string): string {
  const dot = name.indexOf(".");
  return dot === -1 ? name : name.slice(dot + 1);
}

// Defensive workaround for upstream pipes that leak JOIN aliases into SELECT output
// (e.g. api_dashboard_summary emits "c.total_customers"). Unprefixed keys win on
// collision so a correct payload is a no-op. Remove once the upstream pipes are fixed.
export function normalizeTinybirdResponse<T>(response: TinybirdResponse<T>): TinybirdResponse<T> {
  return {
    ...response,
    meta: normalizeMeta(response.meta),
    data: response.data.map((row) => normalizeRowKeys(row)) as T[],
  };
}

// Reorders columns: unprefixed entries first (in original order), then promoted entries.
function normalizeMeta(meta: TinybirdResponse<unknown>["meta"]): TinybirdResponse<unknown>["meta"] {
  const out: TinybirdResponse<unknown>["meta"] = [];
  const taken = new Set<string>();
  for (const entry of meta) {
    if (!entry.name.includes(".")) {
      out.push(entry);
      taken.add(entry.name);
    }
  }
  for (const entry of meta) {
    if (!entry.name.includes(".")) continue;
    const stripped = stripAliasPrefix(entry.name);
    if (taken.has(stripped)) continue;
    out.push({ ...entry, name: stripped });
    taken.add(stripped);
  }
  return out;
}

function normalizeRowKeys<T>(row: T): T {
  if (row === null || typeof row !== "object") return row;
  const source = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (!k.includes(".")) out[k] = v;
  }
  for (const [k, v] of Object.entries(source)) {
    if (!k.includes(".")) continue;
    const stripped = stripAliasPrefix(k);
    if (!(stripped in out)) out[stripped] = v;
  }
  return out as T;
}
