import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  isSafeMarkdownUrl,
  normalizeLocaleKey,
  pickLocalizedText,
  safeMarkdownUrlTransform,
  SAFE_MARKDOWN_ALLOWED_ELEMENTS,
} from "./localized-text";

describe("normalizeLocaleKey", () => {
  it.each([
    ["es-MX", "es-MX"],
    ["es_MX", "es-MX"],
    ["ES_mx", "es-MX"],
    ["zh_hant_tw", "zh-Hant-TW"],
    ["es-419", "es-419"],
    ["fil", "fil"],
    ["EN", "en"],
  ])("normalizes %s to %s", (raw, expected) => {
    expect(normalizeLocaleKey(raw)).toBe(expected);
  });

  it.each(["en--US", "en-", "-en", "e", "en-US-x", "xx_YY_ZZ", "", "english"])(
    "refuses the malformed key %s",
    (raw) => {
      expect(normalizeLocaleKey(raw)).toBeUndefined();
    }
  );
});

describe("pickLocalizedText", () => {
  it("L1: falls back from region to language to en", () => {
    const text = { en: "Terms", es: "Términos" };
    expect(pickLocalizedText(text, "es-MX")).toBe("Términos");
    expect(pickLocalizedText(text, "fr")).toBe("Terms");
    expect(pickLocalizedText({ "es-MX": "Mexico", es: "Spain" }, "es-MX")).toBe("Mexico");
  });

  it("accepts underscore keys in the stored map and the request", () => {
    expect(pickLocalizedText({ es_MX: "Mexico" }, "es-MX")).toBe("Mexico");
    expect(pickLocalizedText({ "es-MX": "Mexico" }, "es_MX")).toBe("Mexico");
  });

  it("reads a plain string as the English text", () => {
    expect(pickLocalizedText("Terms", "es")).toBe("Terms");
    expect(pickLocalizedText("Terms", "en")).toBe("Terms");
  });

  it("W12: skips blank values and returns undefined when nothing usable remains", () => {
    expect(pickLocalizedText({ es: "   ", en: "Terms" }, "es")).toBe("Terms");
    expect(pickLocalizedText({ es: "  " }, "es")).toBeUndefined();
    expect(pickLocalizedText("   ", "en")).toBeUndefined();
    expect(pickLocalizedText(undefined, "en")).toBeUndefined();
    expect(pickLocalizedText(null, "en")).toBeUndefined();
    expect(pickLocalizedText({}, "en")).toBeUndefined();
  });

  it("ignores malformed keys and non-string values", () => {
    expect(
      pickLocalizedText({ "en--US": "bad", en: 3 as unknown as string, es: "ok" }, "en")
    ).toBeUndefined();
    expect(pickLocalizedText({ "en--US": "bad", es: "ok" }, "es")).toBe("ok");
  });

  it("I7 (property): never throws, and returns English text whenever a non-blank en exists and nothing better matches", () => {
    const value = fc.oneof(
      fc.string(),
      fc.dictionary(
        fc.constantFrom("en", "es", "es-MX", "es_MX", "fr", "en--US", "zh-Hant-TW"),
        fc.string()
      )
    );
    fc.assert(
      fc.property(
        value,
        fc.constantFrom("en", "es", "es-MX", "fr", "de", "zh-Hant-TW"),
        (text, locale) => {
          const picked = pickLocalizedText(text, locale);
          if (picked !== undefined) expect(picked.trim().length).toBeGreaterThan(0);
          const english = typeof text === "string" ? text : text.en;
          if (english !== undefined && english.trim() !== "") expect(picked).toBeDefined();
        }
      )
    );
  });
});

describe("safe Markdown", () => {
  it("allows only the basic formatting elements", () => {
    expect([...SAFE_MARKDOWN_ALLOWED_ELEMENTS].sort()).toEqual(
      ["a", "br", "em", "li", "ol", "p", "strong", "ul"].sort()
    );
  });

  it.each(["https://example.com/terms", "mailto:help@example.com"])("keeps %s", (url) => {
    expect(isSafeMarkdownUrl(url)).toBe(true);
    expect(safeMarkdownUrlTransform(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "//evil.example",
    "http://example.com",
    "vbscript:msgbox",
    "/relative/path",
    "",
  ])("S1: drops %s", (url) => {
    expect(isSafeMarkdownUrl(url)).toBe(false);
    expect(safeMarkdownUrlTransform(url)).toBe("");
  });
});
