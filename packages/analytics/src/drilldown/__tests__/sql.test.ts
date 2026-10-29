import { describe, expect, it } from "vitest";

import { sqlDate, sqlDateTimeRange, sqlString } from "../sql";

describe("sqlString", () => {
  it("quotes a plain value", () => {
    expect(sqlString("GOLD")).toBe("'GOLD'");
  });

  it("escapes the apostrophes that appear in real offer names", () => {
    expect(sqlString("Mother's Day")).toBe("'Mother\\'s Day'");
  });

  it("escapes backslashes before quotes, so an escape cannot be re-escaped", () => {
    expect(sqlString("back\\slash")).toBe("'back\\\\slash'");
    expect(sqlString("both\\'x")).toBe("'both\\\\\\'x'");
  });

  it("leaves a value that would otherwise terminate the literal inert", () => {
    // The trailing quote is escaped, so the following text stays inside the
    // literal rather than becoming SQL.
    expect(sqlString("' OR 1=1 --")).toBe("'\\' OR 1=1 --'");
  });
});

describe("sqlDateTimeRange", () => {
  it("reaches into the day after the end date, keeping the final day's rows", () => {
    const clause = sqlDateTimeRange("event_datetime", "2026-07-27", "2026-08-26");
    expect(clause).toBe(
      "event_datetime >= toDate('2026-07-27') AND event_datetime < toDate('2026-08-26') + INTERVAL 1 DAY"
    );
  });

  it("builds a date literal from an ISO date", () => {
    expect(sqlDate("2026-08-26")).toBe("toDate('2026-08-26')");
  });
});
