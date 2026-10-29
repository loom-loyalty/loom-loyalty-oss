import { OFREPWebProvider } from "@openfeature/ofrep-web-provider";
import { type EvaluationContext, OpenFeature, OpenFeatureProvider } from "@openfeature/react-sdk";
import { useEffect, useRef } from "react";
import type { FeatureFlagProviderProps } from "./types";

export const DEFAULT_FEATURE_FLAG_DOMAIN = "loom";
const DEFAULT_POLL_INTERVAL_MS = 30_000;

/**
 * Evaluates feature flags over OFREP for everything below it.
 *
 * Hooks return their default value until the first evaluation resolves, and when
 * the server can't be reached, so nothing renders blocked on flags. Results are
 * not persisted to localStorage: behind a cookie-authenticated proxy the provider
 * has no credential to key a cache on, and one tenant's flags must never be served
 * to another.
 */
export function FeatureFlagProvider({
  baseUrl,
  tokenProvider,
  targetingKey,
  pollInterval = DEFAULT_POLL_INTERVAL_MS,
  domain = DEFAULT_FEATURE_FLAG_DOMAIN,
  children,
}: FeatureFlagProviderProps) {
  // Read through refs so a new token provider (often an inline arrow) is picked up
  // on the next fetch without rebuilding the provider or re-evaluating flags, and so
  // the setup effect registers with the current targeting key without depending on it.
  // Both are declared before the setup effect, so they are current when it runs.
  const tokenProviderRef = useRef(tokenProvider);
  useEffect(() => {
    tokenProviderRef.current = tokenProvider;
  }, [tokenProvider]);
  const targetingKeyRef = useRef(targetingKey);
  useEffect(() => {
    targetingKeyRef.current = targetingKey;
  }, [targetingKey]);

  // The targeting key the registered provider currently evaluates with.
  const appliedTargetingKey = useRef<string | undefined>(undefined);

  // A fresh provider per effect run: a closed OFREPWebProvider can't be reused, and
  // OpenFeature ignores setProvider with the instance it already holds, so reusing
  // one across StrictMode's mount, cleanup and re-mount would leave flags unloaded.
  useEffect(() => {
    const provider = new OFREPWebProvider({
      baseUrl: absoluteUrl(baseUrl),
      pollInterval,
      cacheMode: "disabled",
      headersFactory: async () => {
        const token = await tokenProviderRef.current?.();
        return token ? [["Authorization", `Bearer ${token}`]] : [];
      },
    });
    const key = targetingKeyRef.current;
    appliedTargetingKey.current = key;
    void OpenFeature.setProvider(domain, provider, contextFor(key));
    return () => {
      void provider.onClose?.();
    };
  }, [domain, baseUrl, pollInterval]);

  // A new targeting key (tenant or identity) re-evaluates every flag. The token is
  // not part of the context: the server derives the tenant from it, so callers
  // change the targeting key when the identity behind the token changes.
  useEffect(() => {
    if (appliedTargetingKey.current === targetingKey) return;
    appliedTargetingKey.current = targetingKey;
    void OpenFeature.setContext(domain, contextFor(targetingKey));
  }, [domain, targetingKey]);

  return <OpenFeatureProvider domain={domain}>{children}</OpenFeatureProvider>;
}

function contextFor(targetingKey: string | undefined): EvaluationContext {
  return targetingKey === undefined ? {} : { targetingKey };
}

// The OFREP client builds a Request from the URL, which can't parse a relative path
// outside a document, so resolve "/api/v1" against the page's origin.
function absoluteUrl(baseUrl: string): string {
  const resolved =
    typeof window === "undefined" ? baseUrl : new URL(baseUrl, window.location.href).href;
  return resolved.replace(/\/+$/, "");
}
