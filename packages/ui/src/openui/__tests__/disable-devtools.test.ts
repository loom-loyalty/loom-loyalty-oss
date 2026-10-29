import { describe, expect, it } from "vitest";

describe("disable-devtools", () => {
  it("sets react-lang's devtools auto-mount flag so the widget never mounts", async () => {
    const flag = Symbol.for("openui.devtools.autoMount");
    delete (globalThis as Record<symbol, unknown>)[flag];
    await import("../disable-devtools");
    expect((globalThis as Record<symbol, unknown>)[flag]).toBe(true);
  });
});
