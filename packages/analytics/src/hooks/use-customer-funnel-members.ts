import { useMemo } from "react";

import { DEFAULT_STALE_TIMES } from "../constants";
import { cohortToDateRange } from "../lib/cohort";
import { PIPES, type PipeParams } from "../pipes";
import type { CohortFilter, CustomerFunnelMemberRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

/**
 * Mirror of cohortToFunnelParams but typed for the MEMBERS pipe explicitly. Defined
 * separately so future param drift on either pipe (e.g. BE #874 adds stage_order /
 * limit / offset to MEMBERS) is caught by TypeScript instead of silently swallowed
 * by a cross-pipe `as` cast.
 */
function cohortToFunnelMembersParams(
  cohort: CohortFilter
): PipeParams[typeof PIPES.CUSTOMER_FUNNEL_MEMBERS] {
  if (cohort.kind === "all") return {};
  return cohortToDateRange(cohort) ?? {};
}

/**
 * v1: returns every member row (one per customer) with their stage_order. Aggregate
 * stats (count per stage) come from useCustomerFunnel; this hook is only useful for
 * drill-in member lists once BE adds stage_order/limit/offset params (issue #874).
 *
 * Until then, prefer calling useCustomerFunnel for the funnel viz and only use this
 * hook in the drill-in panel — and only when the tenant is small enough that the
 * full member list is OK over the wire. For large tenants, leave the drill-in panel
 * showing aggregate-only stats (count + pct from the funnel pipe) in v1.
 */
export function useCustomerFunnelMembers(cohort: CohortFilter, options?: { enabled?: boolean }) {
  // Memoize so the date conversion is stable per cohort selection.
  const params = useMemo(() => cohortToFunnelMembersParams(cohort), [cohort]);
  return useTinybirdQuery<typeof PIPES.CUSTOMER_FUNNEL_MEMBERS, CustomerFunnelMemberRow>(
    PIPES.CUSTOMER_FUNNEL_MEMBERS,
    params,
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.summary }
  );
}
