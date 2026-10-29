/**
 * Shared Zod refinements that close the FE-side contract gaps Orval's
 * generated Zod leaves open (per playbook §5).
 *
 * These are NOT a parallel schema — they augment Orval-emitted schemas via
 * `.extend()` / `.merge()` at consumer sites. Orval can't generate:
 *   - ENTITY_ID prefix regex (emits z.string())
 *   - LOCALIZED_STRING en-required + empty-strip refinement
 *   - DURATION_PERIOD_VALUE composite shape
 */

import { z } from "zod";

/** Locale code per BCP-47 short form: lowercase ISO language code with
 *  optional uppercase region (e.g., "en", "en_US", "es", "fr_CA"). */
const localeKey = z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/, "Locale must be like 'en' or 'en_US'");

/** Build a Zod schema that validates an entity ID against the canonical
 *  prefix + 32 lowercase hex chars format (e.g., `prog_550e8400e29b...`).
 *
 *  The prefix is validated at function-call time (not parse time) because
 *  invalid prefixes are dev errors, not user-input errors. */
export function entityId(prefix: string): z.ZodString {
  if (!/^[a-z][a-z0-9]*$/.test(prefix)) {
    throw new Error(`entityId prefix must be lowercase alphanumeric (got "${prefix}")`);
  }
  const pattern = new RegExp(`^${prefix}_[0-9a-f]{32}$`);
  return z.string().regex(pattern, `Invalid ${prefix} entity ID format`);
}

/** Multi-locale string editor value, e.g. {en: "Buy more", es: "Compra más"}.
 *
 *  - Locale keys must match `^[a-z]{2}(_[A-Z]{2})?$`
 *  - Empty or whitespace-only values are STRIPPED on parse
 *  - The `en` locale must be present and non-empty after stripping
 *
 *  Output type after parse is the cleaned record. */
export const localizedString = z
  .record(localeKey, z.string())
  .transform((val) => {
    const stripped: Record<string, string> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v.trim().length > 0) stripped[k] = v;
    }
    return stripped;
  })
  .refine((m) => typeof m.en === "string" && m.en.length > 0, {
    message: "English (en) locale is required",
  });

/** Composite period+value used for offer durations, target cycles, etc.
 *  Matches the BE's DURATION_PERIOD_VALUE typeReference. */
export const durationPeriodValue = z.object({
  period: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]),
  value: z.number().int().positive(),
});

export type DurationPeriodValue = z.infer<typeof durationPeriodValue>;
export type LocalizedString = z.infer<typeof localizedString>;
