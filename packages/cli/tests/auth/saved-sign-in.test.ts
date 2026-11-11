import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { accountFor, forgetSignIn, signIn, type KeyStore } from "../../src/auth/saved-sign-in.js";

const DASHBOARD = "https://dashboard.staging.example.com";

function memoryStore(
  initial: Record<string, string> = {}
): KeyStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (account) => data.get(account) ?? null,
    set: (account, value) => void data.set(account, value),
    delete: (account) => data.delete(account),
  };
}

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const saved = (refreshToken: string, organizationId = "org_dev") =>
  JSON.stringify({ refreshToken, organizationId });

describe("saved sign-in", () => {
  it("refreshes the saved sign-in without a browser and keeps the rotated token", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_1") });
    const fetcher = vi.fn(async () =>
      answer(200, { accessToken: "access_2", refreshToken: "refresh_2", organizationId: "org_dev" })
    );
    const browser = vi.fn();

    const result = await signIn(DASHBOARD, "org_dev", { store, fetcher, browser });

    expect(result).toEqual({ token: "access_2", organizationId: "org_dev", via: "saved" });
    expect(browser).not.toHaveBeenCalled();
    const [url, init] = fetcher.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(url.toString()).toBe(`${DASHBOARD}/api/cli/access-tokens`);
    expect(JSON.parse(String(init.body))).toEqual({
      refreshToken: "refresh_1",
      organizationId: "org_dev",
    });
    expect(store.data.get(accountFor(DASHBOARD, "org_dev"))).toBe(saved("refresh_2"));
  });

  it("signs in through the browser with a PKCE challenge, trades the code, and saves the session", async () => {
    const store = memoryStore();
    let challenge = "";
    const browser = vi.fn(async (options: { codeChallenge?: string }) => {
      challenge = options.codeChallenge!;
      return { code: "c".repeat(43) };
    });
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      // The verifier the CLI sends is the one the challenge was made from.
      expect(createHash("sha256").update(body.codeVerifier).digest("base64url")).toBe(challenge);
      return answer(200, {
        accessToken: "access_1",
        refreshToken: "refresh_1",
        organizationId: "org_dev",
      });
    });

    const result = await signIn(DASHBOARD, "org_dev", {
      store,
      fetcher: fetcher as unknown as typeof fetch,
      browser: browser as never,
    });

    expect(result).toEqual({ token: "access_1", organizationId: "org_dev", via: "new" });
    expect(browser).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardUrl: DASHBOARD, organization: "org_dev" })
    );
    expect(String(fetcher.mock.calls[0]![0])).toBe(`${DASHBOARD}/api/cli/sessions`);
    expect(store.data.get(accountFor(DASHBOARD, "org_dev"))).toBe(saved("refresh_1"));
  });

  it("forgets a sign-in the dashboard says has ended, and signs in again", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_old") });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer(401, { details: { status: "signed_out" } }))
      .mockResolvedValueOnce(
        answer(200, {
          accessToken: "access_new",
          refreshToken: "refresh_new",
          organizationId: "org_dev",
        })
      );
    const log = vi.fn();

    const result = await signIn(DASHBOARD, "org_dev", {
      store,
      fetcher,
      browser: (async () => ({ code: "c".repeat(43) })) as never,
      log,
    });

    expect(result.via).toBe("new");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ended"));
    expect(store.data.get(accountFor(DASHBOARD, "org_dev"))).toBe(saved("refresh_new"));
  });

  it("stops on a dashboard outage instead of throwing the saved sign-in away", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_1") });

    await expect(
      signIn(DASHBOARD, "org_dev", {
        store,
        fetcher: async () => answer(503, {}),
        browser: vi.fn() as never,
      })
    ).rejects.toThrow(/HTTP 503/);
    expect(store.data.get(accountFor(DASHBOARD, "org_dev"))).toBe(saved("refresh_1"));
  });

  it("keeps the rotated refresh token a 503 hands back, for the retry", async () => {
    const account = accountFor(DASHBOARD, "org_dev");
    const store = memoryStore({ [account]: saved("refresh_1") });

    await expect(
      signIn(DASHBOARD, "org_dev", {
        store,
        fetcher: async () => answer(503, { refreshToken: "refresh_2", organizationId: "org_dev" }),
        browser: vi.fn() as never,
      })
    ).rejects.toThrow(/HTTP 503/);
    expect(store.data.get(account)).toBe(saved("refresh_2"));
  });

  it("uses an older dashboard's token once, saving nothing", async () => {
    const store = memoryStore();

    const result = await signIn(DASHBOARD, "org_dev", {
      store,
      fetcher: vi.fn(),
      browser: (async () => ({ token: "h.p.s" })) as never,
    });

    expect(result).toEqual({ token: "h.p.s", via: "browser" });
    expect(store.data.size).toBe(0);
  });

  it("keeps nothing and asks for the pick every time without an organization", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_1") });
    const browser = vi.fn(async () => ({ token: "h.p.s" }));

    const result = await signIn(DASHBOARD, undefined, {
      store,
      fetcher: vi.fn(),
      browser: browser as never,
    });

    expect(result).toEqual({ token: "h.p.s", via: "browser" });
    expect(browser).toHaveBeenCalledWith({ dashboardUrl: DASHBOARD, organization: undefined });
  });

  it("keeps the sign-in picked for treadle use under the organization picked", async () => {
    const store = memoryStore();

    const result = await signIn(DASHBOARD, undefined, {
      store,
      keepPicked: true,
      fetcher: async () =>
        answer(200, { accessToken: "a", refreshToken: "refresh_1", organizationId: "org_dev" }),
      browser: (async () => ({ code: "c".repeat(43) })) as never,
    });

    expect(result.organizationId).toBe("org_dev");
    expect(store.data.get(accountFor(DASHBOARD, "org_dev"))).toBe(saved("refresh_1"));
  });

  it("retries with the token another treadle rotated meanwhile instead of forgetting it", async () => {
    const account = accountFor(DASHBOARD, "org_dev");
    const store = memoryStore({ [account]: saved("refresh_1") });
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
      const { refreshToken } = JSON.parse(String(init.body));
      if (refreshToken === "refresh_1") {
        store.data.set(account, saved("refresh_2")); // the other process won the race
        return answer(401, {});
      }
      return answer(200, {
        accessToken: "a3",
        refreshToken: "refresh_3",
        organizationId: "org_dev",
      });
    });

    const result = await signIn(DASHBOARD, "org_dev", {
      store,
      fetcher: fetcher as unknown as typeof fetch,
      browser: vi.fn() as never,
    });

    expect(result).toEqual({ token: "a3", organizationId: "org_dev", via: "saved" });
    expect(store.data.get(account)).toBe(saved("refresh_3"));
  });

  it("still signs the command in when the keychain refuses the write", async () => {
    const store = memoryStore();
    store.set = () => {
      throw new Error("User canceled the operation");
    };
    const log = vi.fn();

    const result = await signIn(DASHBOARD, "org_dev", {
      store,
      log,
      fetcher: async () =>
        answer(200, { accessToken: "a", refreshToken: "r", organizationId: "org_dev" }),
      browser: (async () => ({ code: "c".repeat(43) })) as never,
    });

    expect(result.token).toBe("a");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Couldn't save"));
  });

  it("ends the saved sign-in's session on the dashboard, then forgets it", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_1") });
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    expect(await forgetSignIn(DASHBOARD, "org_dev", store, fetcher)).toEqual({
      saved: true,
      ended: true,
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe(`${DASHBOARD}/api/cli/sessions/current`);
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual({
      refreshToken: "refresh_1",
      organizationId: "org_dev",
    });
    expect(store.data.size).toBe(0);

    expect(await forgetSignIn(DASHBOARD, "org_dev", store, fetcher)).toEqual({ saved: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("counts a refused refresh token as an ended session", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_1") });
    const fetcher = vi.fn(async () => answer(401, { details: { status: "signed_out" } }));

    expect(await forgetSignIn(DASHBOARD, "org_dev", store, fetcher)).toEqual({
      saved: true,
      ended: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries with the token another treadle rotated meanwhile", async () => {
    const account = accountFor(DASHBOARD, "org_dev");
    const store = memoryStore({ [account]: saved("refresh_1") });
    const bodies: unknown[] = [];
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      if (bodies.length === 1) {
        store.data.set(account, saved("refresh_2")); // rotated by another treadle
        return answer(401, { details: { status: "signed_out" } });
      }
      return new Response(null, { status: 204 });
    });

    expect(
      await forgetSignIn(DASHBOARD, "org_dev", store, fetcher as unknown as typeof fetch)
    ).toEqual({ saved: true, ended: true });
    expect(bodies).toEqual([
      { refreshToken: "refresh_1", organizationId: "org_dev" },
      { refreshToken: "refresh_2", organizationId: "org_dev" },
    ]);
    expect(store.data.size).toBe(0);
  });

  it("still forgets the sign-in when the dashboard can't end its session", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_1") });
    const fetcher = vi.fn(async () => answer(503, {}));

    expect(await forgetSignIn(DASHBOARD, "org_dev", store, fetcher)).toEqual({
      saved: true,
      ended: "the dashboard answered HTTP 503",
    });
    expect(store.data.size).toBe(0);
  });

  it("still forgets the sign-in when the dashboard is unreachable", async () => {
    const store = memoryStore({ [accountFor(DASHBOARD, "org_dev")]: saved("refresh_1") });
    const fetcher = vi.fn(async () => {
      throw new Error("fetch failed");
    });

    expect(await forgetSignIn(DASHBOARD, "org_dev", store, fetcher)).toEqual({
      saved: true,
      ended: "fetch failed",
    });
    expect(store.data.size).toBe(0);
  });
});
