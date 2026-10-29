/**
 * Internationalization utilities for Loom Loyalty applications
 */

/**
 * Extract a display string from a localized description object.
 *
 * Checks for common locale keys (en-US, en) and returns the first
 * string value found, or an empty string if none match.
 */
export function extractLocalizedString(obj?: { [key: string]: unknown }): string {
  if (!obj) return "";
  const enUS = obj["en-US"];
  const en = obj["en"];
  if (typeof enUS === "string") return enUS;
  if (typeof en === "string") return en;
  return "";
}

/**
 * Extract a LocalizedString from an API description object.
 *
 * API responses store descriptions as `Record<string, unknown>` (the i18n
 * envelope). This helper safely narrows it to `Record<string, string>`,
 * filtering out any non-string values.
 *
 * Returns `undefined` if the input is empty or has no string values.
 */
export function parseLocalizedDescription(
  description?: Record<string, unknown>
): Record<string, string> | undefined {
  if (!description) return undefined;

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(description)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
