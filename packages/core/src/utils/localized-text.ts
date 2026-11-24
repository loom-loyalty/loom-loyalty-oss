/**
 * Localized text: a plain string (read as English) or a map keyed by BCP 47 locale
 * (`en`, `es`, `es-MX`; `es_MX` is accepted). Apps pick the text to show for a
 * locale with `pickLocalizedText`, and render any basic-Markdown field with the
 * safe Markdown settings below.
 */

export type LocalizedText = string | Readonly<Record<string, string>>;

// language (2-3 letters), optional script (4 letters), optional region (2 letters or 3 digits)
const LOCALE_KEY = /^([a-z]{2,3})(?:[-_]([a-z]{4}))?(?:[-_]([a-z]{2}|\d{3}))?$/i;

/** The canonical BCP 47 form of a locale key (`es_mx` → `es-MX`), or undefined when malformed. */
export function normalizeLocaleKey(key: string): string | undefined {
  const match = LOCALE_KEY.exec(key);
  if (!match) return undefined;
  const [, language, script, region] = match;
  const parts = [language!.toLowerCase()];
  if (script) parts.push(script[0]!.toUpperCase() + script.slice(1).toLowerCase());
  if (region) parts.push(region.toUpperCase());
  return parts.join("-");
}

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * The text to show for `locale`: the exact locale, then its language-and-script and
 * language-only forms, then `en`. A plain string is the English text. Blank values,
 * malformed keys and non-string values are skipped; returns undefined when nothing
 * usable remains.
 */
export function pickLocalizedText(
  text: LocalizedText | null | undefined,
  locale: string
): string | undefined {
  if (text == null) return undefined;
  if (typeof text === "string") return nonBlank(text) ? text : undefined;

  const byLocale = new Map<string, string>();
  for (const [key, value] of Object.entries(text)) {
    const normalized = normalizeLocaleKey(key);
    if (normalized && nonBlank(value) && !byLocale.has(normalized)) byLocale.set(normalized, value);
  }

  const requested = normalizeLocaleKey(locale);
  const candidates: string[] = [];
  if (requested) {
    const parts = requested.split("-");
    for (let i = parts.length; i > 0; i--) candidates.push(parts.slice(0, i).join("-"));
    // es-MX also tries es before giving up, even when a script sits in the middle (zh-Hant-TW → zh-Hant → zh)
  }
  candidates.push("en");
  for (const candidate of candidates) {
    const value = byLocale.get(candidate);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** The only elements a tenant's basic Markdown may produce. Anything else is unwrapped to its text. */
export const SAFE_MARKDOWN_ALLOWED_ELEMENTS: readonly string[] = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "br",
];

/** Links in tenant Markdown may only point to https or mailto. */
export function isSafeMarkdownUrl(url: string): boolean {
  return /^(https:\/\/|mailto:)/i.test(url) && url === url.trim();
}

/** For react-markdown's `urlTransform`: keeps a safe URL and empties any other. */
export function safeMarkdownUrlTransform(url: string): string {
  return isSafeMarkdownUrl(url) ? url : "";
}
