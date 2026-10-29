import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveEnvironmentUrls } from "./index";

describe("resolveEnvironmentUrls", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // @loom-loyalty/core is a published open-source package and must never ship real
  // stage/prod hostnames as literal defaults (packages/core/AGENTS.md) -- so, unlike
  // `local`, stage/prod have no fallback at all: every field requires its env var.
  describe("stage", () => {
    it("throws a clear, actionable error for each required var when unset, rather than silently falling back to a literal hostname", () => {
      expect(() => resolveEnvironmentUrls("stage")).toThrow(/STAGE_API_URL is not set/);

      vi.stubEnv("STAGE_API_URL", "https://stage-api.example.com");
      expect(() => resolveEnvironmentUrls("stage")).toThrow(/STAGE_CHAT_URL is not set/);

      vi.stubEnv("STAGE_CHAT_URL", "https://stage-chat.example.com");
      expect(() => resolveEnvironmentUrls("stage")).toThrow(/STAGE_DASHBOARD_URL is not set/);

      vi.stubEnv("STAGE_DASHBOARD_URL", "https://stage-dashboard.example.com");
      expect(() => resolveEnvironmentUrls("stage")).toThrow(/STAGE_HUB_URL is not set/);
    });

    it("resolves every field from its env var once all four are set", () => {
      vi.stubEnv("STAGE_API_URL", "https://stage-api-override.example.com");
      vi.stubEnv("STAGE_CHAT_URL", "https://stage-chat-override.example.com");
      vi.stubEnv("STAGE_DASHBOARD_URL", "https://stage-dashboard-override.example.com");
      vi.stubEnv("STAGE_HUB_URL", "https://stage-hub-override.example.com");

      const urls = resolveEnvironmentUrls("stage");
      expect(urls).toEqual({
        platformApi: "https://stage-api-override.example.com",
        chat: "https://stage-chat-override.example.com",
        dashboard: "https://stage-dashboard-override.example.com",
        hub: "https://stage-hub-override.example.com",
      });
    });
  });

  describe("prod", () => {
    it("throws a clear, actionable error for each required var when unset, rather than silently falling back to a literal hostname", () => {
      expect(() => resolveEnvironmentUrls("prod")).toThrow(/PROD_API_URL is not set/);

      vi.stubEnv("PROD_API_URL", "https://prod-api.example.com");
      expect(() => resolveEnvironmentUrls("prod")).toThrow(/PROD_CHAT_URL is not set/);

      vi.stubEnv("PROD_CHAT_URL", "https://prod-chat.example.com");
      expect(() => resolveEnvironmentUrls("prod")).toThrow(/PROD_DASHBOARD_URL is not set/);

      vi.stubEnv("PROD_DASHBOARD_URL", "https://prod-dashboard.example.com");
      expect(() => resolveEnvironmentUrls("prod")).toThrow(/PROD_HUB_URL is not set/);
    });

    it("resolves every field from its env var once all four are set", () => {
      vi.stubEnv("PROD_API_URL", "https://prod-api-override.example.com");
      vi.stubEnv("PROD_CHAT_URL", "https://prod-chat-override.example.com");
      vi.stubEnv("PROD_DASHBOARD_URL", "https://prod-dashboard-override.example.com");
      vi.stubEnv("PROD_HUB_URL", "https://prod-hub-override.example.com");

      const urls = resolveEnvironmentUrls("prod");
      expect(urls).toEqual({
        platformApi: "https://prod-api-override.example.com",
        chat: "https://prod-chat-override.example.com",
        dashboard: "https://prod-dashboard-override.example.com",
        hub: "https://prod-hub-override.example.com",
      });
    });
  });

  // local's literal localhost defaults are generic dev-machine values, not sensitive
  // platform internals -- unlike stage/prod, they stay as fallbacks.
  describe("local", () => {
    it("resolves the expected localhost URLs for all four target types", () => {
      const urls = resolveEnvironmentUrls("local");
      expect(urls).toEqual({
        platformApi: "http://localhost:8080",
        chat: "http://localhost:8787",
        dashboard: "http://localhost:3000",
        hub: "http://localhost:3001",
      });
    });

    it("honors a non-default LOOM_API_URL for the platform API entry instead of localhost:8080", () => {
      vi.stubEnv("LOOM_API_URL", "http://localhost:18080");
      expect(resolveEnvironmentUrls("local").platformApi).toBe("http://localhost:18080");
    });

    it("re-reads LOOM_API_URL on every call rather than caching the first-seen value", () => {
      expect(resolveEnvironmentUrls("local").platformApi).toBe("http://localhost:8080");

      vi.stubEnv("LOOM_API_URL", "http://localhost:28080");
      expect(resolveEnvironmentUrls("local").platformApi).toBe("http://localhost:28080");
    });

    it("never touches stage/prod's required env vars -- resolving local must not throw even when none of them are set", () => {
      expect(() => resolveEnvironmentUrls("local")).not.toThrow();
    });
  });
});
