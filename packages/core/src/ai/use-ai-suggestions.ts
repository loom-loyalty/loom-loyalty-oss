/**
 * useAiSuggestions Hook
 *
 * Fetches suggested prompts for the empty chat state.
 * Uses TanStack Query for caching and deduplication.
 */
import { useQuery } from "@tanstack/react-query";

import type { AiConfig, AiSuggestedPrompt, AiSuggestionsResponse } from "./types";

interface UseAiSuggestionsOptions extends AiConfig {
  /** Whether to fetch suggestions (defaults to true) */
  enabled?: boolean;
}

async function fetchSuggestions(config: AiConfig): Promise<AiSuggestedPrompt[]> {
  const headers: Record<string, string> = {};
  if (config.getToken) {
    const token = await config.getToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${config.baseUrl}/api/ai/suggestions`, {
    headers,
    credentials: config.credentials ?? undefined,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: AiSuggestionsResponse = await res.json();
  return data.suggestions;
}

export function useAiSuggestions(options: UseAiSuggestionsOptions) {
  const { baseUrl, getToken, credentials, enabled = true } = options;
  const config: AiConfig = { baseUrl, getToken, credentials };

  return useQuery({
    queryKey: ["ai", "suggestions"],
    queryFn: () => fetchSuggestions(config),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
