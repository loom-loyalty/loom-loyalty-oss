/**
 * The title of a new chat thread is its first message (Nate, 2026-11-05: no
 * model call for a title). The chat panel shows it the instant Enter is
 * pressed and the AI server stores the same string when it creates the
 * thread, so both import this one function.
 *
 * Kept free of React and DOM so the Cloudflare Worker can import it from
 * `@loom-loyalty/core/ai/thread-title`.
 */

/** Longest title, counted in code points so an emoji is never split. */
export const THREAD_TITLE_MAX_CODE_POINTS = 60;

const ELLIPSIS = "…";
/** A word-boundary cut shorter than this keeps too little; hard-cut instead. */
const MIN_BOUNDARY_CUT = 30;

/**
 * One trimmed line of at most 60 code points: whitespace runs (newlines
 * included) collapse to one space, a longer message is cut on the last word
 * boundary and ends in an ellipsis, a single very long word is hard-cut, and a
 * blank message gives "" (the caller decides what a blank thread shows).
 */
export function threadTitleFrom(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  const cps = Array.from(collapsed);
  if (cps.length <= THREAD_TITLE_MAX_CODE_POINTS) return collapsed;

  const headLength = THREAD_TITLE_MAX_CODE_POINTS - 1; // room for the ellipsis
  const head = cps.slice(0, headLength);
  let body: string[];
  if (cps[headLength] === " ") {
    body = head; // the cut already falls on a word boundary
  } else {
    const lastSpace = head.lastIndexOf(" ");
    body = lastSpace >= MIN_BOUNDARY_CUT ? head.slice(0, lastSpace) : head;
  }
  return `${body.join("").trimEnd()}${ELLIPSIS}`;
}
