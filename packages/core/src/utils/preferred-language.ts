/**
 * A customer's preferred language (loom-loyalty-api `PreferredLanguage`, whose list lives in
 * `SupportedLanguages`): a bare language subtag stored on `Customer.preferredLanguage`. Unset, or a
 * stored value this release does not support, reads as English.
 *
 * This is the frontend's one list: the Hub's customer form (`@loom-loyalty/ui`) and the Rewards
 * Portal read it, so adding a language is one edit here, alongside the API's list. It has no
 * imports, so the portal Worker can use it.
 */
export const PREFERRED_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

export type PreferredLanguageCode = (typeof PREFERRED_LANGUAGE_OPTIONS)[number]["value"];

/** What an unset or unsupported value means to a reader. */
export const DEFAULT_PREFERRED_LANGUAGE: PreferredLanguageCode = "en";
