import { describe, expect, it } from "vitest";

import { formatUpcomingTime, toISODateUTC } from "./dates";

describe("formatUpcomingTime", () => {
  it("shows only the clock time for a moment later today", () => {
    const now = new Date(2026, 9, 14, 9, 0);
    const later = new Date(2026, 9, 14, 17, 0);

    expect(formatUpcomingTime(later, now)).toBe("5:00 PM");
  });

  it("adds the weekday for a moment on another day", () => {
    const now = new Date(2026, 9, 14, 21, 0);
    const tomorrow = new Date(2026, 9, 15, 0, 0);

    expect(formatUpcomingTime(tomorrow, now)).toBe("Thursday 12:00 AM");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatUpcomingTime(new Date(Number.NaN))).toBe("");
  });
});

describe("toISODateUTC", () => {
  it("returns the UTC calendar day, not the local one", () => {
    // 11:30 PM CST on Nov 17 is already Nov 18 in UTC.
    expect(toISODateUTC(new Date("2026-11-18T05:30:00Z"))).toBe("2026-11-18");
    expect(toISODateUTC(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("returns an empty string for an invalid date", () => {
    expect(toISODateUTC(new Date(Number.NaN))).toBe("");
  });
});
