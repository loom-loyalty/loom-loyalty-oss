/**
 * @loom-loyalty/core/ai
 *
 * Shared hooks and types for AI chat integration.
 */

// Types
export type { AiLimit, AiLimitCode, AiLimitResponseBody } from "./ai-limit-types";
export type {
  AiConfig,
  AiFeedbackRequest,
  AiMessageHistoryResponse,
  AiSuggestedPrompt,
  AiSuggestionsResponse,
  AiThreadInfo,
  AiThreadListResponse,
  AiThreadMessage,
  AiThreadUpdateRequest,
} from "./types";

// AI daily-limit refusals
export { AI_LIMIT_MESSAGE, parseAiLimit, readAiLimit } from "./ai-limit";
export type { ReadAiLimitResult } from "./ai-limit";

// Hooks
export { useAiFeedback } from "./use-ai-feedback";
export { useAiSuggestions } from "./use-ai-suggestions";
