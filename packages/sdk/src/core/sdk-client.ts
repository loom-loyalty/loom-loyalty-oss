/**
 * SDK Fetch Client for Orval
 *
 * This module provides a fetch implementation that integrates with
 * the Orval-generated API hooks. It handles authentication token injection,
 * response unwrapping, and provides a consistent interface for all API calls.
 *
 * Usage:
 * 1. Set the API base URL: setApiBaseUrl('https://api.example.com')
 * 2. Set the token provider: setTokenProvider(() => getAccessToken())
 * 3. Use the generated hooks normally - they'll use this client
 *
 * Multi-tenant server use:
 * For server-side code that handles concurrent requests from different users
 * (e.g. apps/ai-server), DO NOT use setTokenProvider + module-level state —
 * that races across requests and can cross-contaminate JWTs. Instead, wrap
 * each request's work in runWithSdkContext({ baseUrl, tokenProvider }, fn).
 * Inside fn, every sdkFetch call reads the scoped context via AsyncLocalStorage.
 *
 * Response Unwrapping:
 * The API returns wrapped responses: { success, data, eventId, eventDateTime, errors }
 * This client automatically unwraps and returns just the `data` field.
 */

import type { ApiError } from "./api-error";
import { apiErrorFromBody, isJsonContentType } from "./api-error";

/**
 * Type for wrapped API responses
 * The API returns all responses in this envelope format
 */
interface WrappedResponse<T = unknown> {
  success: boolean;
  data?: T;
  eventId?: string;
  eventDateTime?: string;
  errors?: Array<{ code?: string | number; message?: string }>;
}

/**
 * Per-request scoped SDK context. Populated by runWithSdkContext (Node only)
 * and read by sdkFetch via AsyncLocalStorage. Falls through to module-level
 * state when no scope is active (browser code, tests, or legacy server code
 * that uses setTokenProvider).
 */
interface ScopedSdkContext {
  baseUrl: string;
  tokenProvider: () => Promise<string | null> | string | null;
}

/**
 * Base URL for all API requests. Set via setApiBaseUrl().
 * @internal Module-scoped state for runtime configuration.
 */
let apiBaseUrl =
  typeof process !== "undefined" && process.env?.LOOM_API_URL
    ? process.env.LOOM_API_URL
    : "https://api.loomloyalty.com";

/**
 * Token provider function for authentication.
 * Can return a Promise or direct value. Set via setTokenProvider().
 * @internal Module-scoped state for runtime configuration.
 */
let tokenProvider: (() => Promise<string | null> | string | null) | null = null;

/* ────────────────────────────────────────────────────────────────
 * AsyncLocalStorage machinery for per-request isolation (Node only)
 * ──────────────────────────────────────────────────────────────── */

// Minimal structural type for the AsyncLocalStorage instance we need.
// We can't `import type` from `node:async_hooks` in a file that also needs
// to bundle for browsers — TypeScript's type import still requires the module
// to resolve, which fails in some browser bundler configurations.
interface AsyncLocalStorageLike<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
}

// Structural type for the constructor, so the dynamically-imported module
// can be cast without an `import()` type expression (forbidden by
// @typescript-eslint/consistent-type-imports) or a real `import type` (which
// would reintroduce the browser-bundler resolution problem noted above).
interface AsyncLocalStorageConstructorLike {
  new <T>(): AsyncLocalStorageLike<T>;
}

/**
 * Detect whether we are running in Node. Browser builds tree-shake the
 * `node:async_hooks` import and alsInstance stays null forever.
 */
function isNodeRuntime(): boolean {
  // `process.versions.node` is present in Node and absent in browsers.
  // typeof check first to avoid ReferenceError in strict browser globals.
  return typeof process !== "undefined" && !!process.versions?.node;
}

/**
 * Cached AsyncLocalStorage instance. Populated asynchronously on first
 * runWithSdkContext call (Node only). Stays null in browsers.
 */
let alsInstance: AsyncLocalStorageLike<ScopedSdkContext> | null = null;
let alsInitPromise: Promise<AsyncLocalStorageLike<ScopedSdkContext> | null> | null = null;

/**
 * Lazy-load the Node AsyncLocalStorage class. Returns null in browsers.
 * Idempotent — subsequent calls return the cached promise.
 */
function ensureAls(): Promise<AsyncLocalStorageLike<ScopedSdkContext> | null> {
  if (alsInitPromise) return alsInitPromise;
  if (!isNodeRuntime()) {
    alsInitPromise = Promise.resolve(null);
    return alsInitPromise;
  }
  // Dynamic import via a non-literal specifier so bundlers that statically
  // resolve `import()` string literals (e.g. esbuild in browser-platform
  // mode) can't inline it at build time — it's left as a runtime import(),
  // which this Node-only guard ensures is never actually invoked in browsers.
  const nodeAsyncHooksSpecifier: string = "node:async_hooks";
  alsInitPromise = import(nodeAsyncHooksSpecifier).then((mod) => {
    const { AsyncLocalStorage } = mod as { AsyncLocalStorage: AsyncLocalStorageConstructorLike };
    alsInstance = new AsyncLocalStorage<ScopedSdkContext>();
    return alsInstance;
  });
  return alsInitPromise;
}

/**
 * Synchronously read the currently-active scoped context, if any.
 *
 * Returns undefined when:
 * - We're in a browser (alsInstance is null)
 * - We're in Node but ALS hasn't been loaded yet (first runWithSdkContext
 *   call hasn't completed)
 * - We're in Node with ALS loaded but outside a runWithSdkContext callback
 *
 * In all these cases, sdkFetch falls back to module-level state.
 */
function getScopedContext(): ScopedSdkContext | undefined {
  return alsInstance?.getStore();
}

/**
 * Run `fn` with a request-scoped baseUrl + tokenProvider. All sdkFetch
 * calls made inside `fn` (including across awaits and timers) will use
 * the passed context instead of the module-level state. Concurrent calls
 * each have their own isolated store, so one request's JWT can never
 * leak into another's.
 *
 * Node only — throws in the browser. For browser code, use setTokenProvider
 * and setApiBaseUrl (module-level state is safe there because there's
 * only one user per browser tab).
 *
 * @example
 * await runWithSdkContext(
 *   { baseUrl: config.loomApiUrl, tokenProvider: () => auth.workosJwt },
 *   () => runProgramExecutor(spec, ctx)
 * );
 */
export async function runWithSdkContext<T>(
  ctx: ScopedSdkContext,
  fn: () => Promise<T> | T
): Promise<T> {
  const als = await ensureAls();
  if (!als) {
    throw new Error(
      "runWithSdkContext is only available in Node runtime. " +
        "Browser code should use setTokenProvider + setApiBaseUrl instead."
    );
  }
  return als.run(ctx, async () => fn());
}

/* ────────────────────────────────────────────────────────────────
 * Public configuration API
 * ──────────────────────────────────────────────────────────────── */

/**
 * Configure the API base URL
 */
export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url;
}

/**
 * Get the current API base URL
 */
export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

/**
 * Set the token provider function
 * This function will be called before each request to get the auth token
 *
 * @example
 * // With WorkOS AuthKit
 * setTokenProvider(() => getAccessToken())
 *
 * @example
 * // With a static token
 * setTokenProvider(() => 'my-static-token')
 */
export function setTokenProvider(
  provider: (() => Promise<string | null> | string | null) | null
): void {
  tokenProvider = provider;
}

/**
 * Check if the response looks like a wrapped API response
 */
function isWrappedResponse(data: unknown): data is WrappedResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.success === "boolean" && "data" in obj;
}

/**
 * Unwrap the API response envelope
 *
 * The API returns all responses in this format:
 * { success: boolean, data: T, eventId?: string, eventDateTime?: string, errors?: [...] }
 *
 * This function extracts just the `data` field for cleaner consumption.
 * If success is false, it throws an error with details from the errors array.
 * If the response isn't in the expected envelope format, it's returned as-is.
 */
export function unwrapResponse<T>(responseData: unknown): T {
  // Check if this looks like a wrapped response
  if (!isWrappedResponse(responseData)) {
    // Not a wrapped response, return as-is
    return responseData as T;
  }

  // Handle unsuccessful responses (API returned success: false)
  if (!responseData.success && responseData.errors && responseData.errors.length > 0) {
    const firstError = responseData.errors[0];
    if (firstError) {
      throw apiErrorFromBody(responseData, {
        status: 400,
        statusText: "Request failed",
        defaultCode: "UNKNOWN",
      });
    }
  }

  // Return the unwrapped data
  return responseData.data as T;
}

/**
 * SDK fetch implementation for Orval-generated hooks
 *
 * This function is used as the mutator for all generated API calls.
 * It handles:
 * - Base URL configuration (scoped context first, module-level fallback)
 * - Auth token injection (same priority)
 * - Request/response formatting
 * - Error handling
 * - Reactive 401 retry with token refresh
 *
 * @remarks
 * Generic T is intentionally unconstrained to support Orval code generation.
 * Type safety is provided by the generated client functions, not this wrapper.
 *
 * @param url - The URL path (e.g., '/customers' or '/customers?page=1')
 * @param options - Standard RequestInit options (method, body, headers, etc.)
 */
export async function sdkFetch<T>(url: string, options?: RequestInit): Promise<T> {
  // Resolve the effective baseUrl and tokenProvider ONCE at the top of the
  // call. The resolved values are used for both the initial request and the
  // 401 retry, so the whole call operates within a single consistent context.
  //
  // Lookup priority:
  //   1. Active AsyncLocalStorage scope (Node, inside runWithSdkContext)
  //   2. Module-level state (set via setApiBaseUrl / setTokenProvider)
  const scoped = getScopedContext();
  const effectiveBaseUrl = scoped?.baseUrl ?? apiBaseUrl;
  const effectiveTokenProvider = scoped?.tokenProvider ?? tokenProvider;

  // Build the full URL
  const fullUrl = `${effectiveBaseUrl}${url}`;

  // Get the auth token
  let token: string | null = null;
  if (effectiveTokenProvider) {
    token = await effectiveTokenProvider();
  }

  // Build request headers
  const headers = new Headers(options?.headers);

  // A multipart body sets its own Content-Type, boundary included, so a JSON default would break it.
  if (!headers.has("Content-Type") && !(options?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Make the request
  let response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  // Parse response — using `let` since both may be reassigned on 401 retry
  let responseData: unknown = null;
  const contentType = response.headers.get("content-type");
  // Check content-length header to avoid parsing empty responses
  // Only skip parsing if content-length is explicitly "0"
  // Note: null content-length is normal for chunked/proxied responses
  const contentLength = response.headers.get("content-length");
  const hasContent = contentLength !== "0";

  if (isJsonContentType(contentType) && hasContent) {
    try {
      responseData = await response.json();
    } catch (parseError) {
      // Log parse errors in development for debugging malformed responses
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        console.warn("[sdk-client] Failed to parse JSON response:", parseError);
      }
      responseData = null;
    }
  }

  // Reactive 401 retry: if unauthorized and we have a token provider, try refreshing once.
  // Skip retry for ReadableStream bodies — the stream is consumed by the first fetch and can't be replayed.
  //
  // Retry fires when the first request had a stale token AND when it had no
  // token at all (provider returned null because AuthKit hadn't produced a JWT
  // yet). The `freshToken && freshToken !== token` guard inside still prevents
  // infinite loops when the provider keeps returning the same value.
  //
  // The retry uses the SAME effectiveTokenProvider resolved at call entry, so
  // the scoped context (AsyncLocalStorage) is preserved across the retry.
  const isRetryableBody = !(options?.body instanceof ReadableStream);
  if (!response.ok && response.status === 401 && effectiveTokenProvider && isRetryableBody) {
    const freshToken = await effectiveTokenProvider();
    if (freshToken && freshToken !== token) {
      headers.set("Authorization", `Bearer ${freshToken}`);
      if (!response.bodyUsed) {
        void response.body?.cancel();
      }
      response = await fetch(fullUrl, { ...options, headers });

      // Re-parse the retried response
      responseData = null;
      const retryContentType = response.headers.get("content-type");
      const retryContentLength = response.headers.get("content-length");
      const retryHasContent = retryContentLength !== "0";

      if (isJsonContentType(retryContentType) && retryHasContent) {
        try {
          responseData = await response.json();
        } catch {
          responseData = null;
        }
      }
    }
  }

  // Handle error responses
  if (!response.ok) {
    // For non-OK responses, the JSON parse above only ran if the
    // content-type was JSON (application/json or a +json type such as
    // application/problem+json). Some platforms (and proxies)
    // return text/plain or text/html for 4xx/5xx with the actual error
    // text in the body. Always attempt a raw text read so we don't lose
    // diagnostic context when the platform doesn't speak JSON for errors.
    let rawBody: string | null = null;
    if (responseData === null && !response.bodyUsed) {
      try {
        rawBody = await response.text();
        // If the body looks like JSON, parse it so envelope/message
        // extraction below still works. Some platforms return JSON with
        // text/plain content-type — don't lose them to a header bug.
        const trimmed = rawBody.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            responseData = JSON.parse(trimmed);
          } catch {
            // Keep responseData null; rawBody carries the text.
          }
        }
      } catch {
        // Stream consumed or read failed — rawBody stays null.
      }
    }

    throw apiErrorFromBody(responseData, {
      status: response.status,
      statusText: response.statusText,
      requestIdHeader: response.headers.get("x-request-id"),
      rawText: rawBody,
    });
  }

  // Unwrap the API response envelope and return in Orval's expected format
  // API returns: { success, data: Entity, eventId, ... }
  // Orval expects: { data: Entity, status: number, headers: Headers }
  const unwrappedData = unwrapResponse(responseData);
  return {
    data: unwrappedData,
    status: response.status,
    headers: response.headers,
  } as T;
}

/**
 * Error type for generated hooks
 * This is used by Orval to type the error response
 */
export type ErrorType<Error> = ApiError & { status: number } & Error;

/**
 * Body type for request payloads
 */
export type BodyType<T> = T;

export default sdkFetch;
