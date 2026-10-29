import { useId, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LinkComponentProps } from "../shell/sidebar";
import { ChartContainer } from "./chart-container";

interface SeriesConfig {
  key: string;
  label: string;
  color: string;
  type?: "area" | "line";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartDataRow = Record<string, any>;

interface TimeSeriesChartProps {
  title: string;
  data: ChartDataRow[];
  xKey: string;
  series: SeriesConfig[];
  comparisonData?: ChartDataRow[];
  isLoading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  /** Opens this chart's whole result in the SQL workbench. */
  exploreHref?: string;
  /** Optional app-level router adapter for drill-down links. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
  height?: number;
  className?: string;
}

export function TimeSeriesChart({
  title,
  data,
  xKey,
  series,
  comparisonData,
  isLoading,
  error,
  isEmpty,
  onRetry,
  onExport,
  isExporting,
  exploreHref,
  LinkComponent,
  height = 300,
  className,
}: TimeSeriesChartProps): ReactNode {
  const instanceId = useId();

  return (
    <ChartContainer
      title={title}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty || !data || data.length === 0}
      onRetry={onRetry}
      onExport={onExport}
      isExporting={isExporting}
      exploreHref={exploreHref}
      LinkComponent={LinkComponent}
      height={height}
      className={className}
    >
      <div style={{ height }} role="img" aria-label={`${title} time series chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={s.key}
                  id={`gradient-${instanceId}-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey={xKey}
              className="fill-muted-foreground text-xs"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="fill-muted-foreground text-xs"
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "12px",
              }}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#gradient-${instanceId}-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
            {comparisonData &&
              series.map((s) => (
                <Area
                  key={`${s.key}-comparison`}
                  type="monotone"
                  data={comparisonData}
                  dataKey={s.key}
                  name={`${s.label} (previous)`}
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  dot={false}
                  opacity={0.5}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
