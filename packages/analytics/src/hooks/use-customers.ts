import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type {
  CustomersByStatusRow,
  CustomersTotalRow,
  CustomersTrendRow,
  DateRange,
} from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useCustomersTotal(dateRange: DateRange, period?: string) {
  return useTinybirdQuery<typeof PIPES.CUSTOMERS_TOTAL, CustomersTotalRow>(
    PIPES.CUSTOMERS_TOTAL,
    { start_date: dateRange.startDate, end_date: dateRange.endDate, period },
    { staleTime: DEFAULT_STALE_TIMES.summary }
  );
}

export function useCustomersTrend(dateRange: DateRange, granularity?: string, period?: string) {
  return useTinybirdQuery<typeof PIPES.CUSTOMERS_TREND, CustomersTrendRow>(
    PIPES.CUSTOMERS_TREND,
    { start_date: dateRange.startDate, end_date: dateRange.endDate, granularity, period },
    { staleTime: DEFAULT_STALE_TIMES.trend }
  );
}

export function useCustomersByStatus(dateRange: DateRange) {
  return useTinybirdQuery<typeof PIPES.CUSTOMERS_BY_STATUS, CustomersByStatusRow>(
    PIPES.CUSTOMERS_BY_STATUS,
    { start_date: dateRange.startDate, end_date: dateRange.endDate },
    { staleTime: DEFAULT_STALE_TIMES.distribution }
  );
}
