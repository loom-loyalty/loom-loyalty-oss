/**
 * Analytics drill-down — types
 *
 * A drill-down takes the user from a rendered analytics result into Spindle,
 * the SQL workbench, with a query that reproduces (or narrows) that result.
 * Two levels exist:
 *
 *   - **chart** — the whole pipe result, e.g. every tier and its customer count.
 *   - **item**  — the rows *behind* one datum the user clicked, e.g. the
 *                 customers who actually hold the Gold tier.
 *
 * Registry entries declare the datasources and columns their SQL needs. The
 * real TinyBird datasource names are not known at build time — they arrive from
 * the token endpoint at runtime and vary by organization entitlement — so the
 * schema is checked before SQL is emitted. When it is not satisfied, the
 * drill-down degrades to a natural-language question for Spindle's AI
 * assistant, which grounds on the live schema instead. Guessing table names and
 * handing the user a query that cannot run is the failure mode this avoids.
 */
import type { DatasourceSchema, Granularity } from "../types";

/** Which of the two levels a target represents. */
export type DrilldownLevel = "chart" | "item";

/** The page-level filters in effect when the user drilled in. */
export interface DrilldownContext {
  /** Inclusive `yyyy-MM-dd` start of the active date range. */
  startDate: string;
  /** Inclusive `yyyy-MM-dd` end of the active date range. */
  endDate: string;
  granularity?: Granularity;
  /** Active currency-code filter, when the source chart is currency-scoped. */
  currencyCode?: string;
}

/** One datum the user clicked, identifying the slice to narrow to. */
export interface DrilldownDatum {
  /**
   * The raw dimension value used in the `WHERE` clause (`tier_code`,
   * `offer_code`, …). Distinct from `label` because charts display names while
   * queries filter on codes.
   */
  value: string;
  /** Human-readable label for headings and the AI prompt. */
  label: string;
}

/** What a spec needs from the live schema before its SQL can be trusted. */
export interface DrilldownRequirement {
  datasource: string;
  columns: string[];
}

/**
 * A drill-down definition for one pipe. `buildItemSql` is optional: some charts
 * (a scalar summary, a time series) have no meaningful per-item narrowing, and
 * omitting it is what hides the item-level affordance for that chart.
 */
export interface DrilldownSpec {
  /** The pipe this drill-down belongs to; also the registry key. */
  pipe: string;
  /** Chart title, reused as the Spindle tab heading. */
  title: string;
  /** Column the item-level datum filters on, for prompt wording. */
  dimensionLabel?: string;
  requires: DrilldownRequirement[];
  /**
   * Omitted for charts whose backing pipe has no expressible equivalent over
   * the datasources Spindle exposes. Such specs always hand off as a natural-
   * language question — the honest outcome, rather than SQL against a table
   * name invented at build time.
   */
  buildSql?: (context: DrilldownContext) => string;
  buildItemSql?: (context: DrilldownContext, datum: DrilldownDatum) => string;
  /** Natural-language fallback used when `requires` is not satisfied. */
  buildAsk: (context: DrilldownContext, datum?: DrilldownDatum) => string;
}

/** A resolved drill-down request, ready to be turned into a Spindle URL. */
export interface DrilldownTarget {
  pipe: string;
  level: DrilldownLevel;
  title: string;
  context: DrilldownContext;
  datum?: DrilldownDatum;
}

/**
 * What the Spindle hand-off carries. Exactly one of `sql` / `ask` is set: `sql`
 * when the live schema satisfied the spec, `ask` when it did not.
 */
export interface DrilldownHandoff {
  title: string;
  sql?: string;
  ask?: string;
}

/** Builds the app-local href for a target. Apps without Spindle omit it. */
export type DrilldownHrefBuilder = (target: DrilldownTarget) => string;

/** The live schema a resolution is checked against. */
export type DrilldownSchema = readonly DatasourceSchema[];
