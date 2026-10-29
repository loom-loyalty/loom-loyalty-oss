import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { BadgesIssuedRow, DateRange } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useBadgesIssued(
  dateRange: DateRange,
  options?: { enabled?: boolean; period?: string }
) {
  return useTinybirdQuery<typeof PIPES.BADGES_ISSUED, BadgesIssuedRow>(
    PIPES.BADGES_ISSUED,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      period: options?.period,
    },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.trend }
  );
}
