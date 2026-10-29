import { describe, expect, it } from "vitest";

import { setAtPath } from "./set-at-path.js";

describe("setAtPath", () => {
  it("sets a scalar at a top-level key", () => {
    const out = setAtPath({}, "name", "hi");
    expect(out).toEqual({ name: "hi" });
  });

  it("creates intermediate objects along a dotted path", () => {
    const out = setAtPath({}, "program.description", "A coffee shop loyalty.");
    expect(out).toEqual({ program: { description: "A coffee shop loyalty." } });
  });

  it("creates an array when the next segment is a numeric index", () => {
    const out = setAtPath({}, "tiers[0].name", "Bronze");
    expect(out).toEqual({ tiers: [{ name: "Bronze" }] });
  });

  it("preserves existing siblings when descending into an existing branch", () => {
    const target: Record<string, unknown> = { a: { b: 1 } };
    setAtPath(target, "a.c", 2);
    expect(target).toEqual({ a: { b: 1, c: 2 } });
  });

  it("overwrites an existing leaf value", () => {
    const target: Record<string, unknown> = { program: { description: "old" } };
    setAtPath(target, "program.description", "new");
    expect(target).toEqual({ program: { description: "new" } });
  });

  it("supports multi-index array paths", () => {
    const out = setAtPath({}, "rows[2][1]", "cell");
    const rows = (out as { rows: unknown[] }).rows;
    expect(rows).toHaveLength(3);
    // rows[0] and rows[1] are sparse (undefined); rows[2] is the nested array.
    const nested = rows[2] as unknown[];
    expect(nested).toHaveLength(2);
    expect(nested[1]).toBe("cell");
  });

  it("rejects prototype-polluting keys", () => {
    expect(() => setAtPath({}, "__proto__.polluted", true)).toThrow(/forbidden/);
    expect(() => setAtPath({}, "a.__proto__.b", true)).toThrow(/forbidden/);
    expect(() => setAtPath({}, "constructor.prototype.x", 1)).toThrow(/forbidden/);
  });

  it("rejects empty path", () => {
    expect(() => setAtPath({}, "", "x")).toThrow(/non-empty/);
  });

  it("throws when descending into a non-object scalar", () => {
    const target: Record<string, unknown> = { a: "string" };
    expect(() => setAtPath(target, "a.b", 1)).toThrow(/non-object/);
  });

  it("throws when writing a string key into an existing array", () => {
    const target: Record<string, unknown> = { tiers: [] };
    expect(() => setAtPath(target, "tiers.name", "x")).toThrow(/array/);
  });
});
