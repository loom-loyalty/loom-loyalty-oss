/**
 * Number formatters for the DecileDistribution metrics. Extracted as pure
 * functions so the currency sign handling is unit-tested (see decile-format.test.ts).
 */

/**
 * Compact currency: `$1.20M` / `$3.4k` / `$567`. The sign sits BEFORE the `$`
 * (`-$1.5k`, not `$-1.5k`) so negative COST/MARGIN totals read correctly.
 */
export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Compact count: `12.3k` above 10,000, else grouped (e.g. `1,234`). */
export function formatNumber(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}
