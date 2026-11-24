/**
 * Zone-aware date helpers for API instants.
 *
 * Use these, not `parseISODateTime` / `formatDate`, when a timestamp from the Platform API must be
 * shown in a specific IANA timezone (for example the member's phone zone), or when the code may run
 * on a server whose own clock zone is not the viewer's (a Cloudflare Worker runs in UTC).
 *
 * The difference from `parseISODateTime`: a timestamp with no offset is read as UTC here (the
 * Platform stores and sends UTC), while `parseISODateTime` reads it as the runtime's local time.
 *
 * `timeZone: undefined` means the runtime's default zone.
 */

const OFFSET_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Parses an API timestamp to an instant. No offset means UTC. Returns null for empty or invalid input. */
export function toInstant(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const withOffset = OFFSET_PATTERN.test(trimmed) ? trimmed : `${trimmed}Z`;
  // Date.parse handles at most millisecond precision; trim extra fractional digits first.
  const normalized = withOffset.replace(/(\.\d{3})\d+/, "$1");
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** The zone if Intl accepts it, else undefined (the runtime default). */
export function resolveTimeZone(timeZone: string | undefined | null): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return undefined;
  }
}

/**
 * Formats an instant (a Date or an API timestamp) in a zone with Intl options.
 * Returns "" for an invalid instant. Narrow no-break spaces some ICU builds put before AM/PM
 * become plain spaces.
 */
export function formatInZone(
  instant: Date | string | undefined | null,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US"
): string {
  const date = typeof instant === "string" || instant == null ? toInstant(instant) : instant;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: resolveTimeZone(timeZone) })
    .format(date)
    .replace(/\u202f/g, " ");
}

/** The local calendar date, YYYY-MM-DD, of an instant in a zone. */
export function localDayKey(date: Date, timeZone: string | undefined): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: resolveTimeZone(timeZone),
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    formatted.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Whether an API timestamp falls on the same local calendar day as `now`, in the zone. */
export function isSameLocalDay(
  iso: string | undefined | null,
  now: Date,
  timeZone: string | undefined
): boolean {
  const instant = toInstant(iso);
  if (!instant) return false;
  return localDayKey(instant, timeZone) === localDayKey(now, timeZone);
}
