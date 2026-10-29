import { AI_LIMIT_MESSAGE, type AiLimit, readAiLimit } from "@loom-loyalty/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SpindleExplainResultsRequest,
  SpindleExplainResultsResponse,
  SpindleTranslateRequest,
  SpindleTranslateResponse,
} from "../types";

/**
 * Client transport for the Spindle AI query assistant. POSTs to the ai-server
 * via the host app's `/api/ai/*` proxy. Two auth shapes are supported because
 * the two apps front the proxy differently: the Hub holds a WorkOS access token
 * and sends it as a bearer, while the Dashboard's BFF is cookie-authed and
 * exchanges the session for a bearer server-side. Passing no `getAccessToken`
 * selects the cookie path — the request then carries no Authorization header
 * and relies on the same-origin session, which is what the Dashboard proxy
 * expects. Mirrors `use-sql-query.ts`: useState + AbortController refs that
 * cancel an in-flight request on re-call, with status-specific error copy.
 *
 * `translate` and `explainResults` are INDEPENDENT operations with separate
 * abort refs and separate loading/error state — clicking one must not cancel
 * the other or surface its error in the wrong place. The hook is transport-only;
 * it never executes SQL. `translate` returns the proposal so the caller can drop
 * `result.sql` into the editor for human review.
 */

const TRANSLATE_ENDPOINT = "/api/ai/spindle/translate";
const EXPLAIN_RESULTS_ENDPOINT = "/api/ai/spindle/explain-results";

/** Client-side mirror of the server's explain-results row cap. */
const EXPLAIN_RESULTS_ROW_CAP = 50;

export interface SpindleTranslateState {
  /** The most recent successful translate response (never set by explainResults). */
  data: SpindleTranslateResponse | null;
  /** True while a translate request is in flight. */
  isLoading: boolean;
  /** Human-readable error from the last failed translate, or null. */
  error: string | null;
  /** Set when the daily AI allowance refused the last translate; render `AiLimitNotice`. */
  limit: AiLimit | null;
  /** True while an explain-results request is in flight. */
  explainLoading: boolean;
  /** Human-readable error from the last failed explain-results, or null. */
  explainError: string | null;
  /** Set when the daily AI allowance refused the last explain-results. */
  explainLimit: AiLimit | null;
}

export interface UseSpindleTranslate extends SpindleTranslateState {
  translate: (req: SpindleTranslateRequest) => Promise<SpindleTranslateResponse | null>;
  explainResults: (
    args: SpindleExplainResultsRequest
  ) => Promise<SpindleExplainResultsResponse | null>;
  /**
   * Clear the surfaced translate/explain errors. The consumer calls this when an
   * unrelated action (e.g. running a query) should retire a stale AI error that
   * would otherwise linger in the UI until the next AI call.
   */
  reset: () => void;
}

async function errorMessage(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    // A 403 for SQL_WORKBENCH_NOT_ENABLED is a plan/tier block, not an
    // expired session — surface the server's message instead of the
    // generic one so the user knows to upgrade, not to refresh.
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body?.code === "SQL_WORKBENCH_NOT_ENABLED" && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // non-JSON body — fall through to the generic session-expired message
    }
    return "Your session expired. Refresh the page and try again.";
  }
  if (res.status === 413) return "That request was too large. Try a shorter question.";
  if (res.status === 429) return "Too many requests. Wait a moment and try again.";
  if (res.status === 502 || res.status === 503)
    return "The AI assistant is unavailable right now. Try again in a moment.";
  // Surface the server's sanitized error message when present.
  try {
    const body = (await res.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // non-JSON body — fall through to the generic message
  }
  return `Request failed (${String(res.status)})`;
}

type RequestOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; error: string; limit: AiLimit | null }
  | { kind: "aborted" };

const initialState: SpindleTranslateState = {
  data: null,
  isLoading: false,
  error: null,
  limit: null,
  explainLoading: false,
  explainError: null,
  explainLimit: null,
};

export function useSpindleTranslate(getAccessToken?: () => Promise<string>): UseSpindleTranslate {
  const [state, setState] = useState<SpindleTranslateState>(initialState);
  const translateAbortRef = useRef<AbortController | null>(null);
  const explainAbortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request when the consumer unmounts so a navigated-away
  // request stops consuming tokens and can't setState on an unmounted component.
  useEffect(() => {
    return () => {
      translateAbortRef.current?.abort();
      explainAbortRef.current?.abort();
    };
  }, []);

  const runRequest = useCallback(
    async <T>(
      endpoint: string,
      payload: unknown,
      controller: AbortController
    ): Promise<RequestOutcome<T>> => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (getAccessToken) {
          headers.Authorization = `Bearer ${await getAccessToken()}`;
        }
        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          // Sends the session cookie on the no-bearer path. Same-origin would
          // include it by default, but stating it keeps the cookie path working
          // if the proxy is ever fronted from another origin.
          credentials: "include",
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) {
          // A daily AI limit refusal is checked before the generic 429 copy.
          const limit = await readAiLimit(res);
          if (limit) return { kind: "error", error: AI_LIMIT_MESSAGE, limit };
          return { kind: "error", error: await errorMessage(res), limit: null };
        }
        return { kind: "ok", data: (await res.json()) as T };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return { kind: "aborted" };
        return {
          kind: "error",
          error: err instanceof Error ? err.message : "Request failed",
          limit: null,
        };
      }
    },
    [getAccessToken]
  );

  const translate = useCallback(
    async (req: SpindleTranslateRequest): Promise<SpindleTranslateResponse | null> => {
      translateAbortRef.current?.abort();
      const controller = new AbortController();
      translateAbortRef.current = controller;
      setState((prev) => ({ ...prev, isLoading: true, error: null, limit: null }));

      const outcome = await runRequest<SpindleTranslateResponse>(
        TRANSLATE_ENDPOINT,
        req,
        controller
      );
      // Superseded by a newer translate call — that call owns isLoading now.
      if (outcome.kind === "aborted") return null;
      if (outcome.kind === "error") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: outcome.error,
          limit: outcome.limit,
        }));
        return null;
      }
      setState((prev) => ({ ...prev, isLoading: false, error: null, data: outcome.data }));
      return outcome.data;
    },
    [runRequest]
  );

  const explainResults = useCallback(
    async (args: SpindleExplainResultsRequest): Promise<SpindleExplainResultsResponse | null> => {
      explainAbortRef.current?.abort();
      const controller = new AbortController();
      explainAbortRef.current = controller;
      setState((prev) => ({
        ...prev,
        explainLoading: true,
        explainError: null,
        explainLimit: null,
      }));

      // Cap rows client-side too (the server re-caps) so a large result set
      // doesn't ship a huge body. explainResults never touches `data`/`error`.
      const payload: SpindleExplainResultsRequest = {
        ...args,
        rows: args.rows.slice(0, EXPLAIN_RESULTS_ROW_CAP),
      };
      const outcome = await runRequest<SpindleExplainResultsResponse>(
        EXPLAIN_RESULTS_ENDPOINT,
        payload,
        controller
      );
      if (outcome.kind === "aborted") return null;
      if (outcome.kind === "error") {
        setState((prev) => ({
          ...prev,
          explainLoading: false,
          explainError: outcome.error,
          explainLimit: outcome.limit,
        }));
        return null;
      }
      setState((prev) => ({ ...prev, explainLoading: false, explainError: null }));
      return outcome.data;
    },
    [runRequest]
  );

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      limit: null,
      explainError: null,
      explainLimit: null,
    }));
  }, []);

  return { ...state, translate, explainResults, reset };
}
