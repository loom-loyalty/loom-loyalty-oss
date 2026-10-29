/**
 * Analytics Controls Bar
 *
 * Date range picker, granularity toggle, and comparison switch.
 */
import {
  CompareToggle,
  CurrencySelect,
  DateRangePicker,
  GranularityToggle,
} from "@loom-loyalty/ui/analytics";
import type { ReactNode } from "react";
import { useCallback } from "react";

import { DATE_PRESETS } from "../constants";
import type { DatePreset, DateRange, Granularity } from "../types";

interface AnalyticsControlsProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  granularity: Granularity;
  onGranularityChange: (g: string) => void;
  compareEnabled: boolean;
  onCompareChange: (enabled: boolean) => void;
  /** Available currency codes; the selector hides itself when there are ≤1. */
  currencyCodes: string[];
  /** The effective (selected or primary) currency code shown in the selector. */
  currencyCode: string | undefined;
  onCurrencyCodeChange: (code: string) => void;
}

export function AnalyticsControls({
  dateRange,
  onDateRangeChange,
  granularity,
  onGranularityChange,
  compareEnabled,
  onCompareChange,
  currencyCodes,
  currencyCode,
  onCurrencyCodeChange,
}: AnalyticsControlsProps): ReactNode {
  const handleDateChange = useCallback(
    (range: { startDate: string; endDate: string; preset: string; label: string }) => {
      onDateRangeChange({ ...range, preset: range.preset as DatePreset });
    },
    [onDateRangeChange]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePicker value={dateRange} onChange={handleDateChange} presets={DATE_PRESETS} />
      <GranularityToggle value={granularity} onChange={onGranularityChange} />
      <CurrencySelect value={currencyCode} onChange={onCurrencyCodeChange} codes={currencyCodes} />
      <CompareToggle enabled={compareEnabled} onChange={onCompareChange} />
    </div>
  );
}
