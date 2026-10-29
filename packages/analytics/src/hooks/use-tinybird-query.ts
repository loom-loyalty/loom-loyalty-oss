import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { DEFAULT_STALE_TIMES } from "../constants";
import type { PipeName, PipeParams } from "../pipes";
import { useTinybird } from "../provider";
import type { TinybirdResponse } from "../types";
import { buildQueryParams, normalizeTinybirdResponse } from "../utils";

interface UseTinybirdQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
}

export function useTinybirdQuery<P extends PipeName, T>(
  pipe: P,
  params: PipeParams[P],
  options?: UseTinybirdQueryOptions
): UseQueryResult<TinybirdResponse<T>> {
  const { token, baseUrl, pipes, isLoading: tokenLoading } = useTinybird();
  const pipeAllowed = pipes.includes(pipe);
  const queryString = buildQueryParams(params as Record<string, unknown>);
  const url = baseUrl
    ? `${baseUrl}/v0/pipes/${pipe}.json${queryString ? `?${queryString}` : ""}`
    : "";

  return useQuery<TinybirdResponse<T>>({
    queryKey: ["tinybird", pipe, params],
    queryFn: async () => {
      if (!token || !baseUrl) throw new Error("Analytics token not available");
      if (!pipeAllowed) throw new Error(`Pipe "${pipe}" is not available on your current plan`);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 403) throw new Error("PIPE_ACCESS_DENIED");
      if (response.status === 429) throw new Error("RATE_LIMITED");
      if (!response.ok) throw new Error(`TinyBird query failed: ${String(response.status)}`);
      const json = (await response.json()) as TinybirdResponse<T>;
      return normalizeTinybirdResponse(json);
    },
    enabled: (options?.enabled ?? true) && !!token && !!baseUrl && !tokenLoading && pipeAllowed,
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIMES.trend,
    refetchInterval: options?.refetchInterval,
    retry: (failureCount, error) => {
      if (
        error instanceof Error &&
        (error.message === "PIPE_ACCESS_DENIED" || error.message === "RATE_LIMITED")
      )
        return false;
      return failureCount < 2;
    },
  });
}
