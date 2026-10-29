import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/commands/generate.js";

describe("parseArgs", () => {
  it("parses --token and --dashboard-url", () => {
    const options = parseArgs([
      "--token",
      "llk_abc_secret",
      "--dashboard-url",
      "https://dashboard.example.com",
    ]);

    expect(options.token).toBe("llk_abc_secret");
    expect(options.dashboardUrl).toBe("https://dashboard.example.com");
  });

  it("ignores a leading bare -- end-of-options marker", () => {
    // pnpm (unlike npm) forwards this separator verbatim when a script is
    // invoked as `pnpm <script> -- <args>` — see e2e-scenarios.yml's
    // `pnpm generate:api -- --token ... --dashboard-url ...`.
    const options = parseArgs([
      "--",
      "--token",
      "llk_abc_secret",
      "--dashboard-url",
      "https://dashboard.example.com",
    ]);

    expect(options.token).toBe("llk_abc_secret");
    expect(options.dashboardUrl).toBe("https://dashboard.example.com");
  });

  it("parses --skip-generate and --cwd", () => {
    const options = parseArgs(["--skip-generate", "--cwd", "/some/path"]);

    expect(options.skipGenerate).toBe(true);
    expect(options.cwd).toBe("/some/path");
  });

  it("returns an empty options object for no args", () => {
    expect(parseArgs([])).toEqual({});
  });
});
