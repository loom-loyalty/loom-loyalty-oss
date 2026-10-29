import { format, startOfQuarter, subDays, subMonths } from "date-fns";
import type { DatePreset, DateRange, Granularity } from "./types";

export const SESSIONSTORE_TOKEN_KEY = "loom_analytics_token";
export const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000;

export const DEFAULT_STALE_TIMES = {
  summary: 5 * 60 * 1000,
  trend: 10 * 60 * 1000,
  distribution: 10 * 60 * 1000,
  activity: 2 * 60 * 1000,
} as const;

export const GRANULARITY_OPTIONS: Array<{
  value: Granularity;
  label: string;
}> = [
  { value: "hourly", label: "Hour" },
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

export const DATE_PRESETS: Array<{
  key: DatePreset;
  label: string;
  resolve: () => { startDate: string; endDate: string };
}> = [
  {
    key: "7d",
    label: "Last 7 days",
    resolve: () => ({
      startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "30d",
    label: "Last 30 days",
    resolve: () => ({
      startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "90d",
    label: "Last 90 days",
    resolve: () => ({
      startDate: format(subDays(new Date(), 90), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "12m",
    label: "Last 12 months",
    resolve: () => ({
      startDate: format(subMonths(new Date(), 12), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "this_quarter",
    label: "This quarter",
    resolve: () => ({
      startDate: format(startOfQuarter(new Date()), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }),
  },
];

/** Format a number as a compact string (e.g. 1.2K, 3.5M) */
export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getDefaultDateRange(): DateRange {
  const preset = DATE_PRESETS.find((p) => p.key === "30d")!;
  const { startDate, endDate } = preset.resolve();
  return { startDate, endDate, preset: "30d", label: preset.label };
}
