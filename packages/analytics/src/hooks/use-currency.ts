import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type {
  CurrencyByDescriptionRow,
  CurrencyTotalsRow,
  CurrencyTrendRow,
  DateRange,
} from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useCurrencyTotals(dateRange: DateRange, period?: string, currencyCode?: string) {
  return useTinybirdQuery<typeof PIPES.CURRENCY_TOTALS, CurrencyTotalsRow>(
    PIPES.CURRENCY_TOTALS,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      period,
      currency_code: currencyCode,
    },
    { staleTime: DEFAULT_STALE_TIMES.trend }
  );
}

export function useCurrencyTrend(
  dateRange: DateRange,
  granularity?: string,
  period?: string,
  currencyCode?: string
) {
  return useTinybirdQuery<typeof PIPES.CURRENCY_TREND, CurrencyTrendRow>(
    PIPES.CURRENCY_TREND,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      granularity,
      period,
      currency_code: currencyCode,
    },
    { staleTime: DEFAULT_STALE_TIMES.trend }
  );
}

export function useCurrencyByDescription(
  dateRange: DateRange,
  period?: string,
  currencyCode?: string
) {
  return useTinybirdQuery<typeof PIPES.CURRENCY_BY_DESCRIPTION, CurrencyByDescriptionRow>(
    PIPES.CURRENCY_BY_DESCRIPTION,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      period,
      currency_code: currencyCode,
    },
    { staleTime: DEFAULT_STALE_TIMES.distribution }
  );
}
