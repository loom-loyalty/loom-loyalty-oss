/**
 * Utility functions for Loom Loyalty applications
 */

export {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatRelativeTime,
  formatShortDate,
  formatUpcomingTime,
  isValidISODateTime,
  isWithinDateRange,
  parseISODateTime,
  toISODateTime,
  toISODateUTC,
  type FormatDateOptions,
  type ISODate,
  type ISODateTime,
} from "./dates";

export {
  formatInZone,
  isSameLocalDay,
  localDayKey,
  resolveTimeZone,
  toInstant,
} from "./zoned-dates";

export { extractLocalizedString, parseLocalizedDescription } from "./i18n";
export {
  SAFE_MARKDOWN_ALLOWED_ELEMENTS,
  isSafeMarkdownUrl,
  normalizeLocaleKey,
  pickLocalizedText,
  safeMarkdownUrlTransform,
  type LocalizedText,
} from "./localized-text";

export {
  DEFAULT_PREFERRED_LANGUAGE,
  PREFERRED_LANGUAGE_OPTIONS,
  type PreferredLanguageCode,
} from "./preferred-language";

export {
  GENERIC_ERROR_MESSAGE,
  describeError,
  type DescribeErrorOptions,
  type DescribedError,
  type ErrorCopyOverride,
} from "./describe-error";
