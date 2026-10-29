import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkOSClient } from "./workos";

/**
 * Verifies the actual mechanism behind the fetchWithTimeout fix: a WorkOS
 * call whose underlying connection never responds must reject on its own
 * (via AbortController) rather than hang forever, since a hang here is what
 * previously left the onboarding flow's own "taking longer than expected"
 * fallback unreachable -- nothing ever threw to trigger it.
 */
describe("createWorkOSClient timeout behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubHangingFetchRespectingAbort() {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      })
    );
  }

  it("rejects instead of hanging forever when the connection never responds", async () => {
    stubHangingFetchRespectingAbort();
    const client = createWorkOSClient({
      apiKey: "sk_test_dummy",
      clientId: "client_dummy",
      redirectUri: "http://localhost/callback",
      baseUrl: "https://workos.example.test",
    });

    const resultPromise = client.authenticateWithRefreshToken("refresh-token-value");
    // Attach a rejection listener before advancing fake timers so Node
    // doesn't flag the eventual rejection as unhandled while we wait.
    const assertion = expect(resultPromise).rejects.toThrow(/aborted/i);

    // Advance past the 20s default timeout -- if fetchWithTimeout's
    // AbortController weren't wired up, this promise would never settle and
    // the test would time out instead of failing fast with a clear message.
    await vi.advanceTimersByTimeAsync(20_001);

    await assertion;
  });

  it("still resolves normally for a fast, well-behaved response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: "access-token-value",
              refresh_token: "new-refresh-token-value",
              user: {
                id: "user_1",
                email: "person@example.test",
                email_verified: true,
                first_name: null,
                last_name: null,
                profile_picture_url: null,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
                object: "user",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    const client = createWorkOSClient({
      apiKey: "sk_test_dummy",
      clientId: "client_dummy",
      redirectUri: "http://localhost/callback",
      baseUrl: "https://workos.example.test",
    });

    const result = await client.authenticateWithRefreshToken("refresh-token-value");
    expect(result.accessToken).toBe("access-token-value");
    expect(result.refreshToken).toBe("new-refresh-token-value");
  });
});
