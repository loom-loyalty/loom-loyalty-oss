/**
 * Tests for shared Zod refinements: entityId, localizedString,
 * durationPeriodValue. These close the contract gaps Orval's generated Zod
 * leaves open per playbook §5.
 */

import { describe, expect, it } from "vitest";

import { durationPeriodValue, entityId, localizedString } from "./refinements.js";

describe("entityId", () => {
  describe("accepts canonical IDs", () => {
    it("matches the prefix + 32 lowercase hex chars", () => {
      const schema = entityId("prog");
      const id = `prog_${"0".repeat(32)}`;
      expect(schema.parse(id)).toBe(id);
    });

    it("works for any lowercase prefix", () => {
      const schema = entityId("ofr");
      const id = `ofr_${"a".repeat(32)}`;
      expect(schema.parse(id)).toBe(id);
    });
  });

  describe("rejects malformed IDs", () => {
    it("rejects when the body is too short", () => {
      const schema = entityId("prog");
      expect(() => schema.parse("prog_short")).toThrow();
    });

    it("rejects when the prefix differs", () => {
      const schema = entityId("prog");
      expect(() => schema.parse(`program_${"0".repeat(32)}`)).toThrow();
    });

    it("rejects when the body has uppercase hex", () => {
      const schema = entityId("prog");
      expect(() => schema.parse(`prog_${"A".repeat(32)}`)).toThrow();
    });

    it("rejects when the body has non-hex chars", () => {
      const schema = entityId("prog");
      expect(() => schema.parse(`prog_${"z".repeat(32)}`)).toThrow();
    });

    it("rejects empty string", () => {
      const schema = entityId("prog");
      expect(() => schema.parse("")).toThrow();
    });

    it("rejects null/undefined", () => {
      const schema = entityId("prog");
      expect(() => schema.parse(null)).toThrow();
      expect(() => schema.parse(undefined)).toThrow();
    });
  });

  describe("dev-time prefix validation", () => {
    it("throws when prefix is empty", () => {
      expect(() => entityId("")).toThrow(/prefix/i);
    });

    it("throws when prefix has uppercase", () => {
      expect(() => entityId("Prog")).toThrow(/prefix/i);
    });

    it("throws when prefix has hyphen or underscore", () => {
      expect(() => entityId("pro_g")).toThrow(/prefix/i);
      expect(() => entityId("pro-g")).toThrow(/prefix/i);
    });
  });
});

describe("localizedString", () => {
  it("accepts a record with the en locale set", () => {
    expect(localizedString.parse({ en: "Buy more" })).toEqual({
      en: "Buy more",
    });
  });

  it("accepts multiple locales", () => {
    expect(localizedString.parse({ en: "Buy more", es: "Compra más" })).toEqual({
      en: "Buy more",
      es: "Compra más",
    });
  });

  it("accepts BCP-47 region locales like en_US", () => {
    expect(localizedString.parse({ en: "x", en_US: "y" })).toEqual({
      en: "x",
      en_US: "y",
    });
  });

  it("rejects an empty record (no en)", () => {
    expect(() => localizedString.parse({})).toThrow(/en/i);
  });

  it("rejects when en is missing but other locales are present", () => {
    expect(() => localizedString.parse({ es: "x" })).toThrow(/en/i);
  });

  describe("empty-value stripping", () => {
    it("strips empty string values from non-en locales", () => {
      expect(localizedString.parse({ en: "x", es: "", fr: "y" })).toEqual({
        en: "x",
        fr: "y",
      });
    });

    it("strips whitespace-only values (treated as empty)", () => {
      expect(localizedString.parse({ en: "x", es: "   ", fr: "\t\n" })).toEqual({
        en: "x",
      });
    });

    it("rejects when en is empty (treated as missing after strip)", () => {
      expect(() => localizedString.parse({ en: "", es: "y" })).toThrow(/en/i);
    });

    it("rejects when en is whitespace-only (treated as missing after strip)", () => {
      expect(() => localizedString.parse({ en: "   " })).toThrow(/en/i);
    });
  });

  describe("locale code validation", () => {
    it("rejects uppercase locale codes", () => {
      expect(() => localizedString.parse({ EN: "x" })).toThrow();
    });

    it("rejects locale codes that are too long", () => {
      expect(() => localizedString.parse({ en: "x", english: "x" })).toThrow();
    });

    it("silently filters protected keys like __proto__ via Zod's record validator", () => {
      // Pinned behavior: Zod's z.record drops __proto__ / constructor / prototype
      // built-in keys without flagging them as invalid. Verify both that the
      // result has only `en` and that no own __proto__ leaks onto the parsed object.
      const malicious = JSON.parse('{"__proto__":"leak","en":"hi"}') as Record<string, string>;
      const parsed = localizedString.parse(malicious);
      expect(parsed).toEqual({ en: "hi" });
      expect(Object.prototype.hasOwnProperty.call(parsed, "__proto__")).toBe(false);
    });
  });
});

describe("durationPeriodValue", () => {
  it("accepts canonical {period:'DAY', value:1}", () => {
    expect(durationPeriodValue.parse({ period: "DAY", value: 1 })).toEqual({
      period: "DAY",
      value: 1,
    });
  });

  it("accepts WEEK, MONTH, YEAR", () => {
    expect(durationPeriodValue.parse({ period: "WEEK", value: 2 })).toBeTruthy();
    expect(durationPeriodValue.parse({ period: "MONTH", value: 3 })).toBeTruthy();
    expect(durationPeriodValue.parse({ period: "YEAR", value: 1 })).toBeTruthy();
  });

  it("rejects unknown period", () => {
    expect(() => durationPeriodValue.parse({ period: "FORTNIGHT", value: 1 })).toThrow();
  });

  it("rejects value:0 (must be positive)", () => {
    expect(() => durationPeriodValue.parse({ period: "DAY", value: 0 })).toThrow();
  });

  it("rejects negative value", () => {
    expect(() => durationPeriodValue.parse({ period: "DAY", value: -1 })).toThrow();
  });

  it("rejects non-integer value", () => {
    expect(() => durationPeriodValue.parse({ period: "DAY", value: 1.5 })).toThrow();
  });

  it("rejects missing fields", () => {
    expect(() => durationPeriodValue.parse({ period: "DAY" })).toThrow();
    expect(() => durationPeriodValue.parse({ value: 1 })).toThrow();
  });
});
