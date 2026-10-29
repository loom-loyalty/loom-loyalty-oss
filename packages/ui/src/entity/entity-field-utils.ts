/**
 * Utilities for accessing dynamic extended fields on SDK entity types.
 *
 * SDK entities have fixed types (e.g., Badge, ProgramCurrency) generated from
 * the OpenAPI spec, but extended fields from data model schemas are dynamic
 * properties not known at compile time. These utilities use Object.entries()
 * to safely extract values without unsafe casts.
 */

/**
 * Extract extended field values from a typed entity using Object.entries().
 * Returns a Record with only the specified field names extracted.
 *
 * This avoids `as unknown as Record<string, unknown>` casts by using
 * Object.entries() which works on any object and returns `[string, unknown][]`.
 */
export function extractExtendedFields(
  entity: object | undefined,
  fieldNames: string[]
): Record<string, unknown> {
  if (!entity) return {};
  const fieldSet = new Set(fieldNames);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity)) {
    if (fieldSet.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
