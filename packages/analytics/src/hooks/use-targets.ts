import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { DateRange, TargetsByTypeRow, TargetsSummaryRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useTargetsSummary(dateRange: DateRange, options?: { enabled?: boolean }) {
  return useTinybirdQuery<typeof PIPES.TARGETS_SUMMARY, TargetsSummaryRow>(
    PIPES.TARGETS_SUMMARY,
    { start_date: dateRange.startDate, end_date: dateRange.endDate },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.trend }
  );
}

export function useTargetsByType(dateRange: DateRange, options?: { enabled?: boolean }) {
  return useTinybirdQuery<typeof PIPES.TARGETS_BY_TYPE, TargetsByTypeRow>(
    PIPES.TARGETS_BY_TYPE,
    { start_date: dateRange.startDate, end_date: dateRange.endDate },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.distribution }
  );
}
