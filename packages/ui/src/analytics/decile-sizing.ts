/**
 * Color ramp for the DecileDistribution bars.
 *
 * Sequential teal → green → gold ramp keyed to decile rank: the top decile (10,
 * most value) glows gold, the bottom (1) is deep teal. Interpolated in HSL so the
 * mid-range stays vivid green rather than the muddy olive a straight RGB lerp
 * would produce. A sequential ramp (not the funnel's categorical rainbow) because
 * deciles are *ordered* — color encodes value concentration.
 */

export interface DecileGradient {
  /** Lighter top stop of the bar's vertical gradient. */
  from: string;
  /** Deeper bottom stop. */
  to: string;
}

/**
 * Gradient stops for a decile rank. `decile` is clamped to 1..10, so a malformed
 * value can't produce an off-spectrum hue. Returns the lighter top stop and the
 * deeper bottom stop for a subtle glossy gradient.
 */
export function decileFill(decile: number): DecileGradient {
  const t = Math.min(1, Math.max(0, (decile - 1) / 9));
  const h = 193 - t * 153; // teal 193° → gold 40°
  // Yellow (~65°) reads neon at the lightness the teal and gold ends want. Darken
  // and desaturate ONLY as the hue crosses the yellow band so it deepens to a
  // honey/bronze, while teal, green and gold stay bright and saturated.
  const yellowness = Math.max(0, 1 - Math.abs(h - 65) / 35);
  const s = 82 - yellowness * 12;
  const l = 46 - yellowness * 12;
  return {
    from: `hsl(${h.toFixed(0)} ${(s + 4).toFixed(0)}% ${(l + 9).toFixed(0)}%)`,
    to: `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`,
  };
}
