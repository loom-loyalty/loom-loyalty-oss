/**
 * Bare charts for dynamic SQL results.
 *
 * Separate from the dashboard chart components because those wrap themselves in
 * a titled Card with its own export control — chrome that would nest badly
 * inside Spindle's results pane. These render only the plot, over columns whose
 * names are not known until the query returns.
 */
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toNumber, type VizPlan } from "./infer-visualization";

/**
 * The design system defines five chart tokens. A pie needs one colour per
 * slice, so results are capped to the top five categories with the remainder
 * rolled into "Other" — drawn in muted-foreground, which reads as
 * de-emphasised rather than as a sixth category competing for attention.
 * Cycling the five tokens instead would give two slices the same fill and make
 * the chart unreadable.
 */
const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const OTHER_COLOR = "var(--muted-foreground)";
export const MAX_SLICES_SHOWN = SLICE_COLORS.length;

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: "12px",
} as const;

const AXIS_PROPS = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
} as const;

type Row = Record<string, unknown>;

export interface ResultChartProps {
  plan: VizPlan;
  rows: Row[];
  /** Numeric column drawn as the value. Defaults to the plan's first measure. */
  measure?: string;
  height?: number;
}

/** Compacts long values so an axis tick stays one short token. */
function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Number(value.toFixed(2)));
}

/** Keeps a category tick readable without letting one long label crowd the axis. */
function truncate(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

interface Point {
  label: string;
  value: number;
}

/**
 * Projects rows onto (label, value) pairs, dropping rows whose measure is not a
 * usable number. A null aggregate is absence of data, and plotting it as zero
 * would assert a value the query never returned.
 */
function toPoints(rows: Row[], dimension: string, measure: string): Point[] {
  const points: Point[] = [];
  for (const row of rows) {
    const value = toNumber(row[measure]);
    if (value === null) continue;
    points.push({ label: String(row[dimension] ?? "—"), value });
  }
  return points;
}

/**
 * Ranks slices and folds everything past the colour budget into a single
 * "Other". Returned separately from `toPoints` because only the pie needs it —
 * a bar chart can legibly show all fifty categories the inference allows.
 */
function toSlices(points: Point[]): Point[] {
  if (points.length <= MAX_SLICES_SHOWN) return points;
  const ranked = [...points].sort((a, b) => b.value - a.value);
  const shown = ranked.slice(0, MAX_SLICES_SHOWN - 1);
  const rest = ranked.slice(MAX_SLICES_SHOWN - 1);
  const otherTotal = rest.reduce((sum, point) => sum + point.value, 0);
  return [...shown, { label: `Other (${String(rest.length)})`, value: otherTotal }];
}

function ResultPie({ plan, rows, measure, height }: Required<ResultChartProps>): ReactNode {
  const slices = toSlices(toPoints(rows, plan.dimension ?? "", measure));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {slices.map((slice, index) => (
              <Cell
                key={slice.label}
                fill={
                  slice.label.startsWith("Other (")
                    ? OTHER_COLOR
                    : SLICE_COLORS[index % SLICE_COLORS.length]
                }
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              total > 0
                ? `${formatValue(value)} (${((value / total) * 100).toFixed(1)}%)`
                : formatValue(value),
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultBar({ plan, rows, measure, height }: Required<ResultChartProps>): ReactNode {
  const points = toPoints(rows, plan.dimension ?? "", measure);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            {...AXIS_PROPS}
            tickFormatter={(label: string) => truncate(label)}
            interval="preserveStartEnd"
          />
          <YAxis {...AXIS_PROPS} tickFormatter={formatValue} width={56} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value: number) => [formatValue(value), measure]}
          />
          <Bar
            dataKey="value"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Turns long-format rows (one row per period per category) into the wide format
 * Recharts needs (one row per period, one key per category). Periods keep their
 * first-seen order, which the drill-down SQL emits ascending.
 */
function pivotBySeries(
  rows: Row[],
  dimension: string,
  seriesColumn: string,
  measure: string
): { data: Array<Record<string, unknown>>; series: string[] } {
  const byPeriod = new Map<string, Record<string, unknown>>();
  const seriesNames: string[] = [];

  for (const row of rows) {
    const period = String(row[dimension] ?? "");
    const name = String(row[seriesColumn] ?? "—");
    if (!seriesNames.includes(name)) seriesNames.push(name);

    const point = byPeriod.get(period) ?? { [dimension]: period };
    point[name] = toNumber(row[measure]);
    byPeriod.set(period, point);
  }

  return { data: [...byPeriod.values()], series: seriesNames };
}

function ResultLine({ plan, rows, measure, height }: Required<ResultChartProps>): ReactNode {
  const dimension = plan.dimension ?? "";

  // Two shapes reach here. Without plan.series there is one row per period, so
  // every numeric column becomes its own line and a trend with
  // issued/redeemed/net reads as one picture. With plan.series the period
  // repeats and the rows are pivoted into one line per category value —
  // plotting them unpivoted would join unrelated categories into a single
  // zigzag. Only the active measure is drawn in that case: measures × series
  // lines at once is not readable.
  const { data, series } = plan.series
    ? pivotBySeries(rows, dimension, plan.series, measure)
    : {
        data: rows.map((row) => {
          const point: Record<string, unknown> = { [dimension]: String(row[dimension] ?? "") };
          for (const key of plan.measures.length > 0 ? plan.measures : [measure]) {
            point[key] = toNumber(row[key]);
          }
          return point;
        }),
        series: plan.measures.length > 0 ? plan.measures : [measure],
      };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={dimension}
            {...AXIS_PROPS}
            tickFormatter={(label: string) => truncate(label, 16)}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis {...AXIS_PROPS} tickFormatter={formatValue} width={56} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [formatValue(value), name]}
          />
          {series.slice(0, SLICE_COLORS.length).map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={SLICE_COLORS[index % SLICE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Renders the plot for a plan. Charts are `role="img"` with a caption naming the
 * columns drawn — the marks themselves are SVG paths a screen reader cannot
 * traverse, and the data table alongside remains the accessible equivalent.
 */
export function ResultChart({ plan, rows, measure, height = 320 }: ResultChartProps): ReactNode {
  const activeMeasure = measure ?? plan.measures[0] ?? "";
  const resolved = { plan, rows, measure: activeMeasure, height };

  const description =
    plan.kind === "line"
      ? `${plan.measures.join(", ")} over ${plan.dimension ?? "time"}`
      : `${activeMeasure} by ${plan.dimension ?? "category"}`;

  return (
    <figure className="m-0" role="img" aria-label={description}>
      {plan.kind === "pie" ? (
        <ResultPie {...resolved} />
      ) : plan.kind === "line" ? (
        <ResultLine {...resolved} />
      ) : (
        <ResultBar {...resolved} />
      )}
    </figure>
  );
}
