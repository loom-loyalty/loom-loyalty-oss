import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { CouponsByOfferRow, CouponsSummaryRow, DateRange, OfferSummaryRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useOfferSummary(
  dateRange: DateRange,
  options?: { enabled?: boolean; limit?: number }
) {
  return useTinybirdQuery<typeof PIPES.OFFER_SUMMARY, OfferSummaryRow>(
    PIPES.OFFER_SUMMARY,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      limit: options?.limit,
    },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.trend }
  );
}

export function useCouponsSummary(dateRange: DateRange, options?: { enabled?: boolean }) {
  return useTinybirdQuery<typeof PIPES.COUPONS_SUMMARY, CouponsSummaryRow>(
    PIPES.COUPONS_SUMMARY,
    { start_date: dateRange.startDate, end_date: dateRange.endDate },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.trend }
  );
}

export function useCouponsByOffer(
  dateRange: DateRange,
  options?: { enabled?: boolean; limit?: number }
) {
  return useTinybirdQuery<typeof PIPES.COUPONS_BY_OFFER, CouponsByOfferRow>(
    PIPES.COUPONS_BY_OFFER,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      limit: options?.limit,
    },
    { enabled: options?.enabled, staleTime: DEFAULT_STALE_TIMES.trend }
  );
}
