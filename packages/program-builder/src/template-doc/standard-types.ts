/**
 * Canonical PROGRAM_TYPE / CURRENCY_TYPE codes the executor auto-creates
 * with display names. The wizard's `SUGGESTED_*_TYPES` in
 * `packages/ui/src/forms/metadata-field/suggested-options.ts` MUST stay
 * a subset — codes the wizard suggests but this registry doesn't know
 * require an explicit `typeName` on the spec, otherwise the executor
 * surfaces `needs-type-pick`.
 *
 * Adding a code: update the Set + the *_NAMES map + the snapshot in
 * `standard-types.test.ts`. Removing one is a breaking change for
 * templates pinned to that code.
 */

const PROGRAM_TYPE_NAMES: Readonly<Record<string, string>> = {
  standard: "Standard Points Program",
  tiered: "Tiered Loyalty Program",
  subscription: "Subscription Program",
  coalition: "Coalition Program",
};

const CURRENCY_TYPE_NAMES: Readonly<Record<string, string>> = {
  points: "Points",
  miles: "Miles",
  credits: "Credits",
  // Both `stamps` (punch-card / coffee-shop programs) and `tokens`
  // (digital wallet / utility-token style) are canonical loyalty
  // currency patterns. Keeping both keeps the wizard dropdown rich
  // and the executor's metadata-name lookup correct for either choice.
  stamps: "Stamps",
  tokens: "Tokens",
};

export const STANDARD_PROGRAM_TYPE_CODES: ReadonlySet<string> = new Set(
  Object.keys(PROGRAM_TYPE_NAMES)
);

export const STANDARD_CURRENCY_TYPE_CODES: ReadonlySet<string> = new Set(
  Object.keys(CURRENCY_TYPE_NAMES)
);

/**
 * Returns the canonical display name for a known standard PROGRAM_TYPE
 * code, or `undefined` when the code is not in the standard set.
 *
 * Returning `undefined` (rather than the bare code as a fallback) is
 * intentional: the executor's resolution path uses this signal to
 * distinguish "we know the canonical name; auto-create" from "this code
 * is custom; need `spec.program.typeName` or fall through to a picker."
 * A silent "title-case the code" fallback would mask that fork.
 */
export function getStandardProgramTypeName(code: string): string | undefined {
  return PROGRAM_TYPE_NAMES[code];
}

/** Mirror of getStandardProgramTypeName for CURRENCY_TYPE. */
export function getStandardCurrencyTypeName(code: string): string | undefined {
  return CURRENCY_TYPE_NAMES[code];
}

/** Membership predicate. Equivalent to `STANDARD_PROGRAM_TYPE_CODES.has(code)`. */
export function isStandardProgramTypeCode(code: string): boolean {
  return STANDARD_PROGRAM_TYPE_CODES.has(code);
}

/** Mirror for CURRENCY_TYPE. */
export function isStandardCurrencyTypeCode(code: string): boolean {
  return STANDARD_CURRENCY_TYPE_CODES.has(code);
}
