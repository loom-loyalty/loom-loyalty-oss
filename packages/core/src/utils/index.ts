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
  type ISODate,
  type ISODateTime,
} from "./dates";

export { extractLocalizedString, parseLocalizedDescription } from "./i18n";

export {
  GENERIC_ERROR_MESSAGE,
  describeError,
  type DescribeErrorOptions,
  type DescribedError,
  type ErrorCopyOverride,
} from "./describe-error";
