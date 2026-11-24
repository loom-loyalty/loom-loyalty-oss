import { es } from "date-fns/locale";
import { describe, expect, it } from "vitest";

import { formatDate, formatUpcomingTime, toISODateUTC } from "./dates";

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

describe("formatDate locale option", () => {
  // Bilingual wallet-pass brief: the Spanish Latest Offer date reads "18 nov". Every month is
  // pinned so a date-fns upgrade that changes an abbreviation fails here, not on a member's pass.
  const SPANISH_MONTHS = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];

  it.each(SPANISH_MONTHS.map((month, index) => [index, month] as const))(
    "formats month %i as %s in Spanish with d MMM",
    (monthIndex, month) => {
      const isoDay = `2026-${String(monthIndex + 1).padStart(2, "0")}-18`;

      expect(formatDate(isoDay, "d MMM", { locale: es })).toBe(`18 ${month}`);
    }
  );

  it("is unchanged without a locale", () => {
    expect(formatDate("2026-11-18", "MMM d")).toBe("Nov 18");
    expect(formatDate("2026-11-18", "MMM d", {})).toBe("Nov 18");
  });

  it("still returns empty for an empty or invalid date with a locale", () => {
    expect(formatDate(null, "d MMM", { locale: es })).toBe("");
    expect(formatDate("not a date", "d MMM", { locale: es })).toBe("");
  });
});
