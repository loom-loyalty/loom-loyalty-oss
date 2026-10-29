import { describe, expect, it } from "vitest";

import { formatUpcomingTime } from "./dates";

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
