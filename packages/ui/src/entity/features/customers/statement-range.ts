/**
 * Date ranges for a member's statements (api#2695 slice 4b).
 *
 * The API writes a member's statement once a month, for the previous UTC
 * calendar month, and its list filter keeps only statements that lie wholly
 * inside the range (periodStart >= startDateTime, periodEnd <= endDateTime).
 * So ranges here are whole UTC days, and the presets are whole months.
 */

import { toISODateUTC } from "@loom-loyalty/core";

/** A statement range: inclusive UTC days as `yyyy-MM-dd`. */
export interface StatementRange {
  start: string;
  end: string;
}

/** A one-click range in the picker. */
export interface StatementRangePreset {
  key: string;
  label: string;
  resolve: () => { startDate: string; endDate: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC midnight of a `yyyy-MM-dd` day, or null when it isn't a real date. */
function parseUtcDay(day: string): number | null {
  const match = ISO_DAY.exec(day);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const ms = Date.UTC(y, m - 1, d);
  // Date.UTC rolls 2026-02-30 into 2026-03-02; a real date round-trips.
  return toISODateUTC(new Date(ms)) === day ? ms : null;
}

/** The last `months` full UTC calendar months before the month of `now`. */
function lastFullMonthsUtc(now: Date, months: number): StatementRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: toISODateUTC(new Date(Date.UTC(year, month - months, 1))),
    end: toISODateUTC(new Date(Date.UTC(year, month, 0))),
  };
}

/** The last 12 full UTC calendar months: the statements list's default range. */
export function lastTwelveMonthsUtc(now: Date): StatementRange {
  return lastFullMonthsUtc(now, 12);
}

/**
 * Why the range can't be sent, as a sentence for the user, or null when it can.
 */
export function validateStatementRange(start: string, end: string): string | null {
  const startMs = parseUtcDay(start);
  const endMs = parseUtcDay(end);
  if (startMs === null || endMs === null) return "Pick a start date and an end date.";
  if (endMs < startMs) return "The end date must be on or after the start date.";
  return null;
}

/**
 * The API's filter for a range: UTC midnight at the start, and the midnight
 * after the end day, since a statement's period end is the exclusive midnight.
 */
export function statementRangeQuery(range: StatementRange): {
  startDateTime: string;
  endDateTime: string;
} {
  const endMs = parseUtcDay(range.end) ?? Number.NaN;
  return {
    startDateTime: `${range.start}T00:00:00Z`,
    endDateTime: `${toISODateUTC(new Date(endMs + DAY_MS))}T00:00:00Z`,
  };
}

/** One-click ranges of whole months, each ending with last month. */
export function statementRangePresets(now: Date): StatementRangePreset[] {
  const preset = (key: string, label: string, range: StatementRange): StatementRangePreset => ({
    key,
    label,
    resolve: () => ({ startDate: range.start, endDate: range.end }),
  });
  const presets = [
    preset("last-3-months", "Last 3 months", lastFullMonthsUtc(now, 3)),
    preset("last-12-months", "Last 12 months", lastFullMonthsUtc(now, 12)),
    preset("last-24-months", "Last 24 months", lastFullMonthsUtc(now, 24)),
  ];
  const monthsThisYear = now.getUTCMonth();
  if (monthsThisYear > 0) {
    presets.push(preset("this-year", "This year", lastFullMonthsUtc(now, monthsThisYear)));
  }
  return presets;
}
