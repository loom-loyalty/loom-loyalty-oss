import type { ReactNode } from "react";
import { useMemo } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/tooltip";
import { formatCurrency, formatNumber } from "./decile-format";
import { decileFill } from "./decile-sizing";

/**
 * Structurally compatible with `CustomerRevenueDecileRow` from @loom-loyalty/analytics.
 * Declared inline to break the analytics → ui → analytics import cycle. See the
 * same note in lifecycle-funnel.tsx.
 */
export interface DecileRow {
  decile: number;
  customer_count: number;
  metric_total: number;
  metric_avg: number;
  currency_issued: Record<string, number>;
  share_of_total_pct: number;
}

interface DecileDistributionProps {
  /** Always 10 rows (sorted DESC by decile from the pipe). */
  data: DecileRow[];
  /** Optional comparison data — rendered as muted bars behind current. */
  comparisonData?: DecileRow[];
  /** Currency code to surface inline from the currency_issued map (e.g. "POINTS"). */
  primaryCurrencyCode?: string;
  metricRole: "REVENUE" | "COST" | "MARGIN";
  scope: "all" | "earning";
}

/**
 * Revenue decile distribution — 10 descending horizontal bars (top decile widest).
 * Width scaled to `metric_total` against the largest decile so the proportions
 * read at a glance: the top decile typically dominates. Bars carry a saturated
 * teal→gold value ramp (see `decileFill`); the metrics live in the right gutter so
 * the bar stays a clean visual. The hover tooltip on the value shows the full
 * `currency_issued` map (multi-currency tenants).
 *
 * Sparse-data state (< 10 customers across all deciles) is the caller's
 * responsibility — render a "Deciles need ~10+ customers" message above this
 * component and skip rendering.
 */
export function DecileDistribution({
  data,
  comparisonData,
  primaryCurrencyCode,
  metricRole,
  scope,
}: DecileDistributionProps): ReactNode {
  // Pipe returns DESC — render in pipe order (decile 10 first).
  // Scale by absolute magnitude so COST / MARGIN deciles with all-negative or
  // mixed-sign values still render visible bars. Otherwise `Math.max(0, ...negatives)`
  // would floor maxTotal at 0 and every bar would collapse to width 0.
  const maxTotal = useMemo(() => Math.max(0, ...data.map((d) => Math.abs(d.metric_total))), [data]);
  const compByDecile = useMemo(() => {
    if (!comparisonData) return null;
    return new Map(comparisonData.map((d) => [d.decile, d.metric_total]));
  }, [comparisonData]);

  return (
    <TooltipProvider>
      <div
        role="img"
        aria-label={`Customer ${metricRole.toLowerCase()} deciles (${scope === "all" ? "all customers" : "earning customers only"})`}
        className="space-y-2"
      >
        {data.map((row) => {
          const widthPct = maxTotal > 0 ? (Math.abs(row.metric_total) / maxTotal) * 100 : 0;
          const fill = decileFill(row.decile);
          const primaryAmount = primaryCurrencyCode
            ? row.currency_issued[primaryCurrencyCode]
            : undefined;
          const compTotal = compByDecile?.get(row.decile);
          const compWidthPct =
            compTotal !== undefined && maxTotal > 0 ? (Math.abs(compTotal) / maxTotal) * 100 : null;
          return (
            <div
              key={row.decile}
              className="grid grid-cols-[3.25rem_1fr_8.5rem] items-center gap-3 text-sm"
            >
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                Decile {row.decile}
              </span>
              <div className="bg-muted/40 relative h-9 overflow-hidden rounded-md">
                {compWidthPct !== null && (
                  <div
                    aria-hidden="true"
                    className="bg-foreground/15 absolute inset-y-0 left-0 rounded-r-sm"
                    style={{ width: `${compWidthPct.toFixed(2)}%` }}
                  />
                )}
                {/* Saturated value ramp — bar is a pure visual now that the
                    metrics live in the right gutter. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 rounded-r-sm motion-safe:transition-all motion-safe:duration-300"
                  style={{
                    width: `${widthPct.toFixed(2)}%`,
                    backgroundImage: `linear-gradient(to bottom, ${fill.from}, ${fill.to})`,
                  }}
                />
              </div>
              {/* Right gutter — value (with full-breakdown tooltip), then count + share */}
              <div className="flex flex-col items-end justify-center leading-tight">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-foreground cursor-help font-mono text-sm tabular-nums"
                      aria-label={`${formatCurrency(row.metric_total)} total ${metricRole.toLowerCase()} — breakdown: ${Object.entries(
                        row.currency_issued
                      )
                        .map(([code, amt]) => `${code} ${formatNumber(amt)}`)
                        .join(", ")}`}
                    >
                      {formatCurrency(row.metric_total)}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="end" className="font-mono text-xs tabular-nums">
                    {Object.entries(row.currency_issued).map(([code, amt]) => (
                      <div key={code}>
                        {code}: {formatNumber(amt)}
                      </div>
                    ))}
                  </TooltipContent>
                </Tooltip>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {formatNumber(row.customer_count)} cust · {row.share_of_total_pct.toFixed(1)}%
                  {primaryAmount !== undefined && (
                    <span className="text-muted-foreground/70">
                      {" · "}
                      {formatNumber(primaryAmount)} {primaryCurrencyCode}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
