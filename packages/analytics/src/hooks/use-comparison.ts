import { differenceInDays, format, subDays } from "date-fns";
import { useMemo } from "react";
import type { PipeName, PipeParams } from "../pipes";
import type { TinybirdResponse } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

interface ComparisonResult<T> {
  current: TinybirdResponse<T> | undefined;
  previous: TinybirdResponse<T> | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function useComparison<P extends PipeName, T>(
  pipe: P,
  params: PipeParams[P],
  enabled = true
): ComparisonResult<T> {
  // Serialize params for stable memoization — inline objects change reference every render
  const paramsKey = JSON.stringify(params);
  const previousParams = useMemo(() => {
    const p = JSON.parse(paramsKey) as Record<string, unknown>;
    if (!p.start_date || !p.end_date) return null;
    const start = new Date(p.start_date as string);
    const end = new Date(p.end_date as string);
    const daysDiff = differenceInDays(end, start);
    return {
      ...p,
      start_date: format(subDays(start, daysDiff), "yyyy-MM-dd"),
      end_date: format(subDays(end, daysDiff), "yyyy-MM-dd"),
    } as PipeParams[P];
  }, [paramsKey]);

  const current = useTinybirdQuery<P, T>(pipe, params, { enabled });
  const previous = useTinybirdQuery<P, T>(pipe, previousParams || params, {
    enabled: enabled && !!previousParams,
  });

  return {
    current: current.data,
    previous: previous.data,
    isLoading: current.isLoading || previous.isLoading,
    error: (current.error as Error | null) || (previous.error as Error | null),
  };
}
