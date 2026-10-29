/**
 * Analytics drill-down — resolution
 *
 * Turns a `DrilldownTarget` into the hand-off Spindle receives, choosing SQL or
 * a natural-language question based on whether the *live* schema can support the
 * query. The schema arrives from the token endpoint at runtime and varies with
 * an organization's entitlements, so this check is what stops a drill-down from
 * proposing SQL over a table the caller cannot see.
 */
import { getDrilldownSpec } from "./registry";
import type { DrilldownHandoff, DrilldownSchema, DrilldownSpec, DrilldownTarget } from "./types";

/**
 * True when every datasource a spec names is present in the schema *and* carries
 * every column the generated SQL references. Column presence matters as much as
 * table presence: a datasource that exists with a narrower column set produces a
 * query that fails at execution rather than one that simply returns nothing.
 */
export function schemaSatisfies(spec: DrilldownSpec, schema: DrilldownSchema): boolean {
  return spec.requires.every((requirement) => {
    const datasource = schema.find((entry) => entry.name === requirement.datasource);
    if (!datasource) return false;
    const columns = new Set(datasource.columns.map((column) => column.name));
    return requirement.columns.every((column) => columns.has(column));
  });
}

/**
 * Resolves a target against the live schema.
 *
 * Returns `null` for an unregistered pipe so callers render no affordance at
 * all — an "Explore" link that leads to an empty workbench is worse than none.
 *
 * An item-level target on a spec with no `buildItemSql` degrades to that spec's
 * question rather than silently widening to the chart-level SQL: the user asked
 * about one offer, and handing back every offer would misrepresent what they
 * clicked.
 */
export function resolveDrilldown(
  target: DrilldownTarget,
  schema: DrilldownSchema
): DrilldownHandoff | null {
  const spec = getDrilldownSpec(target.pipe);
  if (!spec) return null;

  const title = target.datum ? `${spec.title} — ${target.datum.label}` : spec.title;

  if (schemaSatisfies(spec, schema)) {
    if (target.level === "item" && target.datum && spec.buildItemSql) {
      return { title, sql: spec.buildItemSql(target.context, target.datum) };
    }
    if (target.level === "chart" && spec.buildSql) {
      return { title, sql: spec.buildSql(target.context) };
    }
  }

  return { title, ask: spec.buildAsk(target.context, target.datum) };
}

/**
 * Whether a chart should offer item-level drilling at all. Charts whose spec has
 * no `buildItemSql` still resolve (as a question), but only those that can name a
 * dimension produce a coherent per-item ask — so the affordance is gated on the
 * spec knowing what one item *is*.
 */
export function supportsItemDrilldown(pipe: string): boolean {
  const spec = getDrilldownSpec(pipe);
  return spec !== undefined && spec.dimensionLabel !== undefined;
}
