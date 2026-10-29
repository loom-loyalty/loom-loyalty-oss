/**
 * Entity-ID prefix → entity code mapping.
 *
 * The BE manifest emits ENTITY_ID typeReferences with no separate `entityCode`
 * field; the only signal is the `outputExample` value, whose prefix encodes
 * the entity (e.g., `ofr_550e...` is an OFFER, `prog_...` is a PROGRAM).
 * This module owns the mapping and the helper that derives entityCode from
 * a sample value.
 *
 * Prefixes are sourced from `test-snapshots/manifest/*.json`. Add new entries
 * as the manifest snapshot scope expands — unknown prefixes fall through to
 * undefined so the renderer can degrade gracefully.
 */

export const ENTITY_PREFIX_MAP: Record<string, string> = {
  cofr: "COUPON_OFFER",
  ceof: "CUSTOMER_EXTERNAL_OFFER",
  meta: "METADATA",
  mtyp: "METADATA_TYPE",
  ofr: "OFFER",
  prog: "PROGRAM",
  ptnr: "PARTNER",
};

const VALUE_PREFIX_PATTERN = /^([a-z][a-z0-9]*)_/;

const warnedUnknownPrefixes = new Set<string>();

/** @internal Test-only: reset the warn-once Set between test runs. */
export function __resetWarnedUnknownPrefixes(): void {
  warnedUnknownPrefixes.clear();
}

export function entityCodeFromIdValue(idValue: string): string | undefined {
  const match = idValue.match(VALUE_PREFIX_PATTERN);
  if (!match || !match[1]) return undefined;
  const prefix = match[1];
  const entityCode = ENTITY_PREFIX_MAP[prefix];
  if (!entityCode && !warnedUnknownPrefixes.has(prefix)) {
    warnedUnknownPrefixes.add(prefix);
    console.warn(
      `[entityCodeFromIdValue] unknown ENTITY_ID prefix "${prefix}" — extension field will degrade to text input. Add a mapping in ENTITY_PREFIX_MAP if a typed widget is needed.`
    );
  }
  return entityCode;
}

export function entityCodeFromIdExample(example: string | undefined): string | undefined {
  if (!example) return undefined;
  const trimmed = example.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return entityCodeFromIdValue(parsed[0]);
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  return entityCodeFromIdValue(trimmed);
}
