import { describe, expect, it } from "vitest";
import { ALL_PIPES, PIPES, PREMIUM_PIPES, STANDARD_PIPES } from "../pipes";

describe("Pipe Registry", () => {
  it("has 22 total pipes", () => {
    expect(ALL_PIPES).toHaveLength(22);
  });

  it("has 9 standard pipes", () => {
    expect(STANDARD_PIPES).toHaveLength(9);
  });

  it("has 13 premium pipes", () => {
    expect(PREMIUM_PIPES).toHaveLength(13);
  });

  it("has no overlap between standard and premium", () => {
    const overlap = STANDARD_PIPES.filter((p) => PREMIUM_PIPES.includes(p));
    expect(overlap).toHaveLength(0);
  });

  it("all PIPES values are in ALL_PIPES", () => {
    for (const pipe of Object.values(PIPES)) {
      expect(ALL_PIPES).toContain(pipe);
    }
  });

  it("ALL_PIPES equals STANDARD + PREMIUM", () => {
    expect(ALL_PIPES).toEqual([...STANDARD_PIPES, ...PREMIUM_PIPES]);
  });
});
