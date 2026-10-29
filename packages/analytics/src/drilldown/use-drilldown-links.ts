/**
 * Analytics drill-down — link building for chart sections
 *
 * Charts need two hrefs: one for the whole result, one per clicked item. This
 * turns the app-supplied href builder plus the page's active filters into those
 * two functions, and returns `undefined` for either when no drill-down exists —
 * which is what keeps the affordance off charts that cannot support it, and off
 * apps that ship no SQL workbench at all.
 */
import { useMemo } from "react";

import { getDrilldownSpec } from "./registry";
import { supportsItemDrilldown } from "./resolve";
import type {
  DrilldownContext,
  DrilldownDatum,
  DrilldownHrefBuilder,
  DrilldownTarget,
} from "./types";

export interface DrilldownLinks {
  /** Href for a chart's whole result, or `undefined` if it has no drill-down. */
  chartHref: (pipe: string) => string | undefined;
  /** Href for one datum, or `undefined` if the chart has no item-level drill. */
  itemHref: (pipe: string, datum: DrilldownDatum) => string | undefined;
}

const NO_LINKS: DrilldownLinks = {
  chartHref: () => undefined,
  itemHref: () => undefined,
};

export function useDrilldownLinks(
  buildHref: DrilldownHrefBuilder | undefined,
  context: DrilldownContext
): DrilldownLinks {
  const { startDate, endDate, granularity, currencyCode } = context;

  return useMemo(() => {
    if (!buildHref) return NO_LINKS;
    const resolved: DrilldownContext = { startDate, endDate, granularity, currencyCode };

    const target = (
      pipe: string,
      level: DrilldownTarget["level"],
      datum?: DrilldownDatum
    ): DrilldownTarget => ({ pipe, level, title: "", context: resolved, datum });

    return {
      chartHref: (pipe) => (getDrilldownSpec(pipe) ? buildHref(target(pipe, "chart")) : undefined),
      itemHref: (pipe, datum) =>
        supportsItemDrilldown(pipe) ? buildHref(target(pipe, "item", datum)) : undefined,
    };
  }, [buildHref, startDate, endDate, granularity, currencyCode]);
}
