"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listThreads } from "./thread-api";

export interface RecentThread {
  id: string;
  title: string;
  /** Last activity (ISO), falling back to creation. */
  activeAt: string;
}

export interface UseRecentThreadsOptions {
  baseUrl: string;
  getToken?: () => Promise<string>;
  credentials?: RequestCredentials;
  /** How many to ask for; the server lists newest first. Default 5. */
  limit?: number;
  /** Change it to fetch again. */
  refreshKey?: number;
}

export interface UseRecentThreadsResult {
  threads: RecentThread[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * The user's most recent conversations from `/api/ai/threads` (the same list
 * the chat sheet's storage reads), fetched once per mount and again whenever
 * `refreshKey` changes or `retry` is called. No cache survives an unmount, so
 * an organization, environment or user switch fetches fresh for the current
 * credentials. A response for a superseded fetch is dropped.
 */
export function useRecentThreads({
  baseUrl,
  getToken,
  credentials,
  limit = 5,
  refreshKey = 0,
}: UseRecentThreadsOptions): UseRecentThreadsResult {
  const [threads, setThreads] = useState<RecentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    listThreads({ baseUrl, getToken, credentials, limit, signal: controller.signal })
      .then(({ threads: rows }) => {
        if (mine !== seq.current) return;
        setThreads(
          rows
            .slice(0, limit)
            .map((t) => ({ id: t.id, title: t.title, activeAt: String(t.createdAt) }))
        );
        setIsLoading(false);
      })
      .catch((e: unknown) => {
        if (mine !== seq.current || controller.signal.aborted) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [baseUrl, getToken, credentials, limit, refreshKey, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { threads, isLoading, error, retry };
}
