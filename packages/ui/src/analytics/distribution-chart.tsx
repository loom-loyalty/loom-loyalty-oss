import type { ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LinkComponentProps } from "../shell/sidebar";
import { ChartContainer } from "./chart-container";

const DEFAULT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export interface DistributionDatum {
  name: string;
  value: number;
  percentage?: number;
  /**
   * Stable code behind `name`, used when drilling into this segment. Tiers
   * display a name but filter on a code, so both travel together.
   */
  code?: string;
}

interface DistributionChartProps {
  title: string;
  data: DistributionDatum[];
  colorMap?: Record<string, string>;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  exploreHref?: string;
  /** Optional app-level router adapter for drill-down links. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
  /**
   * Drills into one segment. Recharts renders slices as SVG paths, which cannot
   * hold focus — so the legend is rendered here as real links rather than using
   * Recharts' own `<Legend>`. That gives keyboard and screen-reader users the
   * same drill-down the slices offer a mouse, instead of a mouse-only path.
   *
   * Returning `undefined` leaves that entry as plain text, which is how a chart
   * with no item-level drill-down still renders its legend.
   */
  getSegmentHref?: (datum: DistributionDatum) => string | undefined;
  height?: number;
  className?: string;
}

export function DistributionChart({
  title,
  data,
  colorMap,
  isLoading,
  error,
  onRetry,
  onExport,
  isExporting,
  exploreHref,
  LinkComponent = "a" as unknown as React.ComponentType<LinkComponentProps>,
  getSegmentHref,
  height = 300,
  className,
}: DistributionChartProps): ReactNode {
  const getColor = (name: string, index: number) =>
    colorMap?.[name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const percentFor = (datum: DistributionDatum) =>
    datum.percentage ?? (total > 0 ? (datum.value / total) * 100 : 0);

  return (
    <ChartContainer
      title={title}
      isLoading={isLoading}
      error={error}
      isEmpty={!data || data.length === 0}
      onRetry={onRetry}
      onExport={onExport}
      isExporting={isExporting}
      exploreHref={exploreHref}
      LinkComponent={LinkComponent}
      skeletonVariant="donut"
      height={height}
      className={className}
    >
      <div style={{ height }} role="img" aria-label={`${title} distribution chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={getColor(entry.name, index)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                const item = data.find((d) => d.name === name);
                const pct = item ? percentFor(item) : 0;
                return [`${String(value)} (${pct.toFixed(1)}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend rendered outside the chart so its entries are real DOM
          controls. Doubles as the chart's text alternative. */}
      <ul
        className="mt-1 flex flex-wrap justify-center gap-x-1 gap-y-0.5"
        aria-label={`${title} legend`}
      >
        {data.map((entry, index) => {
          const href = getSegmentHref?.(entry);
          const swatch = (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: getColor(entry.name, index) }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground text-xs">{entry.name}</span>
            </>
          );

          return (
            <li key={entry.name}>
              {href ? (
                <LinkComponent
                  href={href}
                  // 44px min target height, per the accessibility baseline.
                  className="hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center gap-1.5 rounded-md px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={`${entry.name}: ${String(entry.value)} (${percentFor(entry).toFixed(1)}%) — explore in Spindle`}
                >
                  {swatch}
                </LinkComponent>
              ) : (
                <span className="flex min-h-8 items-center gap-1.5 px-2">{swatch}</span>
              )}
            </li>
          );
        })}
      </ul>
    </ChartContainer>
  );
}
