/**
 * Date Utilities Module
 *
 * Type-safe date handling utilities using date-fns.
 *
 * - API types use `string` (ISO 8601 format) for JSON serialization
 * - UI components use native `Date` objects
 * - This module bridges the gap with type-safe conversions
 */

import { format, formatDistanceToNow, formatISO, isSameDay, isValid, parseISO } from "date-fns";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * ISO 8601 DateTime string type
 * Used in API types for JSON serialization
 *
 * @example "2025-10-30T22:08:25Z" or "2025-10-30T22:08:25.123Z"
 */
export type ISODateTime = string;

/**
 * ISO 8601 Date string type (date only, no time)
 *
 * @example "2025-10-30"
 */
export type ISODate = string;

// =============================================================================
// PARSING FUNCTIONS (API → UI)
// =============================================================================

/**
 * Safely parse an ISO 8601 datetime string to a Date object
 * Returns null if the string is invalid or undefined
 *
 * @param isoString - ISO 8601 datetime string
 * @returns Date object or null
 *
 * @example
 * const date = parseISODateTime("2025-10-30T22:08:25Z")
 * // Date object
 *
 * const invalid = parseISODateTime("invalid")
 * // null
 */
export function parseISODateTime(isoString: string | undefined | null): Date | null {
  if (!isoString) return null;

  try {
    const date = parseISO(isoString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

// =============================================================================
// FORMATTING FUNCTIONS (UI → API or Display)
// =============================================================================

/**
 * Convert a Date object to an ISO 8601 datetime string
 * Returns null if the date is invalid or undefined
 *
 * @param date - Date object
 * @returns ISO 8601 datetime string or null
 *
 * @example
 * const isoString = toISODateTime(new Date())
 * // "2025-10-30T22:08:25.123Z"
 */
export function toISODateTime(date: Date | undefined | null): ISODateTime | null {
  if (!date || !isValid(date)) return null;

  return formatISO(date);
}

/**
 * Format a date for display (short format)
 *
 * @param dateOrString - Date object or ISO string
 * @returns Formatted date string
 *
 * @example
 * formatShortDate(new Date()) // "Jan 8, 2026"
 * formatShortDate("2025-10-30T22:08:25Z") // "Oct 30, 2025"
 */
export function formatShortDate(dateOrString: Date | string | undefined | null): string {
  if (!dateOrString) return "";

  const date = typeof dateOrString === "string" ? parseISODateTime(dateOrString) : dateOrString;
  if (!date || !isValid(date)) return "";

  return format(date, "MMM d, yyyy");
}

/**
 * Format a date for datetime display
 *
 * @param dateOrString - Date object or ISO string
 * @returns Formatted datetime string
 *
 * @example
 * formatDateTime(new Date()) // "Jan 8, 2026 at 10:08 AM"
 */
export function formatDateTime(dateOrString: Date | string | undefined | null): string {
  if (!dateOrString) return "";

  const date = typeof dateOrString === "string" ? parseISODateTime(dateOrString) : dateOrString;
  if (!date || !isValid(date)) return "";

  return format(date, "PPP 'at' p");
}

/**
 * Format an upcoming moment as a clock time, with the weekday when it falls on
 * a different local day than `now`.
 *
 * @example
 * formatUpcomingTime(laterToday) // "8:00 PM"
 * formatUpcomingTime(tomorrow) // "Thursday 12:00 AM"
 */
export function formatUpcomingTime(date: Date, now: Date = new Date()): string {
  if (!isValid(date)) return "";
  return format(date, isSameDay(date, now) ? "p" : "EEEE p");
}

/**
 * Format a date using a custom format string
 *
 * @param dateOrString - Date object or ISO string
 * @param formatString - date-fns format string
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date(), "yyyy-MM-dd") // "2026-01-08"
 * formatDate(new Date(), "MMMM do, yyyy") // "January 8th, 2026"
 */
export function formatDate(
  dateOrString: Date | string | undefined | null,
  formatString: string = "PPP"
): string {
  if (!dateOrString) return "";

  const date = typeof dateOrString === "string" ? parseISODateTime(dateOrString) : dateOrString;
  if (!date || !isValid(date)) return "";

  return format(date, formatString);
}

/**
 * Format a relative time description
 *
 * @param dateOrString - Date object or ISO string
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime(someDate) // "2 days ago" or "in 3 hours"
 */
export function formatRelativeTime(dateOrString: Date | string | undefined | null): string {
  if (!dateOrString) return "";

  const date = typeof dateOrString === "string" ? parseISODateTime(dateOrString) : dateOrString;
  if (!date || !isValid(date)) return "";

  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format a date range for display
 *
 * @param startDateOrString - Start date object or ISO string
 * @param endDateOrString - End date object or ISO string
 * @param separator - Separator between dates (default: " – ")
 * @returns Formatted date range string
 *
 * @example
 * formatDateRange("2025-01-01", "2025-01-31") // "Jan 1, 2025 – Jan 31, 2025"
 * formatDateRange(startDate, endDate, " to ") // "Jan 1, 2025 to Jan 31, 2025"
 */
export function formatDateRange(
  startDateOrString: Date | string | undefined | null,
  endDateOrString: Date | string | undefined | null,
  separator: string = " – "
): string {
  const start = formatShortDate(startDateOrString);
  const end = formatShortDate(endDateOrString);

  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;

  return `${start}${separator}${end}`;
}

// =============================================================================
// RANGE / COMPARISON FUNCTIONS
// =============================================================================

/**
 * Check whether the current moment falls within an optional date range.
 *
 * - If `start` is provided and is in the future → `false`
 * - If `end` is provided and is in the past → `false`
 * - Otherwise → `true`
 *
 * Accepts ISO strings or Date objects (consistent with other date utilities).
 *
 * @example
 * isWithinDateRange("2025-01-01", "2025-12-31") // true if now is in 2025
 * isWithinDateRange(undefined, "2020-01-01")     // false (ended in the past)
 * isWithinDateRange(undefined, undefined)         // true  (no bounds)
 */
export function isWithinDateRange(
  start?: Date | string | null,
  end?: Date | string | null
): boolean {
  const now = new Date();

  if (start) {
    const startDate = typeof start === "string" ? parseISODateTime(start) : start;
    if (startDate && startDate > now) return false;
  }

  if (end) {
    const endDate = typeof end === "string" ? parseISODateTime(end) : end;
    if (endDate && endDate < now) return false;
  }

  return true;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a string is a valid ISO 8601 datetime
 *
 * @param isoString - ISO 8601 datetime string
 * @returns true if valid
 */
export function isValidISODateTime(isoString: string | undefined | null): boolean {
  return parseISODateTime(isoString) !== null;
}
