/**
 * URL/email sanitizers for rendered links.
 *
 * Entity field values are tenant-supplied data. A `url`/`email`-typed field can
 * carry a `javascript:`/`data:` payload that executes on click if rendered as a
 * raw `href`. These helpers gate the scheme so only safe links are produced; a
 * rejected value should be rendered as plain text instead of an anchor.
 */

/** Return `value` as an href only when it is an `http(s)://` URL, else `undefined`. */
export function safeHref(value: unknown): string | undefined {
  const str = String(value);
  return /^https?:\/\//i.test(str) ? str : undefined;
}

/**
 * Return a `mailto:` href only when `value` looks like a plain email address.
 * The `mailto:` prefix already neutralizes scheme injection; the shape + no-colon
 * check is hygiene against malformed/spoofed values.
 */
export function safeMailto(value: unknown): string | undefined {
  const str = String(value);
  if (str.includes(":")) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) ? `mailto:${str}` : undefined;
}
