import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getLoomLibrary", () => {
  it("builds the library on first use, not at import", async () => {
    // Cloudflare Workers forbid random values in global scope, and createLibrary()
    // generates a random library id, so importing this module during SSR must not build it.
    vi.resetModules();
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID");

    const { getLoomLibrary } = await import("../library");
    expect(randomUUID).not.toHaveBeenCalled();

    const library = getLoomLibrary();
    expect(library.root).toBe("Stack");
    expect(getLoomLibrary()).toBe(library);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  }, 30_000); // a cold import of every OpenUI component outlasts the 5s default
});
