/**
 * Chart shape — the stored, versioned description of how a saved view is drawn.
 *
 * Mirrors the shape the platform API stores for a saved view; field names must
 * match that JSON exactly. No OpenAPI `ChartShape` schema exists in
 * `@loom-loyalty/sdk` yet, so keep this in sync by hand. Only version 1 exists.
 */
import type { VizKind, VizPlan } from "./infer-visualization";

export const CHART_SHAPE_VERSION = 1;

export interface ChartShape {
  version: typeof CHART_SHAPE_VERSION;
  kind: VizKind;
  /** Column on the x-axis / slice labels. */
  dimension?: string;
  /** Categorical column splitting a trend into one line per value. */
  series?: string;
  /** The measure the user chose (bar / pie). */
  measure?: string;
  /** Measures available when the shape was captured, best-first. */
  measures?: string[];
  title?: string;
  axisLabelX?: string;
  axisLabelY?: string;
}

/** The user's current visualization choice, captured into a shape. */
export interface ChartShapeChoice {
  kind: VizKind;
  measure?: string;
  title?: string;
  axisLabelX?: string;
  axisLabelY?: string;
}

export interface AppliedChartShape {
  plan: VizPlan;
  /** Measure to draw; empty when the result has none. */
  measure: string;
  /** Set when the stored shape no longer fits and the inferred view is used. */
  fallbackReason?: string;
}
