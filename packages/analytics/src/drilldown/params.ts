/**
 * Analytics drill-down — URL serialization
 *
 * The hand-off to Spindle carries the *target* — which pipe, which item, over
 * what range — rather than the generated SQL. Three reasons: the URL stays
 * short and legible, resolution happens where the live datasource schema is
 * known to be loaded, and a shared link keeps meaning after the SQL a spec
 * generates changes.
 */
import type { Granularity } from "../types";
import type { DrilldownContext, DrilldownTarget } from "./types";

export const DRILLDOWN_PARAM_KEYS = [
  "pipe",
  "level",
  "value",
  "label",
  "start",
  "end",
  "granularity",
  "currency",
] as const;

export type DrilldownSearch = Partial<Record<(typeof DRILLDOWN_PARAM_KEYS)[number], string>>;

const GRANULARITIES: Granularity[] = ["hourly", "daily", "weekly", "monthly"];

/** `yyyy-MM-dd`, the shape every analytics date control produces. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toDrilldownSearch(target: DrilldownTarget): DrilldownSearch {
  const search: DrilldownSearch = {
    pipe: target.pipe,
    level: target.level,
    start: target.context.startDate,
    end: target.context.endDate,
  };
  if (target.context.granularity) search.granularity = target.context.granularity;
  if (target.context.currencyCode) search.currency = target.context.currencyCode;
  if (target.datum) {
    search.value = target.datum.value;
    search.label = target.datum.label;
  }
  return search;
}

/** Serializes a target onto a path, ready to use as an href. */
export function buildDrilldownPath(basePath: string, target: DrilldownTarget): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toDrilldownSearch(target))) {
    if (value) params.set(key, value);
  }
  return `${basePath}?${params.toString()}`;
}

/**
 * Parses search params back into a target, returning `null` when they do not
 * describe one. Every field is validated rather than trusted: these params are
 * user-editable, and a malformed date reaching the SQL builders would produce a
 * query that fails at TinyBird with an error the user cannot act on. Rejecting
 * here means Spindle simply opens empty instead.
 */
export function parseDrilldownSearch(search: DrilldownSearch): DrilldownTarget | null {
  const { pipe, level, start, end, value, label, granularity, currency } = search;
  if (!pipe || !start || !end) return null;
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return null;

  const resolvedLevel = level === "item" ? "item" : "chart";
  // An item target without a value has nothing to filter on; treating it as a
  // chart target would answer a broader question than the link promised.
  if (resolvedLevel === "item" && !value) return null;

  const context: DrilldownContext = { startDate: start, endDate: end };
  if (granularity && (GRANULARITIES as string[]).includes(granularity)) {
    context.granularity = granularity as Granularity;
  }
  if (currency) context.currencyCode = currency;

  return {
    pipe,
    level: resolvedLevel,
    title: "",
    context,
    datum: value ? { value, label: label ?? value } : undefined,
  };
}
