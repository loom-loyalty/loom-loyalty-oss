import { describe, expect, it } from "vitest";

import { formatDurationPeriod } from "./format-duration-period.js";

type FixedDurationDateTimePeriod = NonNullable<
  Parameters<typeof formatDurationPeriod>[0]
>["fixedDurationDateTimePeriod"];

function fixedDateTimePeriod(
  startDateTime: string,
  endDateTime?: string
): FixedDurationDateTimePeriod {
  // Generated DateTimePeriod required fields are a confirmed backend OpenAPI spec-gen artifact.
  return { startDateTime, ...(endDateTime ? { endDateTime } : {}) } as FixedDurationDateTimePeriod;
}

describe("formatDurationPeriod", () => {
  it("returns null for undefined input", () => {
    expect(formatDurationPeriod(undefined)).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(formatDurationPeriod({})).toBeNull();
  });

  it("formats sliding period with value and unit", () => {
    expect(
      formatDurationPeriod({
        durationPeriodType: "SLIDING",
        durationPeriod: "DAYS",
        durationPeriodValue: 30,
      })
    ).toBe("30 Days (Sliding)");
  });

  it("formats calendar period with value and unit", () => {
    expect(
      formatDurationPeriod({
        durationPeriodType: "CALENDAR",
        durationPeriod: "MONTHS",
        durationPeriodValue: 12,
      })
    ).toBe("12 Months (Calendar)");
  });

  it("formats period with years unit", () => {
    expect(
      formatDurationPeriod({
        durationPeriodType: "SLIDING",
        durationPeriod: "YEARS",
        durationPeriodValue: 1,
      })
    ).toBe("1 Years (Sliding)");
  });

  it("formats period with weeks unit", () => {
    expect(
      formatDurationPeriod({
        durationPeriodType: "SLIDING",
        durationPeriod: "WEEKS",
        durationPeriodValue: 4,
      })
    ).toBe("4 Weeks (Sliding)");
  });

  it("formats value+unit without type label when type is missing", () => {
    expect(
      formatDurationPeriod({
        durationPeriod: "MONTHS",
        durationPeriodValue: 6,
      })
    ).toBe("6 Months");
  });

  it("formats fixed period with start and end dates", () => {
    const result = formatDurationPeriod({
      durationPeriodType: "FIXED",
      durationPeriod: "FIXED",
      fixedDurationDateTimePeriod: fixedDateTimePeriod(
        "2025-01-01T00:00:00.000Z",
        "2025-12-31T00:00:00.000Z"
      ),
    });
    expect(result).toContain("\u2013");
    expect(result).not.toBeNull();
  });

  it("formats fixed period with only start date as ongoing", () => {
    const result = formatDurationPeriod({
      durationPeriodType: "FIXED",
      durationPeriod: "FIXED",
      fixedDurationDateTimePeriod: fixedDateTimePeriod("2025-01-01T00:00:00.000Z"),
    });
    expect(result).toContain("ongoing");
  });

  it("returns null for fixed type without fixedDurationDateTimePeriod", () => {
    expect(
      formatDurationPeriod({
        durationPeriodType: "FIXED",
        durationPeriod: "FIXED",
      })
    ).toBeNull();
  });
});
