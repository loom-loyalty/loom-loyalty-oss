import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { DashboardSummaryRow, DateRange } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useDashboardSummary(dateRange: DateRange, period?: string) {
  return useTinybirdQuery<typeof PIPES.DASHBOARD_SUMMARY, DashboardSummaryRow>(
    PIPES.DASHBOARD_SUMMARY,
    { start_date: dateRange.startDate, end_date: dateRange.endDate, period },
    { staleTime: DEFAULT_STALE_TIMES.summary }
  );
}
