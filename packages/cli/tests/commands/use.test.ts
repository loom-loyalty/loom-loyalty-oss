import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeUse, organizationOfToken, parseUseArgs } from "../../src/commands/use.js";
import { clearRcCache, parseRc } from "../../src/utils/rc.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "treadle-use-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  clearRcCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearRcCache();
});

const jwt = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("treadle use", () => {
  it("saves the organization picked in the browser", async () => {
    const signIn = vi.fn(async () => ({ token: jwt({ org_id: "org_stage_dev" }) }));

    const code = await executeUse(
      {
        deployment: "staging",
        explicitDeployment: true,
        dashboardUrl: "https://dashboard.staging.example.com",
      },
      signIn,
      () => {}
    );

    expect(code).toBe(0);
    expect(signIn).toHaveBeenCalledWith("https://dashboard.staging.example.com");
    const path = join(dir, ".treadlerc");
    expect(parseRc(readFileSync(path, "utf-8"), path)).toEqual({
      deployment: "staging",
      staging: {
        dashboardUrl: "https://dashboard.staging.example.com",
        organization: "org_stage_dev",
      },
    });
  });

  it("saves --org without signing in", async () => {
    const signIn = vi.fn();

    expect(
      await executeUse({ deployment: "production", organization: "org_prod" }, signIn, () => {})
    ).toBe(0);

    expect(signIn).not.toHaveBeenCalled();
  });

  it("fails when the token names no organization", async () => {
    const code = await executeUse(
      { deployment: "staging", dashboardUrl: "https://dashboard.staging.example.com" },
      async () => ({ token: jwt({}) }),
      () => {}
    );

    expect(code).toBe(1);
  });

  it("reads org_id from a token, and nothing from a non-JWT", () => {
    expect(organizationOfToken(jwt({ org_id: "org_1" }))).toBe("org_1");
    expect(organizationOfToken("llk_abc")).toBeUndefined();
  });

  it("parses its options", () => {
    expect(parseUseArgs(["--deployment", "staging", "--org", "org_1"])).toEqual({
      deployment: "staging",
      explicitDeployment: true,
      organization: "org_1",
    });
    expect(parseUseArgs(["--deployment", "stage"])).toEqual({
      error: "--deployment must be one of production, staging, development",
    });
  });
});
