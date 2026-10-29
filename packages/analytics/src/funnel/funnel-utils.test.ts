import { describe, expect, it } from "vitest";

import type { CustomerFunnelRow } from "../types";
import { isFunnelDataEmpty } from "./funnel-utils";

function row(customer_count: number, stage_order = 1): CustomerFunnelRow {
  return { stage_order, stage: "Awareness", customer_count, pct_of_total: 0 };
}

describe("isFunnelDataEmpty", () => {
  it("treats a literally empty array as empty", () => {
    expect(isFunnelDataEmpty([])).toBe(true);
  });

  it("treats a fresh tenant (all 9 stages at count 0) as empty", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(0, i + 1));
    expect(isFunnelDataEmpty(rows)).toBe(true);
  });

  it("is NOT empty when any stage has customers", () => {
    expect(isFunnelDataEmpty([row(0, 1), row(5, 2), row(0, 3)])).toBe(false);
  });

  it("guards against an inverted predicate — a single non-zero row renders the funnel", () => {
    expect(isFunnelDataEmpty([row(1)])).toBe(false);
  });
});
