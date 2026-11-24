/**
 * The token fetch is skipped for a caller whose role can't mint one (Hub brief: no access.denied from Customer Care).
 * The package stays scope-agnostic: the app decides `enabled`, this hook only honours it.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSIONSTORE_TOKEN_KEY, TOKEN_REFRESH_BUFFER_MS } from "../constants";
import { useTinybirdToken } from "../hooks/use-tinybird-token";
import type { AnalyticsTokenResponse } from "../types";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const response: AnalyticsTokenResponse = {
  token: "tok",
  expiresAt: "2099-01-01T00:00:00.000Z",
  baseUrl: "https://mock-tinybird.local",
  pipes: [],
  datasources: [],
};

describe("useTinybirdToken({ enabled })", () => {
  it("never calls the token endpoint when disabled, and reports no access", async () => {
    const fetchToken = vi.fn(async () => response);

    const { result } = renderHook(() => useTinybirdToken(fetchToken, { enabled: false }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchToken).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.error?.type).toBe("AUTH_ERROR");
  });

  it("doesn't hand a disabled caller a token cached by an earlier session", async () => {
    store.set(SESSIONSTORE_TOKEN_KEY, JSON.stringify(response));
    const fetchToken = vi.fn(async () => response);

    const { result } = renderHook(() => useTinybirdToken(fetchToken, { enabled: false }));

    expect(result.current.token).toBeNull();
    expect(fetchToken).not.toHaveBeenCalled();
  });

  it("fetches once the caller gains access, without a remount", async () => {
    const fetchToken = vi.fn(async () => response);

    const { result, rerender } = renderHook(
      ({ enabled }) => useTinybirdToken(fetchToken, { enabled }),
      { initialProps: { enabled: false } }
    );
    expect(fetchToken).not.toHaveBeenCalled();

    await act(async () => rerender({ enabled: true }));

    await waitFor(() => expect(result.current.token).toBe("tok"));
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("drops a token that arrives after the caller lost access, and schedules no refresh", async () => {
    let resolve!: (value: AnalyticsTokenResponse) => void;
    const fetchToken = vi.fn(() => new Promise<AnalyticsTokenResponse>((r) => (resolve = r)));

    const { result, rerender } = renderHook(
      ({ enabled }) => useTinybirdToken(fetchToken, { enabled }),
      { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(fetchToken).toHaveBeenCalledTimes(1));

    await act(async () => rerender({ enabled: false }));
    await act(async () =>
      resolve({ ...response, expiresAt: new Date(Date.now() + 1000).toISOString() })
    );
    await new Promise((r) => setTimeout(r, 6_000));

    expect(result.current.token).toBeNull();
    expect(result.current.error?.type).toBe("AUTH_ERROR");
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(store.has(SESSIONSTORE_TOKEN_KEY)).toBe(false);
  }, 10_000);

  it("reports loading, not 'no access', on the render that enables it", async () => {
    const fetchToken = vi.fn(() => new Promise<AnalyticsTokenResponse>(() => {}));
    const seen: { isLoading: boolean; error: string | undefined }[] = [];

    const { rerender } = renderHook(
      ({ enabled }) => {
        const state = useTinybirdToken(fetchToken, { enabled });
        if (enabled) seen.push({ isLoading: state.isLoading, error: state.error?.type });
        return state;
      },
      { initialProps: { enabled: false } }
    );
    await act(async () => rerender({ enabled: true }));

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s.isLoading && s.error === undefined)).toBe(true);
  });

  it("fetches a fresh token at once when re-enabled after the retained one expired", async () => {
    const soonExpiring = {
      ...response,
      token: "old",
      expiresAt: new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS + 300).toISOString(),
    };
    const fetchToken = vi
      .fn<() => Promise<AnalyticsTokenResponse>>()
      .mockResolvedValueOnce(soonExpiring)
      .mockResolvedValue({ ...response, token: "fresh" });

    const { result, rerender } = renderHook(
      ({ enabled }) => useTinybirdToken(fetchToken, { enabled }),
      { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(result.current.token).toBe("old"));

    await act(async () => rerender({ enabled: false }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await act(async () => rerender({ enabled: true }));

    await waitFor(() => expect(result.current.token).toBe("fresh"), { timeout: 1_000 });
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("hides a retained token that has actually expired while its replacement loads", async () => {
    let resolveFresh!: (value: AnalyticsTokenResponse) => void;
    const fetchToken = vi
      .fn<() => Promise<AnalyticsTokenResponse>>()
      .mockResolvedValueOnce({
        ...response,
        token: "old",
        expiresAt: new Date(Date.now() + 300).toISOString(),
      })
      .mockImplementation(() => new Promise((r) => (resolveFresh = r)));

    const { result, rerender } = renderHook(
      ({ enabled }) => useTinybirdToken(fetchToken, { enabled }),
      { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(result.current.token).toBe("old"));
    await act(async () => rerender({ enabled: false }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await act(async () => rerender({ enabled: true }));

    expect(result.current.token).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await act(async () => resolveFresh({ ...response, token: "fresh" }));
    await waitFor(() => expect(result.current.token).toBe("fresh"));
  });

  it("fetches as before when no option is passed", async () => {
    const fetchToken = vi.fn(async () => response);

    const { result } = renderHook(() => useTinybirdToken(fetchToken));

    await waitFor(() => expect(result.current.token).toBe("tok"));
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });
});
