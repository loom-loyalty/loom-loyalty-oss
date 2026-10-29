import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { DateRange, TiersTotalRow, TiersTrendRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useTiersTotal(dateRange: DateRange) {
  return useTinybirdQuery<typeof PIPES.TIERS_TOTAL, TiersTotalRow>(
    PIPES.TIERS_TOTAL,
    { start_date: dateRange.startDate, end_date: dateRange.endDate },
    { staleTime: DEFAULT_STALE_TIMES.distribution }
  );
}

export function useTiersTrend(dateRange: DateRange, granularity?: string, period?: string) {
  return useTinybirdQuery<typeof PIPES.TIERS_TREND, TiersTrendRow>(
    PIPES.TIERS_TREND,
    { start_date: dateRange.startDate, end_date: dateRange.endDate, granularity, period },
    { staleTime: DEFAULT_STALE_TIMES.trend }
  );
}
