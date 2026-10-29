import { mkdir, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadOpenApiSpec } from "../../src/api/download-spec.js";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function createMockJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = "mock-signature";
  return `${headerB64}.${payloadB64}.${signature}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("downloadOpenApiSpec", () => {
  it("rejects a garbage token without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadOpenApiSpec({ token: "invalid", outputPath: "/tmp/openapi.yaml" })
    ).rejects.toThrow(/Invalid access token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an expired JWT without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const expiredJwt = createMockJwt({ exp: Math.floor(Date.now() / 1000) - 3600 });

    await expect(
      downloadOpenApiSpec({ token: expiredJwt, outputPath: "/tmp/openapi.yaml" })
    ).rejects.toThrow(/Access token has expired/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads and saves the spec for a valid unexpired JWT", async () => {
    const validJwt = createMockJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "openapi: 3.0.0",
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadOpenApiSpec({
      token: validJwt,
      dashboardUrl: "https://dashboard.example.com",
      outputPath: "/tmp/openapi.yaml",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashboard.example.com/api/openapi/spec",
      expect.objectContaining({
        headers: { Authorization: `Bearer ${validJwt}` },
      })
    );
    expect(mkdir).toHaveBeenCalledWith("/tmp", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith("/tmp/openapi.yaml", "openapi: 3.0.0", "utf-8");
  });

  it("downloads and saves the spec for an llk_ M2M API key", async () => {
    const m2mKey = "llk_109cae84148467a9_supersecretvalue";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "openapi: 3.0.0",
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadOpenApiSpec({ token: m2mKey, outputPath: "/tmp/openapi.yaml" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${m2mKey}` },
      })
    );
  });

  it("throws when the download response is not ok", async () => {
    const validJwt = createMockJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "insufficient scope",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadOpenApiSpec({ token: validJwt, outputPath: "/tmp/openapi.yaml" })
    ).rejects.toThrow(/Failed to download OpenAPI spec: 403 Forbidden/);
  });
});
