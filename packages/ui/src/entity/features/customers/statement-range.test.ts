import { describe, expect, it } from "vitest";

import {
  lastTwelveMonthsUtc,
  statementRangePresets,
  statementRangeQuery,
  validateStatementRange,
} from "./statement-range";

// 2:28 AM CT on Nov 18 is 08:28 UTC on Nov 18.
const NOW = new Date("2026-11-18T08:28:00Z");

describe("lastTwelveMonthsUtc (case 26 default)", () => {
  it("is the last 12 full UTC calendar months", () => {
    expect(lastTwelveMonthsUtc(NOW)).toEqual({ start: "2025-11-01", end: "2026-10-31" });
  });

  it("counts the UTC month, not the local one", () => {
    // 7 PM CT on Nov 30 is already Dec 1 in UTC, so November is a full month.
    expect(lastTwelveMonthsUtc(new Date("2026-12-01T01:00:00Z"))).toEqual({
      start: "2025-12-01",
      end: "2026-11-30",
    });
  });

  it("wraps the year in January", () => {
    expect(lastTwelveMonthsUtc(new Date("2027-01-15T12:00:00Z"))).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });
});

describe("statementRangeQuery (case 26, the API's date filter)", () => {
  it("sends UTC midnights, with the end day included", () => {
    expect(statementRangeQuery({ start: "2025-11-01", end: "2026-10-31" })).toEqual({
      startDateTime: "2025-11-01T00:00:00Z",
      endDateTime: "2026-11-01T00:00:00Z",
    });
  });

  it("rolls the end over a month and a year", () => {
    expect(statementRangeQuery({ start: "2026-12-01", end: "2026-12-31" }).endDateTime).toBe(
      "2027-01-01T00:00:00Z"
    );
  });
});

describe("validateStatementRange", () => {
  it("accepts a range of whole days", () => {
    expect(validateStatementRange("2026-10-01", "2026-10-31")).toBeNull();
    expect(validateStatementRange("2026-10-01", "2026-10-01")).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(validateStatementRange("2026-10-10", "2026-10-09")).toMatch(/on or after/i);
  });

  it("rejects a missing or malformed date", () => {
    expect(validateStatementRange("", "2026-10-09")).toMatch(/date/i);
    expect(validateStatementRange("2026-02-30", "2026-10-09")).toMatch(/date/i);
  });
});

describe("statementRangePresets", () => {
  it("offers whole-month ranges ending with last month", () => {
    const presets = statementRangePresets(NOW);
    expect(presets.map((p) => p.key)).toEqual([
      "last-3-months",
      "last-12-months",
      "last-24-months",
      "this-year",
    ]);
    expect(presets[0]!.resolve()).toEqual({ startDate: "2026-08-01", endDate: "2026-10-31" });
    expect(presets[1]!.resolve()).toEqual({ startDate: "2025-11-01", endDate: "2026-10-31" });
    expect(presets[2]!.resolve()).toEqual({ startDate: "2024-11-01", endDate: "2026-10-31" });
    expect(presets[3]!.resolve()).toEqual({ startDate: "2026-01-01", endDate: "2026-10-31" });
    for (const preset of presets) {
      const { startDate, endDate } = preset.resolve();
      expect(validateStatementRange(startDate, endDate), preset.key).toBeNull();
    }
  });

  it("leaves out this year in January, when no month of it has ended", () => {
    const jan = new Date("2027-01-20T10:00:00Z");
    expect(statementRangePresets(jan).map((p) => p.key)).not.toContain("this-year");
  });
});
