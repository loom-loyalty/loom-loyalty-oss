import { useCallback, useEffect, useRef, useState } from "react";

import { SESSIONSTORE_TOKEN_KEY, TOKEN_REFRESH_BUFFER_MS } from "../constants";
import { PREMIUM_PIPES } from "../pipes";
import type {
  AnalyticsTokenResponse,
  TinybirdTokenData,
  TinybirdTokenError,
  TinybirdTokenState,
} from "../types";

interface CachedToken {
  token: string;
  expiresAt: string;
  baseUrl: string;
  pipes: string[];
  datasources?: AnalyticsTokenResponse["datasources"];
}

function getCachedToken(): CachedToken | null {
  try {
    const raw = sessionStorage.getItem(SESSIONSTORE_TOKEN_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedToken;
    const expiresAt = new Date(cached.expiresAt).getTime();
    if (Date.now() > expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      sessionStorage.removeItem(SESSIONSTORE_TOKEN_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setCachedToken(data: AnalyticsTokenResponse): void {
  try {
    sessionStorage.setItem(SESSIONSTORE_TOKEN_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Evict the cached analytics token. Call before any flow that changes the
 * scope of the next-issued token (env switch, org switch, sign-out) so the
 * fresh page mount fetches a new token instead of hydrating the stale one.
 */
export function clearAnalyticsToken(): void {
  try {
    sessionStorage.removeItem(SESSIONSTORE_TOKEN_KEY);
  } catch {
    // sessionStorage may be unavailable
  }
}

function computeHasPremium(pipes: string[]): boolean {
  return PREMIUM_PIPES.some((p) => pipes.includes(p));
}

const RETRY_DELAY_MS = 30_000;
const MIN_REFRESH_MS = 5_000;
// setTimeout takes a 32-bit signed int; delays beyond this are spec'd to run
// as if the delay were 1ms instead of throwing, so an expiresAt more than
// ~24.8 days out would otherwise reschedule doFetch almost immediately,
// looping forever. Clamp so a long-lived token just refreshes less eagerly.
const MAX_REFRESH_MS = 2_147_483_647;
const RETRYABLE_ERRORS = new Set<TinybirdTokenError["type"]>([
  "SERVICE_UNAVAILABLE",
  "NETWORK_ERROR",
]);

/** The catalog code a current release answers a free-plan organization with. */
const PLAN_REQUIRED_CODE = "ANALYTICS_PLAN_REQUIRED";

/**
 * True when a 403 means "this organization's plan has no analytics" rather than "this caller
 * lacks the scope". Newer releases answer a missing scope with a 403 `FORBIDDEN` where older
 * ones answered 401, and releases before `ANALYTICS_PLAN_REQUIRED` raise the plan refusal as a
 * generic `FORBIDDEN` too, so for that code only the message tells the two apart. A 403 with no
 * code at all predates both and is the plan refusal.
 */
function isPlanRequired(error: { code?: unknown; message?: unknown }): boolean {
  const code = typeof error.code === "string" ? error.code : undefined;
  if (code === PLAN_REQUIRED_CODE) return true;
  if (code === "FORBIDDEN") {
    return typeof error.message === "string" && /paid plan/i.test(error.message);
  }
  return code === undefined || code === "403";
}

function clampRefreshDelay(expiresIn: number): number {
  return Math.min(Math.max(expiresIn - TOKEN_REFRESH_BUFFER_MS, MIN_REFRESH_MS), MAX_REFRESH_MS);
}

/** A caller the app has told can't mint a token: never fetched, and handled like the missing-scope refusal. */
const DISABLED_STATE: TinybirdTokenData = {
  token: null,
  expiresAt: null,
  baseUrl: null,
  pipes: [],
  hasPremium: false,
  datasources: [],
  sqlEnabled: false,
  isLoading: false,
  error: { type: "AUTH_ERROR", message: "Your account doesn't have access to analytics" },
};

export interface UseTinybirdTokenOptions {
  /**
   * False when the caller can't mint a token (the app checks its scopes), so the token endpoint is never called and
   * no access is reported. Defaults to true. Turning it on later fetches without a remount.
   */
  enabled?: boolean;
}

async function noRetry(): Promise<void> {}

/** Whether a token expiring at this time is still outside the refresh buffer, so no refresh is due yet. */
function isUsable(expiresAt: Date | null): boolean {
  return (expiresAt?.getTime() ?? 0) - Date.now() > TOKEN_REFRESH_BUFFER_MS;
}

export function useTinybirdToken(
  fetchToken: () => Promise<AnalyticsTokenResponse>,
  { enabled = true }: UseTinybirdTokenOptions = {}
): TinybirdTokenState {
  const [state, setState] = useState<TinybirdTokenData>(() => {
    // A disabled caller sees DISABLED_STATE (below) and never this; it starts loading for when it's enabled.
    const cached = enabled ? getCachedToken() : null;
    if (cached) {
      const ds = cached.datasources ?? [];
      return {
        token: cached.token,
        expiresAt: new Date(cached.expiresAt),
        baseUrl: cached.baseUrl,
        pipes: cached.pipes,
        hasPremium: computeHasPremium(cached.pipes),
        datasources: ds,
        sqlEnabled: ds.length > 0,
        isLoading: false,
        error: null,
      };
    }
    return {
      token: null,
      expiresAt: null,
      baseUrl: null,
      pipes: [],
      hasPremium: false,
      datasources: [],
      sqlEnabled: false,
      isLoading: true,
      error: null,
    };
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped whenever the effect below starts or stops, so a fetch begun under an earlier run (before an unmount, or
  // before the caller lost access) drops its result instead of storing a token and scheduling a refresh.
  const generationRef = useRef(0);
  const fetchTokenRef = useRef(fetchToken);
  fetchTokenRef.current = fetchToken;

  const doFetch = useCallback(async () => {
    const generation = generationRef.current;
    const stale = () => generation !== generationRef.current;
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const response = await fetchTokenRef.current();
      if (stale()) return;
      setCachedToken(response);

      const ds = response.datasources ?? [];
      setState({
        token: response.token,
        expiresAt: new Date(response.expiresAt),
        baseUrl: response.baseUrl,
        pipes: response.pipes,
        hasPremium: computeHasPremium(response.pipes),
        datasources: ds,
        sqlEnabled: ds.length > 0,
        isLoading: false,
        error: null,
      });

      const expiresIn = new Date(response.expiresAt).getTime() - Date.now();
      const refreshIn = clampRefreshDelay(expiresIn);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void doFetch();
      }, refreshIn);
    } catch (err: unknown) {
      if (stale()) return;
      const apiError = err as { status?: number; message?: string; code?: unknown };
      let tokenError: TinybirdTokenError;
      if (apiError.status === 403 && isPlanRequired(apiError)) {
        tokenError = {
          type: "PLAN_REQUIRED",
          message: "Analytics requires a paid plan",
          status: 403,
        };
      } else if (apiError.status === 403) {
        // A missing scope: handled like the 401 an older release answered it with.
        tokenError = {
          type: "AUTH_ERROR",
          message: "Your account doesn't have access to analytics",
          status: 403,
        };
      } else if (apiError.status === 401) {
        tokenError = {
          type: "AUTH_ERROR",
          message: "Authentication failed",
          status: 401,
        };
      } else if (apiError.status != null && apiError.status >= 500) {
        tokenError = {
          type: "SERVICE_UNAVAILABLE",
          message: apiError.message || "Analytics service temporarily unavailable",
          status: apiError.status,
        };
      } else {
        tokenError = {
          type: "NETWORK_ERROR",
          message: apiError.message || "Failed to fetch analytics token",
        };
      }
      setState((prev) => ({ ...prev, isLoading: false, error: tokenError }));

      // Schedule retry for transient errors
      if (RETRYABLE_ERRORS.has(tokenError.type)) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          void doFetch();
        }, RETRY_DELAY_MS);
      }
    }
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    const stop = () => {
      if (generationRef.current === generation) generationRef.current++;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
    if (!enabled) return stop;
    // A token retained while disabled may be due for refresh, or expired, by now: fetch a fresh one at once.
    if (!state.token || !isUsable(state.expiresAt)) {
      void doFetch();
    } else {
      const expiresIn = (state.expiresAt?.getTime() ?? 0) - Date.now();
      const refreshIn = clampRefreshDelay(expiresIn);
      refreshTimerRef.current = setTimeout(() => {
        void doFetch();
      }, refreshIn);
    }
    return stop;
    // state.token is read once per enable, not tracked: a refresh reschedules itself.
  }, [doFetch, enabled]);

  if (!enabled) return { ...DISABLED_STATE, retry: noRetry };
  if (state.token && (state.expiresAt?.getTime() ?? 0) <= Date.now()) {
    // Never hand out an expired token while the effect above fetches its replacement. A token merely inside the
    // refresh buffer stays in use, as during any scheduled refresh.
    return { ...state, token: null, isLoading: true, error: null, retry: doFetch };
  }
  return { ...state, retry: doFetch };
}
