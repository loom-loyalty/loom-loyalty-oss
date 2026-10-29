import type { AnalyticsTokenResponse } from "./types";

/**
 * Minimal shape /analytics requires from an SDK fetcher: a typed POST that
 * unwraps to the BFF's `{ data: T }` envelope. Both apps pass `sdkFetch`
 * from `@loom-loyalty/sdk`; declared here so the analytics package stays
 * free of an SDK dependency.
 */
export type AnalyticsSdkFetcher = <T>(path: string, init?: { method?: string }) => Promise<T>;

/**
 * Build a `fetchToken` callback for TinybirdProvider. The returned function
 * is referentially stable so the provider doesn't refetch the token on every
 * parent render.
 */
export function createAnalyticsTokenFetcher(
  sdkFetch: AnalyticsSdkFetcher
): () => Promise<AnalyticsTokenResponse> {
  return async () => {
    const result = await sdkFetch<{ data: AnalyticsTokenResponse }>("/analytics/token", {
      method: "POST",
    });
    return result.data;
  };
}
