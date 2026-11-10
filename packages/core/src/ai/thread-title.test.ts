import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { THREAD_TITLE_MAX_CODE_POINTS, threadTitleFrom } from "./thread-title";
import { THREAD_TITLE_FIXTURES } from "./thread-title.fixtures";

const codePoints = (s: string) => Array.from(s);

describe("threadTitleFrom", () => {
  it.each(THREAD_TITLE_FIXTURES)("$name", ({ message, title }) => {
    expect(threadTitleFrom(message)).toBe(title);
  });

  it("caps at 60 code points", () => {
    expect(THREAD_TITLE_MAX_CODE_POINTS).toBe(60);
  });

  it("is deterministic, never empty for a non-blank message, never over 60 code points, never splits a code point, and is one trimmed line", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", minLength: 0, maxLength: 300 }), (message) => {
        const title = threadTitleFrom(message);
        expect(threadTitleFrom(message)).toBe(title);
        expect(codePoints(title).length).toBeLessThanOrEqual(THREAD_TITLE_MAX_CODE_POINTS);
        expect(title).toBe(title.trim());
        expect(title).not.toMatch(/\s\s|[\r\n\t]/);
        // A lone surrogate would mean a code point was split.
        expect(title).not.toMatch(
          /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
        );
        if (message.trim() !== "") expect(title).not.toBe("");
        else expect(title).toBe("");
        // The title is a prefix of the collapsed message, possibly ending in an ellipsis.
        const collapsed = message.replace(/\s+/g, " ").trim();
        const body = title.endsWith("…") ? title.slice(0, -1).trimEnd() : title;
        expect(collapsed.startsWith(body)).toBe(true);
        if (!title.endsWith("…")) expect(body).toBe(collapsed);
      }),
      { numRuns: 500 }
    );
  });
});
