import { describe, expect, it } from "vitest";

import {
  EVENT_TYPE_CODE_PATTERN,
  isEventTypeCode,
  isResourceCode,
  RESOURCE_CODE_PATTERN,
  toEventTypeCode,
  toResourceCode,
} from "./codes.js";

describe("RESOURCE_CODE_PATTERN", () => {
  it.each(["viator", "cultivation-points", "a", "a1", "1a", "123", "a".repeat(63)])(
    "accepts %s",
    (code) => {
      expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
    }
  );

  it.each([
    ["", "empty"],
    ["-points", "leading hyphen"],
    ["points-", "trailing hyphen"],
    ["cultivation--points", "doubled hyphen"],
    ["GOLD_TIER", "uppercase and underscore"],
    ["gold_tier", "underscore"],
    ["Gold-Tier", "uppercase"],
    ["customer.created", "dot — that is an event-type code"],
    ["a".repeat(64), "64 characters"],
  ])("rejects %s (%s)", (code) => {
    expect(RESOURCE_CODE_PATTERN.test(code)).toBe(false);
  });

  it("allows a leading digit, unlike the event-type pattern", () => {
    expect(isResourceCode("3-points")).toBe(true);
    expect(isEventTypeCode("3-points")).toBe(false);
  });
});

describe("EVENT_TYPE_CODE_PATTERN", () => {
  it.each([
    "customer.created",
    "external-offer.issued",
    "birthday",
    "a",
    "my-app.purchase-completed",
    "a.b.c",
  ])("accepts %s", (code) => {
    expect(EVENT_TYPE_CODE_PATTERN.test(code)).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["3points", "leading digit"],
    ["-customer.created", "leading hyphen"],
    ["customer..created", "doubled dot"],
    ["customer.created.", "trailing dot"],
    ["Customer.Created", "uppercase"],
    ["customer_created", "underscore"],
  ])("rejects %s (%s)", (code) => {
    expect(EVENT_TYPE_CODE_PATTERN.test(code)).toBe(false);
  });
});

describe("isResourceCode / isEventTypeCode", () => {
  it("treat null and undefined as invalid rather than throwing", () => {
    expect(isResourceCode(null)).toBe(false);
    expect(isResourceCode(undefined)).toBe(false);
    expect(isEventTypeCode(null)).toBe(false);
    expect(isEventTypeCode(undefined)).toBe(false);
  });
});

describe("toResourceCode", () => {
  it.each([
    // The case that matters most: re-deriving a code the API already gave us
    // must not change it. Generators run on every render.
    ["customer-tier", "customer-tier", "no-op on compliant input"],
    ["Gold — Tier", "gold-tier", "collapses runs, does not yield gold--tier"],
    ["_leading", "leading", "trims a leading separator"],
    ["trailing-", "trailing", "trims a trailing separator"],
    ["MY_TIER", "my-tier", "underscore to hyphen"],
    ["a..b__c", "a-b-c", "no empty segments from repeated separators"],
    ["3 Points", "3-points", "leading digits are fine here"],
  ])("%s -> %s (%s)", (input, expected) => {
    expect(toResourceCode(input)).toBe(expected);
  });

  it("caps at 63 characters without leaving a trailing hyphen", () => {
    const result = toResourceCode("a".repeat(70));
    expect(result).toHaveLength(63);
    expect(isResourceCode(result)).toBe(true);
  });

  it("does not leave a trailing hyphen when the cut lands on a separator", () => {
    // 63 "a"s then a hyphen: slicing to 63 is clean, but shift by one and the
    // 63rd character is the hyphen itself.
    const result = toResourceCode(`${"a".repeat(62)} b c`);
    expect(isResourceCode(result)).toBe(true);
    expect(result.endsWith("-")).toBe(false);
  });

  it.each<[string | undefined, string]>([
    ["!!!", "unrepresentable"],
    ["", "empty"],
    [undefined, "undefined"],
  ])("returns the fallback for %s input (%s)", (input) => {
    expect(toResourceCode(input)).toBe("generated");
    expect(toResourceCode(input, "custom")).toBe("custom");
  });

  it("always produces something the API would accept", () => {
    for (const input of ["", "!!!", "___", "MY_TIER", "a".repeat(200), "3", "-", "a b"]) {
      expect(isResourceCode(toResourceCode(input))).toBe(true);
    }
  });
});

describe("toEventTypeCode", () => {
  it.each([
    ["customer.created", "customer.created", "no-op on compliant input"],
    ["external-offer.issued", "external-offer.issued", "hyphen inside a segment survives"],
    ["My App.Purchase Completed", "my-app.purchase-completed", "per-segment normalisation"],
    ["Birthday", "birthday", "single segment"],
    ["customer..created", "customer.created", "drops empty segments"],
    ["customer.created.", "customer.created", "drops a trailing empty segment"],
  ])("%s -> %s (%s)", (input, expected) => {
    expect(toEventTypeCode(input)).toBe(expected);
  });

  it("strips leading digits, because the pattern requires a leading letter", () => {
    expect(toEventTypeCode("3 Points")).toBe("points");
    // Documented information loss — the year is dropped rather than a letter
    // being invented.
    expect(toEventTypeCode("2024 Summer Promo")).toBe("summer-promo");
  });

  it("moves to the next segment when stripping digits empties the first", () => {
    expect(toEventTypeCode("2024.summer")).toBe("summer");
  });

  it.each<[string | undefined, string]>([
    ["123", "digits only"],
    ["!!!", "unrepresentable"],
    ["", "empty"],
    [undefined, "undefined"],
  ])("returns the fallback for %s input (%s)", (input) => {
    expect(toEventTypeCode(input)).toBe("generated");
    expect(toEventTypeCode(input, "custom")).toBe("custom");
  });

  it("always produces something the API would accept", () => {
    for (const input of ["", "!!!", "123", "2024.2025", "A.B.C", "a..b", ".", "-", "3x"]) {
      expect(isEventTypeCode(toEventTypeCode(input))).toBe(true);
    }
  });

  it("differs from toResourceCode precisely on dots and leading digits", () => {
    expect(toResourceCode("customer.created")).toBe("customer-created");
    expect(toEventTypeCode("customer.created")).toBe("customer.created");
    expect(toResourceCode("3 points")).toBe("3-points");
    expect(toEventTypeCode("3 points")).toBe("points");
  });
});
