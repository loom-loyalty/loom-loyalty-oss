import { describe, expect, it } from "vitest";

import {
  lastFullMonthUtc,
  liabilityPeriodPresets,
  monthBefore,
  validateLiabilityPeriod,
} from "./liability-period";

// 9:28 PM CT on Nov 17 is 03:28 UTC on Nov 18: the UTC day is what counts.
const NOW = new Date("2026-11-18T03:28:00Z");

describe("lastFullMonthUtc (case 19)", () => {
  it("is the previous UTC calendar month", () => {
    expect(lastFullMonthUtc(NOW)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });

  it("wraps the year in January", () => {
    expect(lastFullMonthUtc(new Date("2027-01-15T12:00:00Z"))).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
  });

  it("is always a valid period, even on the first of a month", () => {
    const firstOfMonth = new Date("2026-12-01T00:05:00Z");
    const period = lastFullMonthUtc(firstOfMonth);
    expect(period).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(validateLiabilityPeriod(period.start, period.end, firstOfMonth)).toBeNull();
  });
});

describe("monthBefore (case 22)", () => {
  it("steps back one calendar month, handling short months", () => {
    expect(monthBefore({ start: "2026-03-01", end: "2026-03-31" })).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(monthBefore({ start: "2026-01-01", end: "2026-01-31" })).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });
});

describe("validateLiabilityPeriod (case 21, the API's 400 rule)", () => {
  it("accepts a period that ends yesterday (UTC)", () => {
    expect(validateLiabilityPeriod("2026-11-01", "2026-11-17", NOW)).toBeNull();
  });

  it("rejects a period that ends today or later (UTC)", () => {
    expect(validateLiabilityPeriod("2026-11-01", "2026-11-18", NOW)).toMatch(/before today/i);
    expect(validateLiabilityPeriod("2026-11-01", "2026-12-01", NOW)).toMatch(/before today/i);
  });

  it("rejects an end before the start", () => {
    expect(validateLiabilityPeriod("2026-10-10", "2026-10-09", NOW)).toMatch(/on or after/i);
  });

  it("accepts 366 days and rejects 367", () => {
    expect(validateLiabilityPeriod("2025-11-17", "2026-11-17", NOW)).toBeNull();
    expect(validateLiabilityPeriod("2025-11-16", "2026-11-17", NOW)).toMatch(/366 days/);
  });

  it("rejects a malformed date", () => {
    expect(validateLiabilityPeriod("2026-13-01", "2026-11-17", NOW)).toMatch(/date/i);
    expect(validateLiabilityPeriod("", "2026-11-17", NOW)).toMatch(/date/i);
  });
});

describe("liabilityPeriodPresets", () => {
  it("offers only valid periods", () => {
    const presets = liabilityPeriodPresets(NOW);
    expect(presets.map((p) => p.key)).toEqual([
      "last-month",
      "month-before",
      "last-30-days",
      "year-to-date",
    ]);
    for (const preset of presets) {
      const { startDate, endDate } = preset.resolve();
      expect(validateLiabilityPeriod(startDate, endDate, NOW), preset.key).toBeNull();
    }
    expect(presets[2]!.resolve()).toEqual({ startDate: "2026-10-19", endDate: "2026-11-17" });
    expect(presets[3]!.resolve()).toEqual({ startDate: "2026-01-01", endDate: "2026-11-17" });
  });

  it("leaves out year to date on Jan 1, when it would be empty", () => {
    const jan1 = new Date("2027-01-01T10:00:00Z");
    expect(liabilityPeriodPresets(jan1).map((p) => p.key)).not.toContain("year-to-date");
  });
});
