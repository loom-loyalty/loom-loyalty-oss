import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runWithSdkContext,
  sdkFetch,
  setApiBaseUrl,
  setTokenProvider,
  unwrapResponse,
} from "./sdk-client";

describe("unwrapResponse", () => {
  describe("wrapped responses", () => {
    it("should unwrap a successful response with data", () => {
      const wrapped = {
        success: true,
        data: { id: "123", name: "Test" },
        eventId: "evt-123",
        eventDateTime: "2025-01-15T00:00:00Z",
      };

      const result = unwrapResponse<{ id: string; name: string }>(wrapped);

      expect(result).toEqual({ id: "123", name: "Test" });
    });

    it("should unwrap a successful paginated response", () => {
      const wrapped = {
        success: true,
        data: {
          content: [{ id: "1" }, { id: "2" }],
          totalSize: 2,
          pageable: { page: 0, size: 10 },
        },
        eventId: "evt-123",
      };

      const result = unwrapResponse<{ content: Array<{ id: string }> }>(wrapped);

      expect(result).toEqual({
        content: [{ id: "1" }, { id: "2" }],
        totalSize: 2,
        pageable: { page: 0, size: 10 },
      });
    });

    it("should unwrap a response with null data", () => {
      const wrapped = {
        success: true,
        data: null,
        eventId: "evt-123",
      };

      const result = unwrapResponse<null>(wrapped);

      expect(result).toBeNull();
    });

    it("should unwrap a response with undefined data", () => {
      const wrapped = {
        success: true,
        data: undefined,
        eventId: "evt-123",
      };

      const result = unwrapResponse<undefined>(wrapped);

      expect(result).toBeUndefined();
    });

    it("should throw an error for unsuccessful responses with errors", () => {
      const wrapped = {
        success: false,
        data: null,
        errors: [{ code: "VALIDATION_ERROR", message: "Name is required" }],
      };

      expect(() => unwrapResponse(wrapped)).toThrow("Name is required");
    });

    it("should throw an error with code from first error", () => {
      const wrapped = {
        success: false,
        data: null,
        errors: [{ code: 400, message: "Bad Request" }],
      };

      try {
        unwrapResponse(wrapped);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as { code: string }).code).toBe("400");
        expect((error as { message: string }).message).toBe("Bad Request");
      }
    });

    it("should handle success: false with empty errors array gracefully", () => {
      const wrapped = {
        success: false,
        data: { id: "123" },
        errors: [],
      };

      // When success is false but no errors, still return the data
      const result = unwrapResponse<{ id: string }>(wrapped);
      expect(result).toEqual({ id: "123" });
    });
  });

  describe("non-wrapped responses", () => {
    it("should return primitives as-is", () => {
      expect(unwrapResponse<string>("hello")).toBe("hello");
      expect(unwrapResponse<number>(42)).toBe(42);
      expect(unwrapResponse<boolean>(true)).toBe(true);
    });

    it("should return null as-is", () => {
      expect(unwrapResponse<null>(null)).toBeNull();
    });

    it("should return arrays as-is", () => {
      const arr = [1, 2, 3];
      expect(unwrapResponse<number[]>(arr)).toEqual([1, 2, 3]);
    });

    it("should return objects without success field as-is", () => {
      const obj = { id: "123", name: "Test" };
      expect(unwrapResponse<{ id: string; name: string }>(obj)).toEqual(obj);
    });

    it("should return objects with success but no data field as-is", () => {
      const obj = { success: true, message: "OK" };
      expect(unwrapResponse<{ success: boolean; message: string }>(obj)).toEqual(obj);
    });
  });
});

// ────────────────────────────────────────────────────────────────
// runWithSdkContext — per-request isolation via AsyncLocalStorage
// ────────────────────────────────────────────────────────────────
// These tests cover the Phase 0 P0.3 spike from the AI+wizard parity plan:
// https://.../docs/designs/ai-wizard-parity.md
//
// The CRITICAL test is the concurrent-isolation case — without ALS scoping,
// two concurrent requests in a multi-tenant server (apps/ai-server) would
// race on setTokenProvider's module-level state and leak JWTs across users.
// That's a security bug of the worst kind.

describe("runWithSdkContext — per-request isolation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  // Build a minimal Response-like object that satisfies everything sdkFetch
  // reads: ok, status, statusText, headers.get(), json(), bodyUsed, body.
  function mockOk(jsonBody: unknown): Response {
    const serialized = JSON.stringify(jsonBody);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "content-type": "application/json",
        "content-length": String(serialized.length),
      }),
      json: async () => jsonBody,
      bodyUsed: false,
      body: null,
    } as unknown as Response;
  }

  function mock401(jsonBody: unknown): Response {
    const serialized = JSON.stringify(jsonBody);
    return {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({
        "content-type": "application/json",
        "content-length": String(serialized.length),
      }),
      json: async () => jsonBody,
      bodyUsed: false,
      body: null,
    } as unknown as Response;
  }

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    // Reset module-level state so leakage from earlier tests doesn't confuse
    // the assertions that rely on the module fallback being absent.
    setTokenProvider(null);
    setApiBaseUrl("https://default.example.com");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setTokenProvider(null);
  });

  it("runs fn inside an ALS scope so sdkFetch reads the scoped baseUrl + token", async () => {
    fetchMock.mockResolvedValue(mockOk({ success: true, data: { ok: true } }));

    await runWithSdkContext(
      { baseUrl: "https://scoped.example.com", tokenProvider: () => "scoped-token" },
      async () => {
        await sdkFetch<unknown>("/test");
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe("https://scoped.example.com/test");
    const headers = init?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer scoped-token");
  });

  it("sdkFetch outside runWithSdkContext falls back to module-level state", async () => {
    setApiBaseUrl("https://module.example.com");
    setTokenProvider(() => "module-token");

    fetchMock.mockResolvedValue(mockOk({ success: true, data: { ok: true } }));

    await sdkFetch<unknown>("/test");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe("https://module.example.com/test");
    expect((init?.headers as Headers).get("Authorization")).toBe("Bearer module-token");
  });

  it("concurrent runWithSdkContext calls do not cross-contaminate tokens or baseUrls", async () => {
    // This is the security-critical test. Without AsyncLocalStorage scoping,
    // two concurrent chat requests in apps/ai-server could see each other's
    // JWTs via the shared module-level tokenProvider. The whole point of the
    // SDK refactor is to prevent this.
    fetchMock.mockImplementation(async () => {
      // Small yield so the two concurrent calls genuinely interleave — we
      // don't want either to complete before the other starts its sdkFetch.
      await new Promise((r) => setTimeout(r, 5));
      return mockOk({ success: true, data: { ok: true } });
    });

    await Promise.all([
      runWithSdkContext(
        { baseUrl: "https://a.example.com", tokenProvider: () => "token-A" },
        async () => sdkFetch<unknown>("/test")
      ),
      runWithSdkContext(
        { baseUrl: "https://b.example.com", tokenProvider: () => "token-B" },
        async () => sdkFetch<unknown>("/test")
      ),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Extract { url, auth } for each call so we can assert both contexts
    // stayed isolated from each other.
    const callSummaries = fetchMock.mock.calls.map((c) => {
      const [url, init] = c as [string, RequestInit | undefined];
      return {
        url,
        auth: (init?.headers as Headers).get("Authorization") ?? "",
      };
    });

    // Each call carries its own distinct combination.
    const a = callSummaries.find((s) => s.auth === "Bearer token-A");
    const b = callSummaries.find((s) => s.auth === "Bearer token-B");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a?.url).toBe("https://a.example.com/test");
    expect(b?.url).toBe("https://b.example.com/test");
  });

  it("401 retry inside runWithSdkContext re-reads token from the scoped context, not module state", async () => {
    // Module-level has a "stale" token. If the 401 retry path accidentally
    // reads from module state (e.g., the refactor forgot to preserve the
    // scoped reference across the retry), this would become the retry's
    // Authorization header — and the assertion below would fail.
    setTokenProvider(() => "STALE-MODULE-TOKEN-SHOULD-NEVER-APPEAR");

    // The scoped tokenProvider returns a different value on each call:
    // call 0 (initial) → scoped-token-1
    // call 1 (retry after 401) → scoped-token-2
    // If the retry reads from module state instead of the scoped context,
    // we'd see STALE-MODULE-TOKEN-SHOULD-NEVER-APPEAR.
    let tokenCall = 0;
    const scopedTokens = ["scoped-token-1", "scoped-token-2"];

    fetchMock
      .mockImplementationOnce(async () =>
        mock401({ success: false, errors: [{ message: "expired" }] })
      )
      .mockImplementationOnce(async () => mockOk({ success: true, data: { ok: true } }));

    await runWithSdkContext(
      {
        baseUrl: "https://api.example.com",
        tokenProvider: () => scopedTokens[tokenCall++] ?? null,
      },
      async () => sdkFetch<unknown>("/test")
    );

    // The tokenProvider was called twice: once for the initial request,
    // once for the retry. Both reads hit the SCOPED provider, not module state.
    expect(tokenCall).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Inspect the retry's Authorization header — this is the test that would
    // fail if the retry path forgot to preserve the scoped context.
    const retryInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const retryAuth = (retryInit?.headers as Headers).get("Authorization") ?? "";
    expect(retryAuth).toBe("Bearer scoped-token-2");
    expect(retryAuth).not.toBe("Bearer STALE-MODULE-TOKEN-SHOULD-NEVER-APPEAR");
  });

  it("401 retry fires when the first call had no token (provider returned null then a JWT)", async () => {
    // Reproduces the Hub bootstrap race: WorkOS AuthKit hydrates `user`
    // before it has produced an access token, so a TanStack Query hook
    // gated on `isAuthenticated` fires while `getAccessToken()` is still
    // returning null. The first request goes out without an Authorization
    // header → 401. The retry must still run and replay with the now-
    // available token, or the page is permanently broken.
    let tokenCall = 0;
    const tokens: Array<string | null> = [null, "fresh-token"];

    // sdkFetch mutates the same Headers object across initial + retry, so
    // snapshot Authorization at call time rather than reading it post-hoc.
    const authPerCall: Array<string | null> = [];
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Headers).get("Authorization");
      authPerCall.push(auth);
      return authPerCall.length === 1
        ? mock401({ success: false, errors: [] })
        : mockOk({ success: true, data: { ok: true } });
    });

    setTokenProvider(() => tokens[tokenCall++] ?? null);

    await sdkFetch<unknown>("/test");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authPerCall).toEqual([null, "Bearer fresh-token"]);
  });

  it("does not retry when the provider keeps returning null", async () => {
    // Guard against infinite retry: if the provider is stuck at null,
    // the inner `freshToken && freshToken !== token` check must prevent
    // a second fetch.
    fetchMock.mockResolvedValue(mock401({ success: false, errors: [] }));
    setTokenProvider(() => null);

    // Assert the 401 surfaces as a thrown error — `rejects.toThrow()`
    // refuses to mask network/parse failures the way a silent catch would.
    await expect(sdkFetch<unknown>("/test")).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves context across await boundaries inside fn", async () => {
    fetchMock.mockResolvedValue(mockOk({ success: true, data: { ok: true } }));

    await runWithSdkContext(
      { baseUrl: "https://ctx.example.com", tokenProvider: () => "ctx-token" },
      async () => {
        await sdkFetch<unknown>("/first");
        // Introduce an await on a non-fetch async op. AsyncLocalStorage
        // propagates across these (timers, microtasks) in Node 20+.
        await new Promise((r) => setTimeout(r, 1));
        await sdkFetch<unknown>("/second");
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const auths = fetchMock.mock.calls.map((c) => {
      const [, init] = c as [string, RequestInit | undefined];
      return (init?.headers as Headers).get("Authorization");
    });
    expect(auths).toEqual(["Bearer ctx-token", "Bearer ctx-token"]);
  });
});

describe("sdkFetch — error extraction (non-OK responses)", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    setApiBaseUrl("https://api.example.com");
    setTokenProvider(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setApiBaseUrl("https://should-be-overridden.example.com");
    setTokenProvider(null);
  });

  // Lock in the M2b QA fix: when the platform returns a non-JSON content
  // type but the body IS the actionable error string, surface it as the
  // message instead of falling back to "Bad Request".
  it("reads raw text body when content-type is text/plain on a 4xx", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Tier name 'Silver' must be unique within program.", {
        status: 400,
        headers: { "content-type": "text/plain" },
      })
    );

    let thrown: { message?: string; status?: number } | null = null;
    try {
      await sdkFetch("/tiers/abc");
    } catch (err) {
      thrown = err as { message?: string; status?: number };
    }
    expect(thrown).toBeTruthy();
    expect(thrown!.status).toBe(400);
    expect(thrown!.message).toBe("Tier name 'Silver' must be unique within program.");
  });

  // Some platforms return JSON-shaped bodies with the wrong content-type.
  // The SDK should still parse and extract the structured error, not
  // surface the raw text.
  it("parses JSON body when content-type lies about being text/plain", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: "INVALID_REQUEST_BODY", message: "name is required" }],
        }),
        { status: 400, headers: { "content-type": "text/plain" } }
      )
    );

    let thrown: { message?: string; code?: string } | null = null;
    try {
      await sdkFetch("/tiers");
    } catch (err) {
      thrown = err as { message?: string; code?: string };
    }
    expect(thrown).toBeTruthy();
    expect(thrown!.message).toBe("name is required");
    expect(thrown!.code).toBe("INVALID_REQUEST_BODY");
  });

  // Lock in the bug fix where a non-string `message` field would
  // produce "[object Object]" in the thrown error. The SDK must JSON-
  // stringify any non-string message so the actionable detail survives.
  it("coerces non-string platform message to JSON instead of '[object Object]'", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: { field: "name", reason: "duplicate" },
        }),
        { status: 422, headers: { "content-type": "application/json" } }
      )
    );

    let thrown: { message?: string } | null = null;
    try {
      await sdkFetch("/tiers");
    } catch (err) {
      thrown = err as { message?: string };
    }
    expect(thrown).toBeTruthy();
    expect(thrown!.message).toBe('{"field":"name","reason":"duplicate"}');
    // Critical: the regression we're guarding against is the literal
    // string "[object Object]" — surface it in the assertion so a
    // future regression names itself loudly.
    expect(thrown!.message).not.toBe("[object Object]");
  });

  // The platform sometimes returns a 400 with no body and no content-type
  // header at all (the URL bug we found). The SDK must fall back to
  // statusText so callers still get something better than empty string.
  it("falls back to statusText when body is empty and content-type is missing", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 400, statusText: "Bad Request" }));

    let thrown: { message?: string; status?: number } | null = null;
    try {
      await sdkFetch("/tiers/abc");
    } catch (err) {
      thrown = err as { message?: string; status?: number };
    }
    expect(thrown).toBeTruthy();
    expect(thrown!.status).toBe(400);
    expect(thrown!.message).toBe("Bad Request");
  });
  // A package install's 409 carries the plan of every conflicting record in `data`; the
  // dashboard lists them all, so the thrown error must keep it.
  it("keeps the error envelope's data on the thrown error", async () => {
    const plan = { conflicted: true, packages: [{ packageCode: "retail", records: [] }] };
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          data: plan,
          errors: [{ code: 4090, message: "METADATA LOCATION/STORE conflicts with the package" }],
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      )
    );

    let thrown: { status?: number; message?: string; data?: unknown } | null = null;
    try {
      await sdkFetch("/package-installations");
    } catch (err) {
      thrown = err as { status?: number; message?: string; data?: unknown };
    }
    expect(thrown!.status).toBe(409);
    expect(thrown!.message).toBe("METADATA LOCATION/STORE conflicts with the package");
    expect(thrown!.data).toEqual(plan);
  });
});

describe("sdkFetch — request Content-Type", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    setApiBaseUrl("https://api.example.com");
    setTokenProvider(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setApiBaseUrl("https://should-be-overridden.example.com");
  });

  const sentHeaders = () => (fetchMock.mock.calls[0]![1] as RequestInit).headers as Headers;

  it("defaults a JSON body to application/json", async () => {
    await sdkFetch("/things", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(sentHeaders().get("Content-Type")).toBe("application/json");
  });

  it("leaves a multipart body's Content-Type to fetch, so the boundary is set", async () => {
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "image/png" }), "logo.png");
    await sdkFetch("/organizations/o/images", { method: "POST", body: form });
    expect(sentHeaders().has("Content-Type")).toBe(false);
  });
});
