import { format, subDays } from "date-fns";

import type { CohortFilter } from "../types";

const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 } as const;

/**
 * Converts a CohortFilter to an explicit `{ start_date, end_date }` pair.
 *
 * Returns `null` for `kind: 'all'` — the snapshot path needs no date params
 * and pipes treat the absence of dates as "current snapshot of all customers."
 *
 * The 'period' kind is computed against wallclock at call time. **Callers
 * should wrap the result in `useMemo([cohort])`** so the dates stay stable
 * for the lifetime of a single cohort selection — otherwise every render
 * produces fresh millisecond-resolution dates, the TanStack Query queryKey
 * churns, and the pipe refetches indefinitely.
 *
 * The funnel + decile hooks pre-compute via this function so their queryKeys
 * align with useComparison's queryKey (which also uses start_date/end_date),
 * letting TanStack Query dedupe the duplicate "current period" fetch.
 */
export function cohortToDateRange(
  cohort: CohortFilter
): { start_date: string; end_date: string } | null {
  if (cohort.kind === "all") return null;
  if (cohort.kind === "range") {
    return { start_date: cohort.start_date, end_date: cohort.end_date };
  }
  const end = new Date();
  const start = subDays(end, PERIOD_DAYS[cohort.period]);
  return {
    start_date: format(start, "yyyy-MM-dd"),
    end_date: format(end, "yyyy-MM-dd"),
  };
}
