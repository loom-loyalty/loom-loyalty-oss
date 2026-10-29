import { describe, expect, it } from "vitest";

import { decileFill } from "./decile-sizing";

function parseHsl(value: string): { h: number; s: number; l: number } {
  const m = value.match(/hsl\((\d+) (\d+)% (\d+)%\)/);
  if (!m) throw new Error(`unparseable hsl: ${value}`);
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

describe("decileFill", () => {
  it("anchors decile 1 at deep teal (hue 193) and decile 10 at gold (hue 40)", () => {
    expect(parseHsl(decileFill(1).to).h).toBe(193);
    expect(parseHsl(decileFill(10).to).h).toBe(40);
  });

  it("clamps out-of-range deciles so a malformed value stays on-spectrum", () => {
    expect(decileFill(0)).toEqual(decileFill(1));
    expect(decileFill(-5)).toEqual(decileFill(1));
    expect(decileFill(99)).toEqual(decileFill(10));
  });

  it("keeps the top stop lighter than the bottom stop (glossy gradient) for every decile", () => {
    for (let d = 1; d <= 10; d++) {
      const { from, to } = decileFill(d);
      expect(parseHsl(from).l).toBeGreaterThan(parseHsl(to).l);
    }
  });

  it("deepens the yellow band to honey — lower saturation and lightness than the teal end", () => {
    const teal = parseHsl(decileFill(1).to); // hue 193, no yellow penalty
    const yellowBand = parseHsl(decileFill(8).to); // hue ~74, inside the yellow penalty band
    expect(yellowBand.s).toBeLessThan(teal.s);
    expect(yellowBand.l).toBeLessThan(teal.l);
  });
});
