/**
 * Sizing math for the centered LifecycleFunnel.
 *
 * Two independent axes:
 *
 * 1. WIDTH (`funnelWidths`) encodes `customer_count` — each stage's band is a
 *    fraction of the widest stage, on a log scale with an 8% floor so tiny
 *    stages stay visible. Centered, these widths trace the diamond/double-funnel
 *    silhouette (wide Awareness → narrow Advocacy apex → widening dormancy tail).
 *
 * 2. HEIGHT (`funnelRowHeights`) is uniform — every stage gets an equal vertical
 *    slice so its label is equally legible — except the selected stage, which
 *    grows by SELECTED_MULTIPLIER (CSS flex-basis transition; reduced-motion
 *    collapses the duration). Height does NOT encode count: the silhouette comes
 *    from width alone, which keeps the funnel readable instead of double-encoding.
 */
export const MIN_SEGMENT = 0.08;
export const SELECTED_MULTIPLIER = 1.5;

/**
 * Centered band widths as a fraction of the widest stage (each in
 * `[MIN_SEGMENT, 1]`). NOT normalized — the largest stage returns ~1.0 so it
 * spans the full track, and the others taper relative to it.
 *
 * `max` is the largest count across all stages (precomputed by the caller). When
 * `max <= 0` (fresh tenant, every count 0) all stages collapse to MIN_SEGMENT —
 * a thin uniform stub stack that reads as "no data yet."
 */
export function funnelWidths(counts: number[], max: number): number[] {
  if (counts.length === 0) return [];
  if (max <= 0) return counts.map(() => MIN_SEGMENT);

  const denom = Math.log10(1 + max);
  return counts.map((count) => {
    const ratio = Math.log10(1 + Math.max(0, count)) / denom;
    return MIN_SEGMENT + ratio * (1 - MIN_SEGMENT);
  });
}

/**
 * Per-row flex-basis fractions (sum 1.0). Every row gets an equal slice; the
 * selected row (if any) grows by SELECTED_MULTIPLIER and the rest re-balance so
 * the total still sums to 1.0. `selectedIndex` of `null`/out-of-range → uniform.
 */
export function funnelRowHeights(count: number, selectedIndex: number | null): number[] {
  if (count <= 0) return [];

  const raw = Array.from({ length: count }, (_, i) =>
    i === selectedIndex ? SELECTED_MULTIPLIER : 1
  );
  const total = raw.reduce((sum, v) => sum + v, 0);
  return raw.map((v) => v / total);
}

export interface BandEdge {
  /** Width fraction (0..1) of the band's top edge. */
  top: number;
  /** Width fraction (0..1) of the band's bottom edge. */
  bottom: number;
}

/**
 * Each band's top/bottom edge width is the midpoint between its own width and its
 * neighbour's — so band i's bottom edge equals band i+1's top edge and the
 * centered trapezoids trace one continuous diamond silhouette. The first band
 * starts at its own width (no neighbour above); the last ends at its own.
 */
export function bandEdges(widths: number[]): BandEdge[] {
  const n = widths.length;
  return widths.map((w, i) => {
    const prev = widths[i - 1];
    const next = widths[i + 1];
    return {
      top: i === 0 || prev === undefined ? w : (prev + w) / 2,
      bottom: i === n - 1 || next === undefined ? w : (w + next) / 2,
    };
  });
}

/** Centered trapezoid points for a 0..100 viewBox from top/bottom width fractions. */
export function trapezoidPoints({ top, bottom }: BandEdge): string {
  const t = top * 100;
  const b = bottom * 100;
  return `${(100 - t) / 2},0 ${(100 + t) / 2},0 ${(100 + b) / 2},100 ${(100 - b) / 2},100`;
}
