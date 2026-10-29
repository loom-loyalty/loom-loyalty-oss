import { describe, expect, it } from "vitest";

import {
  amountChoices,
  defaultAmounts,
  describeFaceValues,
  formatFaceValue,
  isOfferableAt,
  isSoldAt,
  MAX_LINK_DENOMINATIONS,
} from "./face-values";

describe("formatFaceValue", () => {
  it("drops cents only when there are none", () => {
    expect(formatFaceValue(25)).toBe("$25");
    expect(formatFaceValue(12.5)).toBe("$12.50");
  });
});

describe("isSoldAt", () => {
  it("accepts only listed amounts for a fixed item", () => {
    const item = { fixedDenominations: [50, 10, 25] };
    expect(isSoldAt(item, 25)).toBe(true);
    expect(isSoldAt(item, 20)).toBe(false);
  });

  it("checks bounds and steps from the minimum for a range item", () => {
    const item = { minValue: 10, maxValue: 100, stepValue: 5 };
    expect(isSoldAt(item, 10)).toBe(true);
    expect(isSoldAt(item, 35)).toBe(true);
    expect(isSoldAt(item, 37)).toBe(false);
    expect(isSoldAt(item, 105)).toBe(false);
    expect(isSoldAt(item, 5)).toBe(false);
  });

  it("refuses zero, negative and non-numeric amounts", () => {
    expect(isSoldAt({ minValue: 0 }, 0)).toBe(false);
    expect(isSoldAt({}, Number.NaN)).toBe(false);
  });
});

describe("describeFaceValues", () => {
  it("lists a few fixed amounts and ranges many", () => {
    expect(describeFaceValues({ fixedDenominations: [25, 10] })).toBe("$10, $25");
    expect(describeFaceValues({ fixedDenominations: [5, 10, 25, 50, 100] })).toBe("$5–$100");
    expect(describeFaceValues({ minValue: 10, maxValue: 100 })).toBe("$10–$100");
    expect(describeFaceValues({ minValue: 32, maxValue: 32 })).toBe("$32");
  });
});

describe("amountChoices and defaultAmounts", () => {
  it("ticks every fixed amount", () => {
    const item = { fixedDenominations: [50, 10, 25] };
    expect(amountChoices(item)).toEqual([10, 25, 50]);
    expect(defaultAmounts(item)).toEqual([10, 25, 50]);
  });

  it("suggests round amounts inside a range, ends included, and ticks the first four", () => {
    const item = { minValue: 12, maxValue: 60, stepValue: 1 };
    expect(amountChoices(item)).toEqual([12, 15, 20, 25, 50, 60]);
    expect(defaultAmounts(item)).toEqual([12, 15, 20, 25]);
  });

  it("never offers more amounts than one link can hold", () => {
    const fixed = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(amountChoices({ fixedDenominations: fixed })).toHaveLength(MAX_LINK_DENOMINATIONS);
  });
});

describe("isOfferableAt", () => {
  it("keeps only the API's offerable amounts on a fixed item", () => {
    const item = { fixedDenominations: [5, 10, 25], offerableDenominations: [10, 25] };
    expect(isOfferableAt(item, 5)).toBe(false);
    expect(isOfferableAt(item, 10)).toBe(true);
    expect(defaultAmounts(item)).toEqual([10, 25]);
  });

  it("starts a range item at its smallest offerable amount", () => {
    const item = { minValue: 5, maxValue: 100, stepValue: 5, minOfferableValue: 15 };
    expect(isOfferableAt(item, 10)).toBe(false);
    expect(isOfferableAt(item, 15)).toBe(true);
    expect(amountChoices(item)).toContain(15);
    expect(defaultAmounts(item)[0]).toBe(15);
  });

  it("offers nothing when no amount pays, and everything sold when the API didn't say", () => {
    expect(isOfferableAt({ minValue: 5, maxValue: 100, minOfferableValue: null }, 50)).toBe(false);
    expect(isOfferableAt({ minValue: 5, maxValue: 100 }, 50)).toBe(true);
  });
});
