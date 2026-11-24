/**
 * A customer's preferred language. The list itself lives in `@loom-loyalty/core`
 * (`PREFERRED_LANGUAGE_OPTIONS`), shared with the Rewards Portal; this module re-exports it and adds
 * the readers the customer screens use.
 */
import { PREFERRED_LANGUAGE_OPTIONS, type PreferredLanguageCode } from "@loom-loyalty/core";

export { PREFERRED_LANGUAGE_OPTIONS, type PreferredLanguageCode };

/** The stored value when it is a supported language, otherwise `undefined`. */
export function supportedPreferredLanguage(value: unknown): PreferredLanguageCode | undefined {
  return PREFERRED_LANGUAGE_OPTIONS.find((option) => option.value === value)?.value;
}

/** The display name readers show: the supported language's name, otherwise English. */
export function preferredLanguageLabel(value: unknown): string {
  return (
    PREFERRED_LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ??
    PREFERRED_LANGUAGE_OPTIONS[0].label
  );
}
