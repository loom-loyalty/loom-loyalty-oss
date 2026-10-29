import { describe, expect, it } from "vitest";

import { applyChartShape, toChartShape } from "./chart-shape";
import type { ChartShape } from "./chart-shape-types";
import { inferVisualization } from "./infer-visualization";

const TIER_COLUMNS = [
  { name: "tier_name", type: "String" },
  { name: "customer_count", type: "UInt64" },
  { name: "points_total", type: "Float64" },
];
const TIER_ROWS = [
  { tier_name: "Gold", customer_count: 120, points_total: 9000 },
  { tier_name: "Silver", customer_count: 340, points_total: 7000 },
  { tier_name: "Bronze", customer_count: 890, points_total: 3000 },
];

const TREND_COLUMNS = [
  { name: "period", type: "Date" },
  { name: "tier", type: "String" },
  { name: "members", type: "UInt64" },
];
const TREND_ROWS = [
  { period: "2026-09-01", tier: "Gold", members: 10 },
  { period: "2026-09-01", tier: "Silver", members: 20 },
  { period: "2026-09-02", tier: "Gold", members: 12 },
  { period: "2026-09-02", tier: "Silver", members: 22 },
];

describe("chart shape", () => {
  it("round-trips a manually picked pie with a chosen measure", () => {
    const plan = inferVisualization(TIER_COLUMNS, TIER_ROWS);
    const shape = toChartShape(plan, { kind: "pie", measure: "points_total", title: "Points" });

    expect(shape).toEqual({
      version: 1,
      kind: "pie",
      dimension: "tier_name",
      measure: "points_total",
      measures: ["customer_count", "points_total"],
      title: "Points",
    });

    const applied = applyChartShape(JSON.parse(JSON.stringify(shape)), TIER_COLUMNS, TIER_ROWS);
    expect(applied.fallbackReason).toBeUndefined();
    expect(applied.plan.kind).toBe("pie");
    expect(applied.plan.dimension).toBe("tier_name");
    expect(applied.measure).toBe("points_total");
  });

  it("honors a manual choice that differs from the inferred kind", () => {
    const plan = inferVisualization(TIER_COLUMNS, TIER_ROWS);
    const applied = applyChartShape(toChartShape(plan, { kind: "bar" }), TIER_COLUMNS, TIER_ROWS);
    expect(applied.plan.kind).toBe("bar");
    expect(applied.fallbackReason).toBeUndefined();
  });

  it("AE2: falls back to the inferred plan when the series column is gone", () => {
    const stored = toChartShape(inferVisualization(TREND_COLUMNS, TREND_ROWS), { kind: "line" });
    expect(stored.series).toBe("tier");

    const editedColumns = [TIER_COLUMNS[0]!, TIER_COLUMNS[1]!];
    const editedRows = TIER_ROWS.map(({ tier_name, customer_count }) => ({
      tier_name,
      customer_count,
    }));
    const applied = applyChartShape(stored, editedColumns, editedRows);

    expect(applied.plan).toEqual(inferVisualization(editedColumns, editedRows));
    expect(applied.fallbackReason).toMatch(/tier/);
  });

  it("falls back for an unknown kind", () => {
    const shape = { version: 1, kind: "scatter" } as unknown as ChartShape;
    const applied = applyChartShape(shape, TIER_COLUMNS, TIER_ROWS);
    expect(applied.plan.kind).toBe("pie");
    expect(applied.fallbackReason).toMatch(/not supported/);
  });

  it("falls back for a kind that is not honest for the data", () => {
    const shape: ChartShape = { version: 1, kind: "line", dimension: "tier_name" };
    const applied = applyChartShape(shape, TIER_COLUMNS, TIER_ROWS);
    expect(applied.plan.kind).toBe("pie");
    expect(applied.fallbackReason).toMatch(/no longer fits/);
  });

  it("falls back for an unsupported version", () => {
    const shape = { version: 2, kind: "bar" } as unknown as ChartShape;
    expect(applyChartShape(shape, TIER_COLUMNS, TIER_ROWS).fallbackReason).toMatch(/version/);
  });

  it("falls back when the stored measure is no longer numeric", () => {
    const shape: ChartShape = {
      version: 1,
      kind: "bar",
      dimension: "tier_name",
      measure: "tier_name",
    };
    const applied = applyChartShape(shape, TIER_COLUMNS, TIER_ROWS);
    expect(applied.plan).toEqual(inferVisualization(TIER_COLUMNS, TIER_ROWS));
    expect(applied.fallbackReason).toBe(
      '"tier_name" is no longer a numeric measure in this result.'
    );
  });

  it("falls back when a stored measures entry is no longer numeric", () => {
    const shape: ChartShape = {
      version: 1,
      kind: "bar",
      dimension: "tier_name",
      measure: "customer_count",
      measures: ["customer_count", "tier_name"],
    };
    expect(applyChartShape(shape, TIER_COLUMNS, TIER_ROWS).fallbackReason).toMatch(
      /"tier_name" is no longer a numeric measure/
    );
  });

  it("does not check measures for a table", () => {
    const shape: ChartShape = { version: 1, kind: "table", measure: "tier_name" };
    expect(applyChartShape(shape, TIER_COLUMNS, TIER_ROWS).fallbackReason).toBeUndefined();
  });

  it("falls back instead of throwing for non-array measures", () => {
    const shape = { version: 1, kind: "bar", measures: "customer_count" } as unknown as ChartShape;
    const applied = applyChartShape(shape, TIER_COLUMNS, TIER_ROWS);
    expect(applied.plan.kind).toBe(inferVisualization(TIER_COLUMNS, TIER_ROWS).kind);
    expect(applied.fallbackReason).toMatch(/malformed/);
  });

  it("uses the first inferred measure when the stored measure is empty", () => {
    const shape: ChartShape = { version: 1, kind: "bar", dimension: "tier_name", measure: "" };
    const applied = applyChartShape(shape, TIER_COLUMNS, TIER_ROWS);
    expect(applied.fallbackReason).toBeUndefined();
    expect(applied.measure).toBe(inferVisualization(TIER_COLUMNS, TIER_ROWS).measures[0]);
  });

  it("truncates long column names in the fallback text", () => {
    const long = "x".repeat(200);
    const shape: ChartShape = { version: 1, kind: "bar", dimension: long };
    const reason = applyChartShape(shape, TIER_COLUMNS, TIER_ROWS).fallbackReason ?? "";
    expect(reason).toContain(`${"x".repeat(60)}…`);
    expect(reason).not.toContain("x".repeat(61));
  });
});
