/**
 * BE typeReference → FE FieldDataType resolver.
 *
 * The BE manifest emits string typeReferences (STRING, LOCALIZED_STRING,
 * ENTITY_ID, METADATA, plus ~10 fall-through codes). This resolver converts
 * them losslessly into FieldDataType, preserving the original typeReference
 * so consumers can render unknown types with custom widgets later.
 *
 * Falls through unrecognized typeReferences to "string" with a once-per-code
 * console.warn so unmapped codes are surfaced without spamming dev consoles.
 */

import type { FieldDataType } from "../types/schema.js";

export interface ResolvedTypeReference {
  type: FieldDataType;
  originalTypeReference: string;
}

const STATIC_TYPE_MAP: Record<string, FieldDataType> = {
  STRING: "string",
  TEXT: "text",
  INTEGER: "integer",
  DECIMAL: "number",
  NUMBER: "number",
  BOOLEAN: "boolean",
  DATE: "date",
  DATE_TIME: "datetime",
  TIME: "time",
  EMAIL: "email",
  URL: "url",
  UUID: "uuid",
  JSON: "json",
  ARRAY: "array",
  OBJECT: "object",
  LOCALIZED_STRING: "localized_string",
  ENTITY_ID: "reference",
  METADATA: "metadata",
  FIAT_CURRENCY: "fiat_currency",
};

const warnedTypeReferences = new Set<string>();

export function resolveTypeReference(typeRef: string): ResolvedTypeReference {
  const upper = typeRef.toUpperCase().replace(/-/g, "_");
  const mapped = STATIC_TYPE_MAP[upper];
  if (mapped) return { type: mapped, originalTypeReference: upper };

  if (!warnedTypeReferences.has(upper)) {
    warnedTypeReferences.add(upper);
    console.warn(
      `[resolveTypeReference] unmapped typeReference "${upper}" falling back to string. Add a mapping if a typed widget is needed.`
    );
  }
  return { type: "string", originalTypeReference: upper };
}

/** Test-only hook to reset the dedup state between cases. */
export function __resetResolvedTypeReferenceWarnings(): void {
  warnedTypeReferences.clear();
}
