import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { DateRange, TopCustomersByCurrencyRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useTopCustomersByCurrency(
  dateRange: DateRange,
  options?: { enabled?: boolean; limit?: number; currencyCode?: string }
) {
  return useTinybirdQuery<typeof PIPES.TOP_CUSTOMERS_BY_CURRENCY, TopCustomersByCurrencyRow>(
    PIPES.TOP_CUSTOMERS_BY_CURRENCY,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      limit: options?.limit,
      currency_code: options?.currencyCode,
    },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.trend }
  );
}
