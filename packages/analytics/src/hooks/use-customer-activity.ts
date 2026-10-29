import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { CustomerActivityRow, DateRange } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useCustomerActivity(
  dateRange: DateRange,
  options?: {
    enabled?: boolean;
    event_type_code?: string;
    entity_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
) {
  return useTinybirdQuery<typeof PIPES.CUSTOMER_ACTIVITY, CustomerActivityRow>(
    PIPES.CUSTOMER_ACTIVITY,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      event_type_code: options?.event_type_code,
      entity_type: options?.entity_type,
      status: options?.status,
      limit: options?.limit,
      offset: options?.offset,
    },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.activity }
  );
}
