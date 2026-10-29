import { describe, expect, it } from "vitest";

import {
  MAX_PIE_SLICES,
  MAX_SERIES,
  classifyColumn,
  inferVisualization,
  toNumber,
} from "./infer-visualization";

const meta = (...pairs: Array<[string, string]>): Array<{ name: string; type: string }> =>
  pairs.map(([name, type]) => ({ name, type }));

describe("classifyColumn", () => {
  it("classifies the ClickHouse families the pipes actually return", () => {
    expect(classifyColumn("DateTime64(3)")).toBe("temporal");
    expect(classifyColumn("Date")).toBe("temporal");
    expect(classifyColumn("UInt64")).toBe("numeric");
    expect(classifyColumn("Float64")).toBe("numeric");
    expect(classifyColumn("Decimal(18, 2)")).toBe("numeric");
    expect(classifyColumn("String")).toBe("categorical");
    expect(classifyColumn("UUID")).toBe("categorical");
  });

  it("sees through Nullable and LowCardinality wrappers", () => {
    expect(classifyColumn("Nullable(Float64)")).toBe("numeric");
    expect(classifyColumn("LowCardinality(String)")).toBe("categorical");
    expect(classifyColumn("Nullable(LowCardinality(String))")).toBe("categorical");
    expect(classifyColumn("Nullable(DateTime)")).toBe("temporal");
  });

  it("does not treat an array of numbers as a measure", () => {
    expect(classifyColumn("Array(UInt64)")).toBe("other");
    expect(classifyColumn("Map(String, UInt64)")).toBe("other");
  });
});

describe("toNumber", () => {
  it("accepts the strings TinyBird uses for wide integer types", () => {
    expect(toNumber("12450")).toBe(12450);
    expect(toNumber(12450)).toBe(12450);
  });

  it("rejects values that would render as NaN on an axis", () => {
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });
});

describe("inferVisualization", () => {
  it("falls back to the table when there are no rows", () => {
    const plan = inferVisualization(meta(["tier", "String"], ["n", "UInt64"]), []);
    expect(plan.kind).toBe("table");
    expect(plan.available).toEqual(["table"]);
  });

  it("keeps a single aggregate row as values rather than a one-mark chart", () => {
    const plan = inferVisualization(meta(["total_customers", "UInt64"], ["active", "UInt64"]), [
      { total_customers: 2847, active: 1900 },
    ]);
    expect(plan.kind).toBe("table");
  });

  it("picks a line chart when a time column is present", () => {
    const plan = inferVisualization(meta(["period", "DateTime"], ["event_count", "UInt64"]), [
      { period: "2026-08-01 00:00:00", event_count: 10 },
      { period: "2026-08-02 00:00:00", event_count: 14 },
    ]);
    expect(plan.kind).toBe("line");
    expect(plan.dimension).toBe("period");
    expect(plan.measures).toEqual(["event_count"]);
  });

  it("prefers the trend reading when a result has both a time and a label column", () => {
    const plan = inferVisualization(
      meta(["period", "Date"], ["event_type_code", "String"], ["event_count", "UInt64"]),
      [
        { period: "2026-08-01", event_type_code: "PURCHASE", event_count: 10 },
        { period: "2026-08-02", event_type_code: "PURCHASE", event_count: 14 },
      ]
    );
    expect(plan.kind).toBe("line");
    // One row per period, so there is nothing to split on.
    expect(plan.series).toBeUndefined();
  });

  it("splits a repeated time axis into one line per category", () => {
    // The Event Volume drill-down groups by period AND event type, so each
    // period carries several rows. Drawn without a series they would join into
    // one zigzag across unrelated event types.
    const plan = inferVisualization(
      meta(["period", "DateTime"], ["event_type_code", "String"], ["event_count", "UInt64"]),
      [
        { period: "2026-08-01 00:00:00", event_type_code: "PURCHASE", event_count: 10 },
        { period: "2026-08-01 00:00:00", event_type_code: "REFUND", event_count: 2 },
        { period: "2026-08-02 00:00:00", event_type_code: "PURCHASE", event_count: 14 },
        { period: "2026-08-02 00:00:00", event_type_code: "REFUND", event_count: 1 },
      ]
    );
    expect(plan.kind).toBe("line");
    expect(plan.dimension).toBe("period");
    expect(plan.series).toBe("event_type_code");
    expect(plan.reason).toMatch(/2 series/);
  });

  it("refuses to chart a repeated time axis with nothing to split on", () => {
    const plan = inferVisualization(meta(["period", "DateTime"], ["event_count", "UInt64"]), [
      { period: "2026-08-01 00:00:00", event_count: 10 },
      { period: "2026-08-01 00:00:00", event_count: 2 },
    ]);
    expect(plan.kind).toBe("table");
    expect(plan.reason).toMatch(/no column to separate them/);
  });

  it("falls back to the table past the colour budget for distinct lines", () => {
    const rows = Array.from({ length: MAX_SERIES + 1 }, (_, i) => [
      { period: "2026-08-01 00:00:00", code: `T${String(i)}`, n: i },
      { period: "2026-08-02 00:00:00", code: `T${String(i)}`, n: i + 1 },
    ]).flat();
    const plan = inferVisualization(
      meta(["period", "DateTime"], ["code", "String"], ["n", "UInt64"]),
      rows
    );
    expect(plan.kind).toBe("table");
    expect(plan.reason).toMatch(/too many to plot as distinct lines/);
  });

  it("picks a pie for a small non-negative breakdown, and offers bar alongside", () => {
    const plan = inferVisualization(meta(["tier_name", "String"], ["customer_count", "UInt64"]), [
      { tier_name: "Gold", customer_count: 120 },
      { tier_name: "Silver", customer_count: 340 },
      { tier_name: "Bronze", customer_count: 890 },
    ]);
    expect(plan.kind).toBe("pie");
    expect(plan.available).toEqual(["pie", "bar", "table"]);
    expect(plan.dimension).toBe("tier_name");
  });

  it("withholds the pie once slices outnumber what the eye can compare", () => {
    const rows = Array.from({ length: MAX_PIE_SLICES + 1 }, (_, i) => ({
      offer_code: `OFFER_${String(i)}`,
      coupons: i + 1,
    }));
    const plan = inferVisualization(meta(["offer_code", "String"], ["coupons", "UInt64"]), rows);
    expect(plan.kind).toBe("bar");
    expect(plan.available).not.toContain("pie");
  });

  it("withholds the pie when a measure goes negative, since parts of a whole cannot", () => {
    const plan = inferVisualization(
      meta(["program_currency_code", "String"], ["net_change", "Int64"]),
      [
        { program_currency_code: "POINTS", net_change: 400 },
        { program_currency_code: "MILES", net_change: -120 },
      ]
    );
    expect(plan.kind).toBe("bar");
    expect(plan.available).not.toContain("pie");
  });

  it("refuses to chart a label column that repeats, which would merge rows", () => {
    const plan = inferVisualization(meta(["tier_name", "String"], ["customer_count", "UInt64"]), [
      { tier_name: "Gold", customer_count: 5 },
      { tier_name: "Gold", customer_count: 7 },
    ]);
    expect(plan.kind).toBe("table");
    expect(plan.reason).toMatch(/more than once/);
  });

  it("prefers a unique label column over an earlier repeating one", () => {
    const plan = inferVisualization(
      meta(["discount_type", "String"], ["offer_code", "String"], ["coupons", "UInt64"]),
      [
        { discount_type: "PERCENT", offer_code: "A", coupons: 5 },
        { discount_type: "PERCENT", offer_code: "B", coupons: 7 },
      ]
    );
    expect(plan.kind).toBe("pie");
    expect(plan.dimension).toBe("offer_code");
  });

  it("falls back to the table past the legible bar-count ceiling", () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      customer_id: String(i),
      total_earned: i,
    }));
    const plan = inferVisualization(
      meta(["customer_id", "String"], ["total_earned", "Float64"]),
      rows
    );
    expect(plan.kind).toBe("table");
    expect(plan.available).toEqual(["table"]);
  });

  it("falls back to the table when nothing numeric can be measured", () => {
    const plan = inferVisualization(meta(["customer_id", "String"], ["status", "String"]), [
      { customer_id: "a", status: "ACTIVE" },
      { customer_id: "b", status: "ACTIVE" },
    ]);
    expect(plan.kind).toBe("table");
  });

  it("ignores tenant-isolation columns when choosing an axis", () => {
    const plan = inferVisualization(
      meta(["organization_id", "String"], ["tier_name", "String"], ["n", "UInt64"]),
      [
        { organization_id: "org_1", tier_name: "Gold", n: 3 },
        { organization_id: "org_1", tier_name: "Silver", n: 9 },
      ]
    );
    expect(plan.dimension).toBe("tier_name");
    expect(plan.columns.map((c) => c.name)).not.toContain("organization_id");
  });

  it("always leaves the table available as an escape hatch", () => {
    const plan = inferVisualization(meta(["period", "DateTime"], ["n", "UInt64"]), [
      { period: "2026-08-01 00:00:00", n: 1 },
      { period: "2026-08-02 00:00:00", n: 2 },
    ]);
    expect(plan.available).toContain("table");
  });
});
