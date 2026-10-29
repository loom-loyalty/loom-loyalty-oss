import { describe, expect, it } from "vitest";
import type {
  CurrencyByCode,
  CurrencyTrendRow,
  DashboardSummaryRow,
  TinybirdResponse,
} from "../types";
import {
  aggregateCurrencyTrendByPeriod,
  buildQueryParams,
  currencyValue,
  listCurrencyCodes,
  normalizeTinybirdResponse,
  primaryCurrencyCode,
  sumCurrencyMap,
} from "../utils";

describe("buildQueryParams", () => {
  it("omits undefined, null, and empty values", () => {
    const qs = buildQueryParams({ a: 1, b: undefined, c: null, d: "", e: "x" });
    expect(qs).toBe("a=1&e=x");
  });
});

// Build a summary fixture from just the per-code maps the helpers read.
function summaryWith(maps: Partial<DashboardSummaryRow>): DashboardSummaryRow {
  return {
    total_customers: 0,
    active_customers: 0,
    inactive_customers: 0,
    currency_issued_by_code: {},
    currency_debit_issued_by_code: {},
    currency_redeemed_by_code: {},
    currency_credit_withdrawn_by_code: {},
    customers_with_tiers: 0,
    total_tier_assignments: 0,
    total_coupons_issued: 0,
    total_coupons_used: 0,
    total_coupons_cancelled: 0,
    coupon_redemption_rate: 0,
    ...maps,
  };
}

describe("sumCurrencyMap", () => {
  it("returns 0 for undefined/null/empty", () => {
    expect(sumCurrencyMap(undefined)).toBe(0);
    expect(sumCurrencyMap(null)).toBe(0);
    expect(sumCurrencyMap({})).toBe(0);
  });

  it("sums all values including the unattributed '' key", () => {
    expect(sumCurrencyMap({ POINTS: 100, MILES: 50 })).toBe(150);
    expect(sumCurrencyMap({ "": 10, POINTS: 5 })).toBe(15);
  });

  it("skips non-finite values defensively", () => {
    const dirty = { POINTS: 5, BAD: Number.NaN } as unknown as CurrencyByCode;
    expect(sumCurrencyMap(dirty)).toBe(5);
  });
});

describe("listCurrencyCodes", () => {
  it("returns [] for undefined", () => {
    expect(listCurrencyCodes(undefined)).toEqual([]);
    expect(listCurrencyCodes(summaryWith({}))).toEqual([]);
  });

  it("returns sorted unique non-empty codes across the four maps", () => {
    const summary = summaryWith({
      currency_issued_by_code: { POINTS: 1, "": 3 },
      currency_redeemed_by_code: { MILES: 2, POINTS: 1 },
      currency_credit_withdrawn_by_code: { CREDITS: 4 },
    });
    expect(listCurrencyCodes(summary)).toEqual(["CREDITS", "MILES", "POINTS"]);
  });
});

describe("primaryCurrencyCode", () => {
  it("returns undefined when there are no codes", () => {
    expect(primaryCurrencyCode(undefined)).toBeUndefined();
    expect(primaryCurrencyCode(summaryWith({}))).toBeUndefined();
  });

  it("returns the highest-issued non-empty code", () => {
    const summary = summaryWith({
      currency_issued_by_code: { POINTS: 100, MILES: 500 },
    });
    expect(primaryCurrencyCode(summary)).toBe("MILES");
  });

  it("prefers the highest-issued code even when it sorts after another", () => {
    // POINTS sorts after MILES but was issued more — issued value wins over order.
    const summary = summaryWith({
      currency_issued_by_code: { POINTS: 500, MILES: 100 },
    });
    expect(primaryCurrencyCode(summary)).toBe("POINTS");
  });

  it("breaks ties alphabetically", () => {
    const summary = summaryWith({
      currency_issued_by_code: { POINTS: 100, MILES: 100 },
    });
    expect(primaryCurrencyCode(summary)).toBe("MILES");
  });

  it("falls back to the first code alphabetically when nothing was issued", () => {
    const summary = summaryWith({
      currency_issued_by_code: {},
      currency_redeemed_by_code: { POINTS: 5, MILES: 2 },
    });
    expect(primaryCurrencyCode(summary)).toBe("MILES");
  });

  it("ignores the '' key when selecting the primary", () => {
    const summary = summaryWith({
      currency_issued_by_code: { "": 9999, POINTS: 1 },
    });
    expect(primaryCurrencyCode(summary)).toBe("POINTS");
  });
});

describe("currencyValue", () => {
  it("returns 0 for missing map, missing code, or undefined code", () => {
    expect(currencyValue(undefined, "POINTS")).toBe(0);
    expect(currencyValue({ POINTS: 5 }, "MILES")).toBe(0);
    expect(currencyValue({ POINTS: 5 }, undefined)).toBe(0);
  });

  it("returns the value for a present code", () => {
    expect(currencyValue({ POINTS: 5 }, "POINTS")).toBe(5);
  });
});

describe("aggregateCurrencyTrendByPeriod", () => {
  function trend(
    period: string,
    program_currency_code: string,
    issued_amount: number,
    redeemed_amount: number,
    net_change = 999
  ): CurrencyTrendRow {
    return {
      period,
      program_currency_code,
      issued_amount,
      redeemed_amount,
      net_change,
      unique_earners: 0,
      unique_redeemers: 0,
    };
  }

  it("returns [] for no rows", () => {
    expect(aggregateCurrencyTrendByPeriod([])).toEqual([]);
  });

  it("is a no-op for a single code and recomputes net from issued - redeemed", () => {
    const out = aggregateCurrencyTrendByPeriod([
      trend("2026-01-01", "POINTS", 100, 30),
      trend("2026-01-02", "POINTS", 200, 60),
    ]);
    expect(out).toEqual([
      { period: "2026-01-01", issued_amount: 100, redeemed_amount: 30, net_change: 70 },
      { period: "2026-01-02", issued_amount: 200, redeemed_amount: 60, net_change: 140 },
    ]);
  });

  it("collapses multiple per-code rows for the same period", () => {
    const out = aggregateCurrencyTrendByPeriod([
      trend("2026-01-01", "POINTS", 100, 30),
      trend("2026-01-01", "MILES", 50, 10),
      trend("2026-01-02", "POINTS", 200, 60),
    ]);
    expect(out).toEqual([
      { period: "2026-01-01", issued_amount: 150, redeemed_amount: 40, net_change: 110 },
      { period: "2026-01-02", issued_amount: 200, redeemed_amount: 60, net_change: 140 },
    ]);
  });
});

function fixture<T>(meta: TinybirdResponse<T>["meta"], data: T[]): TinybirdResponse<T> {
  return {
    meta,
    data,
    rows: data.length,
    rows_before_limit_at_least: data.length,
    statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 },
  };
}

describe("normalizeTinybirdResponse", () => {
  it("strips SQL table-alias prefixes from row keys", () => {
    type Row = { total_customers: number; active_customers: number };
    const input = fixture<Row>(
      [
        { name: "c.total_customers", type: "UInt64" },
        { name: "c.active_customers", type: "UInt64" },
      ],
      // Cast: the wire payload uses the prefixed keys; the runtime check is what we're asserting.
      [{ "c.total_customers": 7, "c.active_customers": 3 } as unknown as Row]
    );
    const out = normalizeTinybirdResponse(input);
    expect(out.data[0]).toEqual({ total_customers: 7, active_customers: 3 });
  });

  it("strips prefixes from meta entries", () => {
    const input = fixture(
      [
        { name: "c.total_customers", type: "UInt64" },
        { name: "total_currency_issued", type: "Float64" },
        { name: "i.offer_code", type: "String" },
      ],
      []
    );
    const out = normalizeTinybirdResponse(input);
    expect(out.meta.map((m) => m.name)).toEqual([
      "total_currency_issued",
      "total_customers",
      "offer_code",
    ]);
  });

  it("is a no-op on rows with no prefixed keys", () => {
    type Row = { total_currency_issued: number };
    const row: Row = { total_currency_issued: 42 };
    const input = fixture<Row>([{ name: "total_currency_issued", type: "Float64" }], [row]);
    const out = normalizeTinybirdResponse(input);
    expect(out.data[0]).toEqual(row);
    expect(out.meta).toEqual(input.meta);
  });

  it("prefers the unprefixed value on collision", () => {
    type Row = { total_customers: number };
    const input = fixture<Row>(
      [
        { name: "total_customers", type: "UInt64" },
        { name: "c.total_customers", type: "UInt64" },
      ],
      [
        {
          total_customers: 10,
          "c.total_customers": 99,
        } as unknown as Row,
      ]
    );
    const out = normalizeTinybirdResponse(input);
    expect(out.data[0]).toEqual({ total_customers: 10 });
    expect(out.meta).toHaveLength(1);
    expect(out.meta[0]).toEqual({ name: "total_customers", type: "UInt64" });
  });

  it("handles empty data arrays", () => {
    const input = fixture([{ name: "c.total_customers", type: "UInt64" }], []);
    const out = normalizeTinybirdResponse(input);
    expect(out.data).toEqual([]);
    expect(out.meta[0].name).toBe("total_customers");
  });

  it("strips only the leading segment (multi-dot 'a.b.c' becomes 'b.c')", () => {
    type Row = Record<string, number>;
    const input = fixture<Row>(
      [{ name: "a.b.c", type: "UInt64" }],
      [{ "a.b.c": 42 } as unknown as Row]
    );
    const out = normalizeTinybirdResponse(input);
    expect(out.data[0]).toEqual({ "b.c": 42 });
    expect(out.meta).toEqual([{ name: "b.c", type: "UInt64" }]);
  });

  it("normalizes the real api_dashboard_summary payload shape", () => {
    // Post-reshape: per-code currency columns are Map-valued and unprefixed;
    // the normalizer must strip alias prefixes from the scalar columns while
    // leaving the map values untouched.
    type Row = { total_customers: number; currency_issued_by_code: Record<string, number> };
    const input = fixture<Row>(
      [
        { name: "c.total_customers", type: "UInt64" },
        { name: "c.active_customers", type: "UInt64" },
        { name: "c.inactive_customers", type: "UInt64" },
        { name: "currency_issued_by_code", type: "Map(String, Float64)" },
      ],
      [
        {
          "c.total_customers": 0,
          "c.active_customers": 0,
          "c.inactive_customers": 0,
          currency_issued_by_code: { POINTS: 0 },
        } as unknown as Row,
      ]
    );
    const out = normalizeTinybirdResponse(input);
    expect(out.data[0]).toEqual({
      total_customers: 0,
      active_customers: 0,
      inactive_customers: 0,
      currency_issued_by_code: { POINTS: 0 },
    });
  });
});
