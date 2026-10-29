import { describe, expect, it } from "vitest";

import {
  bandEdges,
  funnelRowHeights,
  funnelWidths,
  MIN_SEGMENT,
  SELECTED_MULTIPLIER,
  trapezoidPoints,
} from "./funnel-sizing";

describe("funnelWidths", () => {
  it("returns empty array for empty input", () => {
    expect(funnelWidths([], 0)).toEqual([]);
  });

  it("collapses every stage to MIN_SEGMENT when max=0 (fresh tenant)", () => {
    const widths = funnelWidths([0, 0, 0, 0, 0, 0, 0, 0, 0], 0);
    expect(widths).toHaveLength(9);
    widths.forEach((w) => expect(w).toBe(MIN_SEGMENT));
  });

  it("collapses to MIN_SEGMENT when max is negative (defensive)", () => {
    funnelWidths([0, 0, 0], -10).forEach((w) => expect(w).toBe(MIN_SEGMENT));
  });

  it("gives the widest stage (count === max) a full-track width of ~1.0", () => {
    const widths = funnelWidths([5000, 1200, 200], 5000);
    expect(widths[0]).toBeCloseTo(1);
  });

  it("keeps every width within [MIN_SEGMENT, 1]", () => {
    const widths = funnelWidths([5000, 1200, 800, 400, 100, 20, 60, 250, 2400], 5000);
    widths.forEach((w) => {
      expect(w).toBeGreaterThanOrEqual(MIN_SEGMENT);
      expect(w).toBeLessThanOrEqual(1);
    });
  });

  it("grows monotonically with customer_count (log scale)", () => {
    const widths = funnelWidths([100, 1000, 5000], 5000);
    const [small, mid, big] = widths;
    if (small === undefined || mid === undefined || big === undefined) {
      throw new Error("expected 3-element array");
    }
    expect(mid).toBeGreaterThan(small);
    expect(big).toBeGreaterThan(mid);
  });

  it("floors tiny stages at MIN_SEGMENT so they stay visible", () => {
    const widths = funnelWidths([10000, 1], 10000);
    expect(widths[1]).toBeGreaterThanOrEqual(MIN_SEGMENT);
    expect(widths[1]).toBeLessThan(0.2);
  });

  it("traces a diamond — Awareness widest, Advocacy apex narrower than both ends", () => {
    const counts = [5000, 3000, 1800, 1000, 500, 200, 600, 1200, 2500];
    const widths = funnelWidths(counts, 5000);
    const awareness = widths[0];
    const advocacy = widths[5];
    const inactive = widths[8];
    if (awareness === undefined || advocacy === undefined || inactive === undefined) {
      throw new Error("expected 9-element array");
    }
    expect(widths.indexOf(Math.max(...widths))).toBe(0); // Awareness widest
    expect(advocacy).toBeLessThan(awareness);
    expect(advocacy).toBeLessThan(inactive);
  });
});

describe("funnelRowHeights", () => {
  it("returns empty array for non-positive count", () => {
    expect(funnelRowHeights(0, null)).toEqual([]);
    expect(funnelRowHeights(-3, null)).toEqual([]);
  });

  it("returns a uniform 1/N split summing to 1 when nothing is selected", () => {
    const heights = funnelRowHeights(9, null);
    expect(heights).toHaveLength(9);
    heights.forEach((h) => expect(h).toBeCloseTo(1 / 9));
    expect(heights.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
  });

  it("grows the selected row by SELECTED_MULTIPLIER and keeps the sum at 1", () => {
    const heights = funnelRowHeights(9, 4);
    const selected = heights[4];
    const other = heights[0];
    if (selected === undefined || other === undefined) {
      throw new Error("expected 9-element array");
    }
    expect(selected / other).toBeCloseTo(SELECTED_MULTIPLIER);
    expect(heights.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
  });

  it("treats an out-of-range selectedIndex as no selection (uniform)", () => {
    const heights = funnelRowHeights(5, 99);
    heights.forEach((h) => expect(h).toBeCloseTo(1 / 5));
  });

  it("exports the expected constant values", () => {
    expect(MIN_SEGMENT).toBe(0.08);
    expect(SELECTED_MULTIPLIER).toBe(1.5);
  });
});

describe("bandEdges", () => {
  it("returns an empty array for empty input", () => {
    expect(bandEdges([])).toEqual([]);
  });

  it("uses the band's own width on both edges for a single band (no neighbours)", () => {
    expect(bandEdges([0.6])).toEqual([{ top: 0.6, bottom: 0.6 }]);
  });

  it("anchors the funnel ends at their own width (first top, last bottom)", () => {
    const edges = bandEdges([0.2, 0.8, 0.4]);
    expect(edges[0]?.top).toBe(0.2); // no neighbour above
    expect(edges[edges.length - 1]?.bottom).toBe(0.4); // no neighbour below
  });

  it("keeps bands contiguous — each band's bottom equals the next band's top", () => {
    const edges = bandEdges([0.2, 0.8, 0.4, 1]);
    for (let i = 0; i < edges.length - 1; i++) {
      expect(edges[i]?.bottom).toBeCloseTo(edges[i + 1]?.top ?? NaN);
    }
  });

  it("sets each interior edge to the midpoint of its neighbouring widths", () => {
    const edges = bandEdges([0.2, 0.8, 0.4]);
    expect(edges[1]?.top).toBeCloseTo((0.2 + 0.8) / 2);
    expect(edges[1]?.bottom).toBeCloseTo((0.8 + 0.4) / 2);
  });
});

describe("trapezoidPoints", () => {
  it("maps a full-width band to the whole 0..100 viewBox", () => {
    expect(trapezoidPoints({ top: 1, bottom: 1 })).toBe("0,0 100,0 100,100 0,100");
  });

  it("centers a half-width band horizontally", () => {
    expect(trapezoidPoints({ top: 0.5, bottom: 0.5 })).toBe("25,0 75,0 75,100 25,100");
  });

  it("tapers an asymmetric band while staying centered (wide top, narrow bottom)", () => {
    expect(trapezoidPoints({ top: 1, bottom: 0.5 })).toBe("0,0 100,0 75,100 25,100");
  });
});
