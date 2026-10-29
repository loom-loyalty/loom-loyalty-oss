import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTinybirdToken } from "../hooks/use-tinybird-token";
import type { AnalyticsTokenResponse } from "../types";

beforeEach(() => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function tokenResponse(expiresAt: string): AnalyticsTokenResponse {
  return {
    token: "tok",
    expiresAt,
    baseUrl: "https://mock-tinybird.local",
    pipes: [],
    datasources: [],
  };
}

describe("useTinybirdToken", () => {
  it("does not refetch in a tight loop when expiresAt is far in the future", async () => {
    // `setTimeout` takes a 32-bit signed int; a delay beyond ~24.8 days is
    // clamped by the runtime to fire as if it were 1ms. A token whose
    // expiresAt is months/years out (as real long-lived tokens — and this
    // test — use) must not feed that raw delay straight into setTimeout, or
    // the refresh reschedules itself almost immediately, forever.
    const farFuture = "2099-01-01T00:00:00.000Z";
    const fetchToken = vi.fn(async () => tokenResponse(farFuture));

    renderHook(() => useTinybirdToken(fetchToken));

    await waitFor(() => expect(fetchToken).toHaveBeenCalledTimes(1));

    // Give the hook real wall-clock time to loop the way it did in production —
    // a 1ms-clamped reschedule would rack up hundreds of calls in this window.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  describe("error classification", () => {
    async function errorFor(error: Record<string, unknown>) {
      const fetchToken = vi.fn(async (): Promise<AnalyticsTokenResponse> => {
        throw Object.assign(new Error(String(error.message ?? "failed")), error);
      });
      const { result } = renderHook(() => useTinybirdToken(fetchToken));
      await waitFor(() => expect(result.current.error).not.toBeNull());
      return result.current.error;
    }

    it.each([
      ["ANALYTICS_PLAN_REQUIRED", { status: 403, code: "ANALYTICS_PLAN_REQUIRED" }],
      [
        "a FORBIDDEN plan refusal from a release before ANALYTICS_PLAN_REQUIRED",
        { status: 403, code: "FORBIDDEN", message: "Analytics requires a paid plan" },
      ],
      ["a 403 without a catalog code", { status: 403, code: "403", message: "Forbidden" }],
    ])("reads %s as PLAN_REQUIRED", async (_label, error) => {
      expect(await errorFor(error)).toMatchObject({ type: "PLAN_REQUIRED", status: 403 });
    });

    it("reads a 403 FORBIDDEN for a missing scope like the 401 an older release sent", async () => {
      const forbidden = await errorFor({
        status: 403,
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
      const legacy = await errorFor({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Authentication is required to access this resource.",
      });

      expect(forbidden).toMatchObject({ type: "AUTH_ERROR", status: 403 });
      expect(legacy).toMatchObject({ type: "AUTH_ERROR", status: 401 });
    });

    it("never reads a 401 as PLAN_REQUIRED", async () => {
      expect(await errorFor({ status: 401, code: "401" })).toMatchObject({
        type: "AUTH_ERROR",
        status: 401,
      });
    });
  });
});
