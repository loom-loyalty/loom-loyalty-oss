/**
 * Shared analytics page state
 *
 * Manages date range, granularity, and comparison mode
 * for all analytics sections.
 */
import { useCallback, useState } from "react";

import { getDefaultDateRange } from "../constants";
import type { DateRange, Granularity } from "../types";

interface AnalyticsState {
  dateRange: DateRange;
  granularity: Granularity;
  compareEnabled: boolean;
  /** User's currency-code selection; undefined falls back to the primary code. */
  selectedCurrencyCode: string | undefined;
  setDateRange: (range: DateRange) => void;
  setGranularity: (granularity: Granularity) => void;
  setCompareEnabled: (enabled: boolean) => void;
  setSelectedCurrencyCode: (code: string | undefined) => void;
}

export function useAnalyticsState(): AnalyticsState {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string | undefined>(undefined);

  return {
    dateRange,
    granularity,
    compareEnabled,
    selectedCurrencyCode,
    setDateRange: useCallback((range: DateRange) => setDateRange(range), []),
    setGranularity: useCallback((g: Granularity) => setGranularity(g), []),
    setCompareEnabled: useCallback((e: boolean) => setCompareEnabled(e), []),
    setSelectedCurrencyCode: useCallback(
      (code: string | undefined) => setSelectedCurrencyCode(code),
      []
    ),
  };
}
