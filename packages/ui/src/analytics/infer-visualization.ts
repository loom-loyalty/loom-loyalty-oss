/**
 * Result visualization inference
 *
 * Picks how an arbitrary SQL result should be drawn, from its column types and
 * shape alone. Spindle returns dynamic columns, so nothing about a result is
 * known ahead of time — the only inputs are TinyBird's `meta` (name + ClickHouse
 * type per column) and the rows themselves.
 *
 * The output is both a chosen view *and* the set of views that are honest for
 * this data. Offering a pie chart over ninety rows, or a line chart with no time
 * axis, produces a picture that misleads; those options are withheld rather than
 * rendered badly.
 */

export type VizKind = "table" | "bar" | "pie" | "line";

export type ColumnRole = "temporal" | "numeric" | "categorical" | "other";

export interface VizColumn {
  name: string;
  type: string;
  role: ColumnRole;
}

export interface VizPlan {
  /** The auto-selected view. */
  kind: VizKind;
  /** Views that represent this data honestly; always contains `table`. */
  available: VizKind[];
  /** Column driving the x-axis / slice labels, when the plan uses one. */
  dimension?: string;
  /**
   * Categorical column that splits a trend into one line per value. Set only
   * when the time axis repeats — a result grouped by both period and category
   * has several rows per period, and drawing them as a single line would join
   * unrelated categories into one meaningless zigzag.
   */
  series?: string;
  /** Numeric columns available as measures, best-first. */
  measures: string[];
  columns: VizColumn[];
  /** Why this view was chosen — surfaced in the UI so the pick isn't a black box. */
  reason: string;
}

/**
 * Pie charts stop communicating once the eye can no longer compare adjacent
 * slices. Beyond this, the same data is offered as bars instead.
 */
export const MAX_PIE_SLICES = 8;

/** Above this row count a categorical bar chart becomes an unreadable comb. */
export const MAX_BAR_ROWS = 50;

/**
 * Distinct series a trend may split into. Bounded by the five chart tokens the
 * design system defines: beyond that, lines would have to repeat a colour, and
 * silently plotting only the top few would misrepresent the result.
 */
export const MAX_SERIES = 5;

/**
 * ClickHouse type names arrive with wrappers (`Nullable(Float64)`,
 * `LowCardinality(String)`, `Array(String)`) and widths (`DateTime64(3)`).
 * Unwrapping to the innermost name is what lets a single set of prefix checks
 * classify every variant.
 */
function unwrap(type: string): string {
  let current = type.trim();
  // Array is deliberately not unwrapped: an array of numbers is not a measure,
  // and treating it as one would put JSON blobs on a value axis.
  for (const wrapper of ["Nullable", "LowCardinality"]) {
    const prefix = `${wrapper}(`;
    while (current.startsWith(prefix) && current.endsWith(")")) {
      current = current.slice(prefix.length, -1).trim();
    }
  }
  return current;
}

export function classifyColumn(type: string): ColumnRole {
  const inner = unwrap(type);
  if (inner.startsWith("Date")) return "temporal";
  if (/^(U?Int\d+|Float\d+|Decimal)/.test(inner)) return "numeric";
  if (inner.startsWith("Bool")) return "categorical";
  if (inner.startsWith("Enum")) return "categorical";
  if (inner.startsWith("String") || inner.startsWith("FixedString")) return "categorical";
  if (inner.startsWith("UUID")) return "categorical";
  return "other";
}

/**
 * Columns carrying tenant-isolation identifiers are hidden by the results table,
 * so they must not become an axis either — a chart grouped by `organization_id`
 * is a single bar labelled with an internal id.
 */
const EXCLUDED_COLUMNS = new Set(["organization_id", "organization_environment_id"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * TinyBird serializes 64-bit integers and decimals as strings to survive the
 * JSON round-trip, so a column typed numeric can arrive as `"12450"`. Coercing
 * here is what keeps those columns chartable instead of silently empty.
 */
export function toNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * A dimension with one row per value. When a categorical column repeats, a
 * bar or pie chart would silently sum unrelated rows into one mark, so the
 * uniqueness of the candidate axis is checked before it is offered.
 */
function isUniqueDimension(rows: Array<Record<string, unknown>>, columns: string[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = columns.map((column) => String(row[column] ?? "")).join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function allNonNegative(rows: Array<Record<string, unknown>>, column: string): boolean {
  return rows.every((row) => {
    const value = toNumber(row[column]);
    return value === null || value >= 0;
  });
}

/**
 * Infers a plan for one result set.
 *
 * Order matters: a result with both a time column and a numeric column is a
 * trend first and a category breakdown second, because reading it as categories
 * throws away the ordering that makes it meaningful.
 */
export function inferVisualization(
  meta: Array<{ name: string; type: string }>,
  rows: Array<Record<string, unknown>>
): VizPlan {
  const columns: VizColumn[] = meta
    .filter((column) => !EXCLUDED_COLUMNS.has(column.name))
    .map((column) => ({ name: column.name, type: column.type, role: classifyColumn(column.type) }));

  const temporal = columns.filter((column) => column.role === "temporal");
  const numeric = columns.filter((column) => column.role === "numeric");
  const categorical = columns.filter((column) => column.role === "categorical");
  const measures = numeric.map((column) => column.name);

  const tableOnly = (reason: string): VizPlan => ({
    kind: "table",
    available: ["table"],
    measures,
    columns,
    reason,
  });

  if (rows.length === 0) return tableOnly("No rows to chart.");
  if (numeric.length === 0) return tableOnly("No numeric column to measure.");

  // A single row of aggregates is a set of scalars — every chart of it is one
  // mark wide and says less than the number itself.
  if (rows.length === 1) return tableOnly("A single row reads better as values.");

  // ── Trend: an ordered time axis with something to measure on it.
  if (temporal.length > 0) {
    const dimension = temporal[0]!.name;
    const periods = new Set(rows.map((row) => String(row[dimension] ?? "")));

    // One row per period: every numeric column is its own line, as-is.
    if (periods.size === rows.length) {
      return {
        kind: "line",
        available: ["line", "table"],
        dimension,
        measures,
        columns,
        reason: `Charted over ${dimension} because the result has a time column and a numeric measure.`,
      };
    }

    // The period repeats, so something splits it. Only a categorical column that
    // makes (period, value) unique explains the duplication; without one, the
    // rows cannot be drawn as lines without merging unrelated records.
    const series = categorical.find(
      (column) =>
        new Set(rows.map((row) => String(row[column.name] ?? ""))).size > 1 &&
        isUniqueDimension(rows, [dimension, column.name])
    );
    if (!series) {
      return tableOnly(
        `Several rows share the same ${dimension}, with no column to separate them.`
      );
    }

    const seriesCount = new Set(rows.map((row) => String(row[series.name] ?? ""))).size;
    if (seriesCount > MAX_SERIES) {
      return tableOnly(`${String(seriesCount)} series is too many to plot as distinct lines.`);
    }

    return {
      kind: "line",
      available: ["line", "table"],
      dimension,
      series: series.name,
      measures,
      columns,
      reason: `Charted over ${dimension}, one line per ${series.name} (${String(seriesCount)} series).`,
    };
  }

  // ── Category breakdown: exactly one label column to group by.
  if (categorical.length >= 1) {
    const dimension =
      categorical.find((column) => isUniqueDimension(rows, [column.name]))?.name ??
      categorical[0]!.name;

    if (!isUniqueDimension(rows, [dimension])) {
      return tableOnly("Each label appears more than once, so a chart would merge unrelated rows.");
    }
    if (rows.length > MAX_BAR_ROWS) {
      return tableOnly(`${String(rows.length)} categories is too many to chart legibly.`);
    }

    const measure = measures[0]!;
    const available: VizKind[] = ["bar", "table"];
    const pieIsHonest = rows.length <= MAX_PIE_SLICES && allNonNegative(rows, measure);
    if (pieIsHonest) available.unshift("pie");

    return {
      kind: pieIsHonest ? "pie" : "bar",
      available,
      dimension,
      measures,
      columns,
      reason: pieIsHonest
        ? `${String(rows.length)} categories sharing one measure — shown as parts of a whole.`
        : `Compared across ${String(rows.length)} values of ${dimension}.`,
    };
  }

  return tableOnly("No label column to group by.");
}
