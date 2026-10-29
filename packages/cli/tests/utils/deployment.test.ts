import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiUrl, getDashboardUrl, resolveToken } from "../../src/utils/deployment.js";

describe("resolveToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("takes --token over LOOM_API_TOKEN", () => {
    vi.stubEnv("LOOM_API_TOKEN", "llk_env");

    expect(resolveToken(" llk_flag ")).toBe("llk_flag");
  });

  it("falls back to LOOM_API_TOKEN, trimmed", () => {
    vi.stubEnv("LOOM_API_TOKEN", " llk_env\n");

    expect(resolveToken()).toBe("llk_env");
    expect(resolveToken("  ")).toBe("llk_env");
  });

  it("is undefined when neither is set, so the browser login runs", () => {
    vi.stubEnv("LOOM_API_TOKEN", "   ");

    expect(resolveToken()).toBeUndefined();
    expect(resolveToken("")).toBeUndefined();
  });
});

describe("deployment URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("needs LOOM_API_URL and LOOM_DASHBOARD_URL for a non-production deployment", () => {
    vi.stubEnv("LOOM_API_URL", "");
    vi.stubEnv("LOOM_DASHBOARD_URL", "");

    expect(() => getApiUrl("staging")).toThrow("Set LOOM_API_URL");
    expect(() => getDashboardUrl("staging")).toThrow("Set LOOM_DASHBOARD_URL");
  });

  it("points production at the production API and dashboard", () => {
    vi.stubEnv("LOOM_API_URL", "");
    vi.stubEnv("LOOM_DASHBOARD_URL", "");

    expect(getApiUrl("production")).toBe("https://api.loomloyalty.com");
    expect(getDashboardUrl("production")).toBe("https://dashboard.loomloyalty.com");
  });

  it("lets LOOM_API_URL and LOOM_DASHBOARD_URL override both", () => {
    vi.stubEnv("LOOM_API_URL", "http://localhost:8080");
    vi.stubEnv("LOOM_DASHBOARD_URL", "http://localhost:3000");

    expect(getApiUrl("staging")).toBe("http://localhost:8080");
    expect(getDashboardUrl("staging")).toBe("http://localhost:3000");
  });
});
