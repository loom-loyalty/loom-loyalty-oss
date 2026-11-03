import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultDeployment,
  getApiUrl,
  getDashboardUrl,
  resolveOrganization,
} from "../../src/utils/deployment.js";
import { clearRcCache, findRc, parseRc, saveRcSettings } from "../../src/utils/rc.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "treadlerc-"));
  clearRcCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearRcCache();
});

function inDir(path: string) {
  vi.spyOn(process, "cwd").mockReturnValue(path);
}

describe(".treadlerc", () => {
  it("is found in a parent directory", () => {
    writeFileSync(join(dir, ".treadlerc"), "deployment: staging\n");
    const nested = join(dir, "config", "onboarding-tenant");
    mkdirSync(nested, { recursive: true });

    expect(findRc(nested)).toBe(join(dir, ".treadlerc"));
  });

  it("sets the default deployment, its URLs and the organization to sign in to", () => {
    writeFileSync(
      join(dir, ".treadlerc"),
      [
        "deployment: staging",
        "staging:",
        "  apiUrl: https://api.staging.example.com",
        "  dashboardUrl: https://dashboard.staging.example.com",
        "  organization: org_stage_dev",
      ].join("\n")
    );
    inDir(dir);
    vi.stubEnv("LOOM_API_URL", "");
    vi.stubEnv("LOOM_DASHBOARD_URL", "");

    expect(defaultDeployment()).toBe("staging");
    expect(getApiUrl("staging")).toBe("https://api.staging.example.com");
    expect(getDashboardUrl("staging")).toBe("https://dashboard.staging.example.com");
    expect(resolveOrganization("staging")).toEqual({
      organization: "org_stage_dev",
      source: join(dir, ".treadlerc"),
    });
    expect(resolveOrganization("production")).toBeUndefined();
  });

  it("gives way to --org and to the URL environment variables", () => {
    writeFileSync(
      join(dir, ".treadlerc"),
      "staging:\n  apiUrl: https://api.staging.example.com\n  organization: org_stage_dev\n"
    );
    inDir(dir);
    vi.stubEnv("LOOM_API_URL", "http://localhost:8080");

    expect(getApiUrl("staging")).toBe("http://localhost:8080");
    expect(resolveOrganization("staging", "org_other")).toEqual({
      organization: "org_other",
      source: "--org",
    });
  });

  it("defaults to production without a file", () => {
    inDir(dir);

    expect(defaultDeployment()).toBe("production");
  });

  it("refuses a token or an llk_ key", () => {
    expect(() => parseRc("staging:\n  token: abc\n", ".treadlerc")).toThrow("holds a token or key");
    expect(() => parseRc("staging:\n  organization: llk_secret\n", ".treadlerc")).toThrow(
      "holds a token or key"
    );
  });

  it("refuses an unknown key or deployment", () => {
    expect(() => parseRc("staging:\n  org: x\n", ".treadlerc")).toThrow("staging");
    expect(() => parseRc("stage:\n  organization: x\n", ".treadlerc")).toThrow();
  });

  it("saves a deployment's settings and keeps the rest of the file", () => {
    writeFileSync(join(dir, ".treadlerc"), "# mine\ndeployment: staging\n");

    const path = saveRcSettings("staging", { organization: "org_stage_dev" }, dir);

    const text = readFileSync(path, "utf-8");
    expect(text).toContain("# mine");
    expect(parseRc(text, path)).toEqual({
      deployment: "staging",
      staging: { organization: "org_stage_dev" },
    });
  });
});
