/**
 * Structurally matches CustomerRevenueDecileRow in @loom-loyalty/analytics,
 * declared inline here to break the analytics → ui → analytics import cycle.
 * See the same note in sample-customer-funnel.ts.
 */
interface SampleCustomerRevenueDecileRow {
  decile: number;
  customer_count: number;
  metric_total: number;
  metric_avg: number;
  currency_issued: Record<string, number>;
  share_of_total_pct: number;
}

/**
 * Sample decile data for base-tier teaser mode. The shape is a realistic
 * skew: top decile concentrates ~30% of revenue, then a long tail.
 *
 * The `currency_issued` map is keyed by `currencyCode` (matching the real
 * TinyBird pipe shape) so DecileDistribution's `primaryCurrencyCode` lookup
 * resolves correctly in sample mode. Defaults to "POINTS" when no code is
 * supplied.
 */
export function buildSampleCustomerRevenueDecile(brand?: {
  currencyName?: string;
  currencyCode?: string;
}): {
  data: SampleCustomerRevenueDecileRow[];
  rows: number;
  rows_before_limit_at_least: number;
  meta: never[];
  statistics: { elapsed: number; rows_read: number; bytes_read: number };
} {
  // Key by currencyCode to match the real pipe shape. The currencyName param
  // is preserved for future use (sample copy could reference it) but the map
  // key MUST be the code so DecileDistribution.primaryCurrencyCode lookup hits.
  const ccy = brand?.currencyCode ?? "POINTS";

  // Realistic skew: decile 10 dominates, decile 1 is tiny. Pipe returns DESC.
  const rows: Array<{ total: number; count: number }> = [
    { total: 185_000, count: 124 },
    { total: 92_000, count: 126 },
    { total: 51_000, count: 125 },
    { total: 32_000, count: 124 },
    { total: 21_000, count: 125 },
    { total: 14_000, count: 126 },
    { total: 9_000, count: 124 },
    { total: 5_500, count: 125 },
    { total: 3_000, count: 124 },
    { total: 1_200, count: 126 },
  ];
  const totalSum = rows.reduce((s, v) => s + v.total, 0);

  const data: SampleCustomerRevenueDecileRow[] = rows.map(({ total, count }, i) => {
    const decile = 10 - i;
    return {
      decile,
      customer_count: count,
      metric_total: total,
      metric_avg: Math.round(total / count),
      currency_issued: { [ccy]: Math.floor(total * 4) },
      share_of_total_pct: Math.round((total * 10000) / totalSum) / 100,
    };
  });

  return {
    data,
    rows: data.length,
    rows_before_limit_at_least: data.length,
    meta: [],
    statistics: { elapsed: 0.01, rows_read: data.length, bytes_read: 1200 },
  };
}
