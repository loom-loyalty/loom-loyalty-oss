import { useMemo } from "react";

import { DEFAULT_STALE_TIMES } from "../constants";
import { cohortToDateRange } from "../lib/cohort";
import { PIPES, type PipeParams } from "../pipes";
import type { CohortFilter, CustomerRevenueDecileRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export interface RevenueDecileParams {
  metricRole: "REVENUE" | "COST" | "MARGIN";
  scope: "all" | "earning";
}

function buildDecileParams(
  cohort: CohortFilter,
  { metricRole, scope }: RevenueDecileParams
): PipeParams[typeof PIPES.CUSTOMER_REVENUE_DECILE] {
  const base: PipeParams[typeof PIPES.CUSTOMER_REVENUE_DECILE] = {
    metric_role: metricRole,
    scope,
  };
  if (cohort.kind === "all") return base;
  // Emit explicit start_date/end_date for non-'all' kinds so the queryKey
  // aligns with useComparison's queryKey (TanStack Query dedupes the
  // duplicate "current period" fetch).
  const range = cohortToDateRange(cohort);
  return range ? { ...base, ...range } : base;
}

export function useCustomerRevenueDecile(
  cohort: CohortFilter,
  params: RevenueDecileParams,
  options?: { enabled?: boolean }
) {
  // Memoize so the date conversion is stable per (cohort, metricRole, scope) tuple.
  const queryParams = useMemo(
    () => buildDecileParams(cohort, params),
    [cohort, params.metricRole, params.scope]
  );
  return useTinybirdQuery<typeof PIPES.CUSTOMER_REVENUE_DECILE, CustomerRevenueDecileRow>(
    PIPES.CUSTOMER_REVENUE_DECILE,
    queryParams,
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.summary }
  );
}
