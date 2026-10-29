/** Tests for the canonical PROGRAM_TYPE and CURRENCY_TYPE registries. */

import { describe, expect, it } from "vitest";

import {
  STANDARD_CURRENCY_TYPE_CODES,
  STANDARD_PROGRAM_TYPE_CODES,
  getStandardCurrencyTypeName,
  getStandardProgramTypeName,
  isStandardCurrencyTypeCode,
  isStandardProgramTypeCode,
} from "./standard-types";

describe("STANDARD_PROGRAM_TYPE_CODES", () => {
  it("contains the documented canonical set", () => {
    // Snapshot — adding a new code requires updating this assertion AND
    // adding its display name to the map below. Removing a code is a
    // breaking change for templates that reference it.
    expect([...STANDARD_PROGRAM_TYPE_CODES].sort()).toEqual(
      ["coalition", "standard", "subscription", "tiered"].sort()
    );
  });

  it("is a Set (O(1) membership checks)", () => {
    expect(STANDARD_PROGRAM_TYPE_CODES).toBeInstanceOf(Set);
  });
});

describe("STANDARD_CURRENCY_TYPE_CODES", () => {
  it("contains the documented canonical set", () => {
    expect([...STANDARD_CURRENCY_TYPE_CODES].sort()).toEqual(
      ["credits", "miles", "points", "stamps", "tokens"].sort()
    );
  });

  it("is a Set", () => {
    expect(STANDARD_CURRENCY_TYPE_CODES).toBeInstanceOf(Set);
  });
});

describe("getStandardProgramTypeName", () => {
  it("returns the canonical name for known standard codes", () => {
    expect(getStandardProgramTypeName("standard")).toBe("Standard Points Program");
    expect(getStandardProgramTypeName("tiered")).toBe("Tiered Loyalty Program");
    expect(getStandardProgramTypeName("subscription")).toBe("Subscription Program");
    expect(getStandardProgramTypeName("coalition")).toBe("Coalition Program");
  });

  it("returns undefined for unknown codes (caller must fall back to spec.program.typeName)", () => {
    expect(getStandardProgramTypeName("premium-tier")).toBeUndefined();
    expect(getStandardProgramTypeName("")).toBeUndefined();
    // Unknown codes don't get a synthetic "Title Case the code" — that
    // would mask the architectural intent. The executor's resolution
    // path returns `needs-type-pick` when it can't derive a name from
    // either the standard set or `spec.program.typeName`.
  });
});

describe("getStandardCurrencyTypeName", () => {
  it("returns the canonical name for known standard codes", () => {
    expect(getStandardCurrencyTypeName("points")).toBe("Points");
    expect(getStandardCurrencyTypeName("miles")).toBe("Miles");
    expect(getStandardCurrencyTypeName("credits")).toBe("Credits");
    expect(getStandardCurrencyTypeName("stamps")).toBe("Stamps");
    expect(getStandardCurrencyTypeName("tokens")).toBe("Tokens");
  });

  it("returns undefined for unknown codes", () => {
    expect(getStandardCurrencyTypeName("miles-points")).toBeUndefined();
    expect(getStandardCurrencyTypeName("")).toBeUndefined();
  });
});

describe("isStandardProgramTypeCode / isStandardCurrencyTypeCode", () => {
  it("isStandardProgramTypeCode matches the set", () => {
    expect(isStandardProgramTypeCode("standard")).toBe(true);
    expect(isStandardProgramTypeCode("tiered")).toBe(true);
    expect(isStandardProgramTypeCode("premium-tier")).toBe(false);
    expect(isStandardProgramTypeCode("")).toBe(false);
  });

  it("isStandardCurrencyTypeCode matches the set", () => {
    expect(isStandardCurrencyTypeCode("points")).toBe(true);
    expect(isStandardCurrencyTypeCode("miles")).toBe(true);
    expect(isStandardCurrencyTypeCode("miles-points")).toBe(false);
    expect(isStandardCurrencyTypeCode("")).toBe(false);
  });
});

describe("integration — get*Name + is*StandardCode are consistent", () => {
  // Invariant: a code is in the standard set ⟺ get*Name returns a string.
  it("PROGRAM_TYPE: every set member has a name; every name maps back to a member", () => {
    for (const code of STANDARD_PROGRAM_TYPE_CODES) {
      expect(getStandardProgramTypeName(code)).toBeTypeOf("string");
      expect(isStandardProgramTypeCode(code)).toBe(true);
    }
  });
  it("CURRENCY_TYPE: same invariant", () => {
    for (const code of STANDARD_CURRENCY_TYPE_CODES) {
      expect(getStandardCurrencyTypeName(code)).toBeTypeOf("string");
      expect(isStandardCurrencyTypeCode(code)).toBe(true);
    }
  });
});
