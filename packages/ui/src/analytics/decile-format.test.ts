import { describe, expect, it } from "vitest";

import { formatCurrency } from "./decile-format";

describe("formatCurrency", () => {
  it("formats positive values compactly", () => {
    expect(formatCurrency(567)).toBe("$567");
    expect(formatCurrency(3_400)).toBe("$3.4k");
    expect(formatCurrency(1_200_000)).toBe("$1.20M");
  });

  it("places the minus sign before the $ for negative values (COST / MARGIN)", () => {
    expect(formatCurrency(-567)).toBe("-$567");
    expect(formatCurrency(-1_500)).toBe("-$1.5k");
    expect(formatCurrency(-2_300_000)).toBe("-$2.30M");
  });

  it("formats zero without a sign", () => {
    expect(formatCurrency(0)).toBe("$0");
  });
});
