/**
 * The two code conventions the Platform API enforces on inbound create/update
 * payloads, plus generators that are guaranteed to satisfy them.
 *
 * These are transcribed from the API's own constants. Until the API publishes
 * them in its OpenAPI spec, this file is the frontend's single copy — so if you
 * find a second regex for either convention anywhere in this repo, it is a bug,
 * not a shortcut.
 */

/**
 * Resource codes: lowercase letters/numbers in single-hyphen-separated
 * segments, 1–63 characters. No leading, trailing or doubled hyphens.
 *
 * `cultivation-points` is valid; `-points`, `points-` and
 * `cultivation--points` are not. Leading digits ARE allowed, unlike
 * {@link EVENT_TYPE_CODE_PATTERN}.
 *
 * Applies to badges, tiers, programs, partners, targets, offers, currencies,
 * expiry and pending rules, flows, roles, audiences, environments and data
 * model types — every entity whose create/update payload carries a `code` the
 * API pattern-validates.
 */
export const RESOURCE_CODE_PATTERN = /^(?=.{1,63}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Event-type codes: dot-namespaced segments, each optionally hyphenated, and
 * the whole code **must start with a lowercase letter**.
 *
 * `customer.created` and `external-offer.issued` are valid; `3-points` is not,
 * because of the leading digit. A separate, older convention from
 * {@link RESOURCE_CODE_PATTERN} — not part of the resource-code migration, and
 * not interchangeable with it.
 *
 * Unlike resource codes, the API's pattern carries no length bound, so neither
 * does this.
 */
export const EVENT_TYPE_CODE_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/** The API's own validation message for a rejected resource code, verbatim. */
export const RESOURCE_CODE_MESSAGE =
  "Code must be lowercase letters/numbers in single-hyphen-separated segments, 1-63 " +
  "characters, with no leading, trailing, or doubled hyphens (e.g., 'cultivation-points')";

/** The API's own validation message for a rejected event-type code, verbatim. */
export const EVENT_TYPE_CODE_MESSAGE =
  "Event type code must be lowercase letters/numbers in period-separated segments, " +
  "optionally hyphenated within a segment (e.g., 'customer.created', 'external-offer.issued')";

/** Whether `value` would be accepted as a resource code. */
export function isResourceCode(value: string | undefined | null): boolean {
  return value != null && RESOURCE_CODE_PATTERN.test(value);
}

/** Whether `value` would be accepted as an event-type code. */
export function isEventTypeCode(value: string | undefined | null): boolean {
  return value != null && EVENT_TYPE_CODE_PATTERN.test(value);
}

/**
 * Derives a valid resource code from arbitrary text.
 *
 * Idempotent: an already-compliant code passes through untouched, which is what
 * makes this safe to apply to a code the API already gave us. Generators that
 * re-derive a code on every render depend on that property.
 *
 * Returns `fallback` rather than throwing when the input has nothing usable in
 * it — these run on every keystroke, so throwing is not an option, and `""`
 * would be silently rejected downstream.
 */
export function toResourceCode(raw: string | undefined, fallback = "generated"): string {
  const normalized = (raw ?? "")
    .toLowerCase()
    // Any run of non-alphanumerics becomes one separator, so "a..b__c" does not
    // leave empty segments behind.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized === "") return fallback;
  // Truncate before trimming again: slicing can leave a trailing hyphen, which
  // the pattern rejects.
  return normalized.slice(0, 63).replace(/-+$/g, "") || fallback;
}

/**
 * Derives a valid event-type code from arbitrary text.
 *
 * Dots are preserved as namespace separators — that is the whole difference from
 * {@link toResourceCode}, which collapses them. Each dot-segment is normalised
 * independently, so `My App.Purchase Completed` becomes
 * `my-app.purchase-completed`.
 *
 * **Leading digits are stripped**, because the pattern requires the code to
 * start with a lowercase letter and there is no non-surprising way to invent
 * one. This does lose information: `2024 Summer Promo` becomes
 * `summer-promo`. That is deliberate — the alternative is prefixing a letter the
 * user never typed. The generated value is always shown in an editable field, so
 * the loss is visible rather than silent. If no segment survives, `fallback` is
 * returned.
 */
export function toEventTypeCode(raw: string | undefined, fallback = "generated"): string {
  const segments = (raw ?? "")
    .toLowerCase()
    .split(".")
    .map((segment) => segment.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter((segment) => segment !== "");

  // The pattern constrains only the START of the whole code, so digits are
  // stripped from the first surviving segment and, if that empties it, from the
  // next one along.
  while (segments.length > 0) {
    const head = segments[0] ?? "";
    const trimmed = head.replace(/^[0-9]+-?/, "").replace(/^-+/, "");
    if (trimmed !== "") {
      segments[0] = trimmed;
      break;
    }
    segments.shift();
  }

  const candidate = segments.join(".");
  // Belt and braces: this function's contract is that its output is always
  // accepted, so anything that slipped through becomes the fallback rather than
  // a payload the API will reject.
  return isEventTypeCode(candidate) ? candidate : fallback;
}
