import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formatInZone,
  isSameLocalDay,
  localDayKey,
  resolveTimeZone,
  toInstant,
} from "./zoned-dates";

const CHICAGO = "America/Chicago";
const NEW_YORK = "America/New_York";

describe("toInstant", () => {
  it("reads an offset timestamp as that instant", () => {
    expect(toInstant("2026-11-19T20:00:00Z")?.toISOString()).toBe("2026-11-19T20:00:00.000Z");
    expect(toInstant("2026-11-19T14:00:00-06:00")?.toISOString()).toBe("2026-11-19T20:00:00.000Z");
  });

  it("reads a timestamp with no offset as UTC, never as the phone's local time", () => {
    expect(toInstant("2026-11-19T20:00:00")?.toISOString()).toBe("2026-11-19T20:00:00.000Z");
    expect(toInstant("2026-11-19T20:00:00.123456")?.toISOString()).toBe("2026-11-19T20:00:00.123Z");
  });

  it("returns null for junk", () => {
    expect(toInstant("")).toBeNull();
    expect(toInstant("not a date")).toBeNull();
  });
});

describe("resolveTimeZone (D3b)", () => {
  it("keeps a valid IANA zone", () => {
    expect(resolveTimeZone(CHICAGO)).toBe(CHICAGO);
  });

  it("falls back to the runtime default (undefined) when Intl rejects the zone", () => {
    expect(resolveTimeZone("Mars/Olympus_Mons")).toBeUndefined();
    expect(resolveTimeZone("")).toBeUndefined();
    expect(resolveTimeZone(undefined)).toBeUndefined();
  });
});

describe("isSameLocalDay (A2, A3, A3c)", () => {
  it("A2: a check-in earlier today is today", () => {
    expect(isSameLocalDay("2026-11-19T15:00:00Z", new Date("2026-11-19T20:00:00Z"), CHICAGO)).toBe(
      true
    );
  });

  it("A3: a check-in at 11:30 PM yesterday (phone time) is not today", () => {
    // 11:30 PM CT on Nov 18 = 05:30Z Nov 19, so the UTC dates match but the local days don't.
    expect(isSameLocalDay("2026-11-19T05:30:00Z", new Date("2026-11-19T20:00:00Z"), CHICAGO)).toBe(
      false
    );
  });

  it("an exactly-midnight check-in belongs to the new day", () => {
    // 00:00 CT Nov 19 = 06:00Z.
    expect(isSameLocalDay("2026-11-19T06:00:00Z", new Date("2026-11-19T20:00:00Z"), CHICAGO)).toBe(
      true
    );
    expect(isSameLocalDay("2026-11-19T05:59:59Z", new Date("2026-11-19T20:00:00Z"), CHICAGO)).toBe(
      false
    );
  });

  it("handles the DST fall-back day (25 hours long)", () => {
    // 2026-11-01 in Chicago: 00:30 CDT = 05:30Z, 23:30 CST = 05:30Z next day.
    const morning = "2026-11-01T05:30:00Z";
    expect(isSameLocalDay(morning, new Date("2026-11-02T05:29:00Z"), CHICAGO)).toBe(true);
    expect(isSameLocalDay(morning, new Date("2026-11-02T06:00:00Z"), CHICAGO)).toBe(false);
  });

  const zones = [CHICAGO, NEW_YORK, "Europe/London", "Asia/Kolkata", "Australia/Lord_Howe", "UTC"];
  const instant = fc
    .integer({ min: Date.UTC(2025, 0, 1), max: Date.UTC(2028, 0, 1) })
    .map((ms) => new Date(ms));

  // Fixed-offset zones have an oracle that doesn't go through Intl: shift the instant by the
  // zone's offset and read the UTC calendar date.
  const fixedOffsetMinutes: Record<string, number> = {
    UTC: 0,
    "Asia/Kolkata": 330,
    "Etc/GMT+6": -360,
  };
  const utcDateAfterShift = (date: Date, minutes: number) =>
    new Date(date.getTime() + minutes * 60_000).toISOString().slice(0, 10);

  it("A3c property: same local day iff the shifted calendar dates match (fixed-offset zones)", () => {
    fc.assert(
      fc.property(
        instant,
        instant,
        fc.constantFrom(...Object.keys(fixedOffsetMinutes)),
        (event, now, zone) => {
          const offset = fixedOffsetMinutes[zone] ?? 0;
          const expected = utcDateAfterShift(event, offset) === utcDateAfterShift(now, offset);
          expect(localDayKey(event, zone)).toBe(utcDateAfterShift(event, offset));
          expect(isSameLocalDay(event.toISOString(), now, zone)).toBe(expected);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("handles the DST spring-forward day (23 hours long)", () => {
    // 2026-03-08 in Chicago: 00:00 CST = 06:00Z, 23:59 CDT = 04:59Z next day.
    const midnight = "2026-03-08T06:00:00Z";
    expect(isSameLocalDay(midnight, new Date("2026-03-09T04:59:00Z"), CHICAGO)).toBe(true);
    expect(isSameLocalDay(midnight, new Date("2026-03-09T05:00:00Z"), CHICAGO)).toBe(false);
    expect(isSameLocalDay("2026-03-08T05:59:00Z", new Date("2026-03-08T12:00:00Z"), CHICAGO)).toBe(
      false
    );
  });

  it("A3c property: a check-in is today exactly when it falls between local midnights", () => {
    fc.assert(
      fc.property(instant, fc.constantFrom(...zones), (now, zone) => {
        const today = localDayKey(now, zone);
        // Any instant within the same local day must report today; stepping back past the
        // start of that day must not. Walk back minute by minute from now to find local midnight.
        let start = now.getTime();
        while (localDayKey(new Date(start - 60_000), zone) === today) start -= 60_000;
        const lastMinuteOfYesterday = new Date(start - 60_000);
        expect(isSameLocalDay(new Date(start).toISOString(), now, zone)).toBe(true);
        expect(isSameLocalDay(lastMinuteOfYesterday.toISOString(), now, zone)).toBe(false);
      }),
      { numRuns: 60 }
    );
    // Walks back minute by minute to local midnight: slow by design.
  }, 60_000);

  it("localDayKey is a YYYY-MM-DD calendar date in the zone", () => {
    expect(localDayKey(new Date("2026-11-19T05:30:00Z"), CHICAGO)).toBe("2026-11-18");
    expect(localDayKey(new Date("2026-11-19T05:30:00Z"), "UTC")).toBe("2026-11-19");
  });
});

describe("formatInZone", () => {
  const SHORT_DAY: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit" };

  it("formats the local day of the instant in the zone", () => {
    // 05:59:59Z on Nov 30 is 11:59:59 PM on Nov 29 in Chicago.
    expect(formatInZone("2026-11-30T05:59:59Z", CHICAGO, SHORT_DAY)).toBe("11/29");
    expect(formatInZone("2026-11-30T05:59:59Z", "Europe/London", SHORT_DAY)).toBe("11/30");
  });

  it("reads an offset-less timestamp as UTC", () => {
    expect(formatInZone("2026-11-30T05:59:59", CHICAGO, SHORT_DAY)).toBe("11/29");
  });

  it("accepts a Date", () => {
    expect(
      formatInZone(new Date("2026-11-01T03:00:00Z"), CHICAGO, { month: "short", year: "numeric" })
    ).toBe("Oct 2026");
  });

  it("returns empty text for a missing or invalid instant", () => {
    expect(formatInZone(undefined, CHICAGO, SHORT_DAY)).toBe("");
    expect(formatInZone("nope", CHICAGO, SHORT_DAY)).toBe("");
    expect(formatInZone(new Date(Number.NaN), CHICAGO, SHORT_DAY)).toBe("");
  });

  it("falls back to the runtime zone when Intl rejects the zone", () => {
    expect(formatInZone("2026-11-30T12:00:00Z", "Mars/Olympus_Mons", SHORT_DAY)).toBe(
      formatInZone("2026-11-30T12:00:00Z", undefined, SHORT_DAY)
    );
  });

  it("uses plain spaces before AM/PM", () => {
    expect(
      formatInZone("2026-11-19T20:00:00Z", NEW_YORK, { hour: "numeric", minute: "2-digit" })
    ).toBe("3:00 PM");
  });

  // Fixed-offset oracle that doesn't go through Intl, incl. zones a day or more from UTC.
  const fixedOffsetMinutes: Record<string, number> = {
    UTC: 0,
    "Pacific/Kiritimati": 14 * 60,
    "Pacific/Pago_Pago": -11 * 60,
    "Asia/Kolkata": 330,
    "Etc/GMT+6": -360,
  };

  it("property: the formatted day is the zone's calendar day of the instant", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2025, 0, 1), max: Date.UTC(2028, 0, 1) }),
        fc.constantFrom(...Object.keys(fixedOffsetMinutes)),
        (ms, zone) => {
          const shifted = new Date(ms + (fixedOffsetMinutes[zone] ?? 0) * 60_000).toISOString();
          const expected = `${shifted.slice(5, 7)}/${shifted.slice(8, 10)}`;
          expect(formatInZone(new Date(ms).toISOString(), zone, SHORT_DAY)).toBe(expected);
        }
      ),
      { numRuns: 500 }
    );
  });
});
