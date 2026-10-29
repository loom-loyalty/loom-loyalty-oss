import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { DateRange, EventVolumeRow, Granularity } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useEventVolume(
  dateRange: DateRange,
  options?: {
    enabled?: boolean;
    granularity?: Granularity;
    event_type_code?: string;
  }
) {
  return useTinybirdQuery<typeof PIPES.EVENT_VOLUME, EventVolumeRow>(
    PIPES.EVENT_VOLUME,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      granularity: options?.granularity,
      event_type_code: options?.event_type_code,
    },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.trend }
  );
}
