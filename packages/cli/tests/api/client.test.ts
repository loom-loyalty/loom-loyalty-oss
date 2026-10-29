import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, isTokenExpired } from "../../src/api/client.js";

describe("isTokenExpired", () => {
  it("should return true for invalid token format", () => {
    expect(isTokenExpired("invalid")).toBe(true);
    expect(isTokenExpired("")).toBe(true);
    expect(isTokenExpired("a.b")).toBe(true);
  });

  it("should return true for expired token", () => {
    // Create a token with an expiration in the past
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 }; // 1 hour ago
    const token = createMockJwt(payload);
    expect(isTokenExpired(token)).toBe(true);
  });

  it("should return false for valid token", () => {
    // Create a token with an expiration in the future
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 }; // 1 hour from now
    const token = createMockJwt(payload);
    expect(isTokenExpired(token)).toBe(false);
  });

  it("should return false for token without expiration", () => {
    // Create a token without an exp claim
    const payload = { sub: "user123" };
    const token = createMockJwt(payload);
    expect(isTokenExpired(token)).toBe(false);
  });

  it("should return false for an llk_ M2M API key", () => {
    expect(isTokenExpired("llk_key123_secretvalue")).toBe(false);
  });
});

describe("ApiClient", () => {
  it("should create client with valid options", () => {
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = createMockJwt(payload);

    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      token,
    });

    expect(client.isAuthenticated()).toBe(true);
  });

  it("should report not authenticated for expired token", () => {
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 };
    const token = createMockJwt(payload);

    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      token,
    });

    expect(client.isAuthenticated()).toBe(false);
  });

  it("should be authenticated with an llk_ M2M API key", () => {
    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      token: "llk_key123_secretvalue",
    });

    expect(client.isAuthenticated()).toBe(true);
  });

  it("should strip trailing slash from baseUrl", () => {
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = createMockJwt(payload);

    const client = new ApiClient({
      baseUrl: "https://api.example.com/",
      token,
    });

    expect(client.isAuthenticated()).toBe(true);
  });
});

describe("ApiError", () => {
  it("should create error with status and message", () => {
    const error = new ApiError("Not found", 404);
    expect(error.message).toBe("Not found");
    expect(error.status).toBe(404);
    expect(error.name).toBe("ApiError");
  });

  it("should include API errors if provided", () => {
    const errors = [{ code: 100, message: "Invalid request" }];
    const error = new ApiError("Bad request", 400, errors);
    expect(error.errors).toEqual(errors);
  });
});

// Helper to create a mock JWT token
function createMockJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = "mock-signature";
  return `${headerB64}.${payloadB64}.${signature}`;
}

describe("ApiClient tenant manifests", () => {
  const client = new ApiClient({ baseUrl: "https://api.example.com/", token: "llk_key_secret" });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(...bodies: unknown[]) {
    const fetchMock = vi.fn();
    for (const body of bodies) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    }
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("posts the manifest inline, with the target environment only when given", async () => {
    const fetchMock = stubFetch({ success: true, data: { packageCode: "warp-up" } });

    await client.installManifest({ code: "warp-up", manifest: { code: "warp-up" }, dryRun: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/package-installations");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      code: "warp-up",
      dryRun: true,
      manifest: { code: "warp-up" },
    });
  });

  it("sends targetEnvironmentCode for --env", async () => {
    const fetchMock = stubFetch({ success: true, data: {} });

    await client.installManifest({
      code: "warp-up",
      manifest: {},
      dryRun: false,
      targetEnvironmentCode: "prod",
    });

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
      dryRun: false,
      targetEnvironmentCode: "prod",
    });
  });

  it("exports a manifest, asking for each section and the program by query", async () => {
    const fetchMock = stubFetch({
      success: true,
      data: { manifest: { code: "warp-up" }, warnings: ["a draft"] },
    });

    const exported = await client.exportManifest({
      code: "warp-up",
      sections: ["tiers", "eventRules"],
      program: "rewards",
    });

    expect(exported).toEqual({ manifest: { code: "warp-up" }, warnings: ["a draft"] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://api.example.com/package-installations/manifest-export?code=warp-up&sections=tiers&sections=eventRules&program=rewards"
    );
    expect(init.method).toBe("GET");
  });

  it("finds an installation in a page by its exact code", async () => {
    stubFetch({
      success: true,
      data: { content: [{ packageInstallationId: "pi_1", packageCode: "warp-up" }], totalPages: 1 },
    });

    expect(await client.findInstallation("warp-up")).toMatchObject({
      packageInstallationId: "pi_1",
    });
  });

  it("reads workflow requests page by page", async () => {
    const fetchMock = stubFetch(
      { success: true, data: { content: [{ environmentWorkflowRequestId: "a" }], totalPages: 2 } },
      { success: true, data: { content: [{ environmentWorkflowRequestId: "b" }], totalPages: 2 } }
    );

    const requests = await client.listWorkflowRequests();

    expect(requests.map((request) => request.environmentWorkflowRequestId)).toEqual(["a", "b"]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.example.com/workflow-requests?page=0&size=100",
      "https://api.example.com/workflow-requests?page=1&size=100",
    ]);
  });

  it("describes a failure with the Platform's own messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: [{ code: 403, message: "Tenant config manifests not enabled" }],
          }),
          {
            status: 403,
            statusText: "Forbidden",
          }
        )
      )
    );

    const error = await client
      .installManifest({ code: "x", manifest: {}, dryRun: true })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).describe()).toBe("Tenant config manifests not enabled");
  });
});
