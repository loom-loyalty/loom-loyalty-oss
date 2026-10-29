import { afterEach, describe, expect, it } from "vitest";
import { authenticateViaBrowser } from "../../src/auth/browser-auth.js";

describe("authenticateViaBrowser", () => {
  const originalCi = process.env.CI;

  afterEach(() => {
    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }
  });

  it("rejects immediately in CI instead of opening a browser and waiting on the 5-minute timeout", async () => {
    process.env.CI = "true";

    const start = Date.now();
    await expect(authenticateViaBrowser()).rejects.toThrow(/unavailable in CI.*--token/s);
    // A generous upper bound that would still fail long before the real 5-minute
    // timeout if the CI guard regressed and fell through to the browser flow.
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
