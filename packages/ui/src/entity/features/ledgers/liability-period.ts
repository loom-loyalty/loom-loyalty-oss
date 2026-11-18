/**
 * Periods for a program ledger's liability report.
 *
 * The API counts in UTC days and answers 400 unless periodStart <= periodEnd,
 * periodEnd is before today (UTC), and the period is at most 366 days long.
 * These helpers build and check periods by the same rule, so the Hub never
 * sends a request the API would refuse.
 */

import { toISODateUTC } from "@loom-loyalty/core";

/** A liability report period: inclusive UTC days as `yyyy-MM-dd`. */
export interface LiabilityPeriod {
  start: string;
  end: string;
}

/** A one-click period in the picker. */
export interface LiabilityPeriodPreset {
  key: string;
  label: string;
  resolve: () => { startDate: string; endDate: string };
}

/** Longest period the API accepts, in days, start and end included. */
export const MAX_LIABILITY_PERIOD_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC midnight of a `yyyy-MM-dd` day, or null when it isn't a real date. */
function parseUtcDay(day: string): number | null {
  const match = ISO_DAY.exec(day);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const ms = Date.UTC(y, m - 1, d);
  // Date.UTC rolls 2026-13-01 into 2027-01-01; a real date round-trips.
  return toISODateUTC(new Date(ms)) === day ? ms : null;
}

/** First and last day of the UTC month `monthOffset` months from the month of `ms`. */
function utcMonth(ms: number, monthOffset: number): LiabilityPeriod {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + monthOffset;
  return {
    start: toISODateUTC(new Date(Date.UTC(year, month, 1))),
    end: toISODateUTC(new Date(Date.UTC(year, month + 1, 0))),
  };
}

/** The UTC midnight that starts today's UTC day. */
function utcToday(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** The last full calendar month (UTC) before `now`: the report's default period. */
export function lastFullMonthUtc(now: Date): LiabilityPeriod {
  return utcMonth(utcToday(now), -1);
}

/** The calendar month before the one `period` starts in. */
export function monthBefore(period: LiabilityPeriod): LiabilityPeriod {
  const start = parseUtcDay(period.start);
  return start === null ? period : utcMonth(start, -1);
}

/**
 * Why the API would refuse this period, as a sentence for the user, or null
 * when it would accept it.
 */
export function validateLiabilityPeriod(start: string, end: string, now: Date): string | null {
  const startMs = parseUtcDay(start);
  const endMs = parseUtcDay(end);
  if (startMs === null || endMs === null) return "Pick a start date and an end date.";
  if (endMs < startMs) return "The end date must be on or after the start date.";
  if (endMs >= utcToday(now)) return "The period must end before today (UTC).";
  if ((endMs - startMs) / DAY_MS + 1 > MAX_LIABILITY_PERIOD_DAYS) {
    return `The period can be at most ${MAX_LIABILITY_PERIOD_DAYS} days long.`;
  }
  return null;
}

/** One-click periods, each valid at `now`. */
export function liabilityPeriodPresets(now: Date): LiabilityPeriodPreset[] {
  const today = utcToday(now);
  const yesterday = toISODateUTC(new Date(today - DAY_MS));
  const lastMonth = utcMonth(today, -1);
  const monthBeforeLast = utcMonth(today, -2);
  const presets: LiabilityPeriodPreset[] = [
    {
      key: "last-month",
      label: "Last month",
      resolve: () => ({ startDate: lastMonth.start, endDate: lastMonth.end }),
    },
    {
      key: "month-before",
      label: "Month before last",
      resolve: () => ({ startDate: monthBeforeLast.start, endDate: monthBeforeLast.end }),
    },
    {
      key: "last-30-days",
      label: "Last 30 days",
      resolve: () => ({
        startDate: toISODateUTC(new Date(today - 30 * DAY_MS)),
        endDate: yesterday,
      }),
    },
  ];
  const yearStart = Date.UTC(new Date(today).getUTCFullYear(), 0, 1);
  if (yearStart < today) {
    presets.push({
      key: "year-to-date",
      label: "Year to date",
      resolve: () => ({ startDate: toISODateUTC(new Date(yearStart)), endDate: yesterday }),
    });
  }
  return presets;
}
