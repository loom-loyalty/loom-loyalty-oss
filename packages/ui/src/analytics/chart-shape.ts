/**
 * Conversions between the live visualization state and a stored `ChartShape`.
 *
 * Applying a shape never trusts it: the result it is applied to may have
 * changed since it was saved. A shape is honored only when every column it
 * names still exists and its kind is among the honest views for the data;
 * otherwise the inferred view is used and the reason is returned for display.
 */
import {
  CHART_SHAPE_VERSION,
  type AppliedChartShape,
  type ChartShape,
  type ChartShapeChoice,
} from "./chart-shape-types";
import { inferVisualization, type VizKind, type VizPlan } from "./infer-visualization";

const KINDS: readonly VizKind[] = ["table", "bar", "pie", "line"];
const MAX_NAME_LENGTH = 60;

/** Column names come from untrusted SQL; keep them short in display text. */
function displayName(name: string): string {
  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH)}…` : name;
}

export function toChartShape(plan: VizPlan, choice: ChartShapeChoice): ChartShape {
  const shape: ChartShape = {
    version: CHART_SHAPE_VERSION,
    kind: choice.kind,
    measures: [...plan.measures],
  };
  if (choice.kind !== "table" && plan.dimension) shape.dimension = plan.dimension;
  if (choice.kind === "line" && plan.series) shape.series = plan.series;
  const measure = choice.measure ?? plan.measures[0];
  if (measure) shape.measure = measure;
  if (choice.title) shape.title = choice.title;
  if (choice.axisLabelX) shape.axisLabelX = choice.axisLabelX;
  if (choice.axisLabelY) shape.axisLabelY = choice.axisLabelY;
  return shape;
}

function mismatch(shape: ChartShape, plan: VizPlan): string | undefined {
  if (shape.version !== CHART_SHAPE_VERSION) {
    return `Saved chart version ${String(shape.version)} is not supported.`;
  }
  if (!KINDS.includes(shape.kind))
    return `Saved chart type "${String(shape.kind)}" is not supported.`;

  // A malformed stored shape must fall back, not throw.
  if (shape.measures !== undefined && shape.measures !== null && !Array.isArray(shape.measures)) {
    return "Saved chart measures are malformed.";
  }
  const storedMeasures = shape.measures ?? [];
  const names = new Set(plan.columns.map((column) => column.name));
  const referenced = [shape.dimension, shape.series, shape.measure, ...storedMeasures];
  const missing = referenced.filter(
    (name): name is string => typeof name === "string" && !!name && !names.has(name)
  );
  if (missing.length > 0) {
    return `Column${missing.length > 1 ? "s" : ""} ${missing.map(displayName).join(", ")} no longer in the result.`;
  }

  if (!plan.available.includes(shape.kind)) {
    return `A ${shape.kind} chart no longer fits this result.`;
  }
  if (shape.kind !== "table") {
    // The axes are inferred from the data; a shape whose axes differ from what
    // the data supports would draw a misleading chart.
    if (shape.dimension && shape.dimension !== plan.dimension) {
      return `The result is no longer grouped by ${displayName(shape.dimension)}.`;
    }
    // A column that still exists may have stopped being numeric (or become the
    // dimension); charting it as a measure would be meaningless.
    for (const measure of [shape.measure, ...storedMeasures]) {
      if (typeof measure === "string" && measure && !plan.measures.includes(measure)) {
        return `"${displayName(measure)}" is no longer a numeric measure in this result.`;
      }
    }
    if (shape.kind === "line" && (shape.series ?? undefined) !== plan.series) {
      return shape.series
        ? `The result no longer splits by ${displayName(shape.series)}.`
        : "The result now splits into several series.";
    }
  }
  return undefined;
}

export function applyChartShape(
  shape: ChartShape,
  columns: Array<{ name: string; type: string }>,
  rows: Array<Record<string, unknown>>
): AppliedChartShape {
  const inferred = inferVisualization(columns, rows);
  const fallbackReason = mismatch(shape, inferred);
  if (fallbackReason) {
    return { plan: inferred, measure: inferred.measures[0] ?? "", fallbackReason };
  }
  return {
    plan: { ...inferred, kind: shape.kind },
    measure: shape.measure || inferred.measures[0] || "",
  };
}
