import { useMemo } from "react";

import { DEFAULT_STALE_TIMES } from "../constants";
import { cohortToDateRange } from "../lib/cohort";
import { PIPES, type PipeParams } from "../pipes";
import type { CohortFilter, CustomerFunnelRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

/**
 * Converts a CohortFilter into the pipe params shape, always emitting explicit
 * `start_date`/`end_date` for non-'all' kinds so the resulting queryKey aligns
 * with `useComparison`'s queryKey (which always uses explicit dates). This lets
 * TanStack Query dedupe the "current period" fetch when both
 * `useCustomerFunnel` and `useComparison` run on the same page.
 */
export function cohortToFunnelParams(
  cohort: CohortFilter
): PipeParams[typeof PIPES.CUSTOMER_FUNNEL] {
  if (cohort.kind === "all") return {};
  return cohortToDateRange(cohort) ?? {};
}

export function useCustomerFunnel(cohort: CohortFilter, options?: { enabled?: boolean }) {
  // Memoize so the date conversion runs once per cohort selection — otherwise
  // each render produces fresh dates and the queryKey churns.
  const params = useMemo(() => cohortToFunnelParams(cohort), [cohort]);
  return useTinybirdQuery<typeof PIPES.CUSTOMER_FUNNEL, CustomerFunnelRow>(
    PIPES.CUSTOMER_FUNNEL,
    params,
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.summary }
  );
}
