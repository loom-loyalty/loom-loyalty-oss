/**
 * AI Chat Types
 *
 * Shared types for the Loom Loyalty AI chat integration.
 * SSE streaming uses the AG-UI protocol (@ag-ui/core) — event types
 * are defined there, not here.
 */

// =============================================================================
// Configuration
// =============================================================================

/** Configuration for AI hooks — supports both BFF proxy and direct JWT auth */
export interface AiConfig {
  /** Base URL for AI API (empty string for relative/BFF proxy, or full URL for direct access) */
  baseUrl: string;
  /** Token provider for direct JWT auth (omit when using BFF cookies) */
  getToken?: () => Promise<string>;
  /** Fetch credentials mode (use "include" for BFF cookie-based auth) */
  credentials?: RequestCredentials;
}

// =============================================================================
// Requests
// =============================================================================

/** PATCH /api/threads/:id request body */
export interface AiThreadUpdateRequest {
  /** New thread title */
  title: string;
}

/** POST /api/threads/:id/feedback request body */
export interface AiFeedbackRequest {
  /** Zero-based message index in the thread */
  message_index: number;
  /** Rating value */
  rating: "thumbs_up" | "thumbs_down";
  /** Optional comment (max 2000 chars) */
  comment?: string;
}

// =============================================================================
// Responses
// =============================================================================

/** Thread info returned from list/detail endpoints */
export interface AiThreadInfo {
  thread_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/threads response */
export interface AiThreadListResponse {
  threads: AiThreadInfo[];
  next_cursor: string | null;
}

/** Individual message from thread history */
export interface AiThreadMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  agent: string | null;
  tool_name: string | null;
  created_at: string;
}

/** GET /api/threads/:id/messages response */
export interface AiMessageHistoryResponse {
  thread_id: string;
  messages: AiThreadMessage[];
}

/** Suggested prompt for empty chat state */
export interface AiSuggestedPrompt {
  id: string;
  text: string;
  category: string;
}

/** GET /api/suggestions response */
export interface AiSuggestionsResponse {
  suggestions: AiSuggestedPrompt[];
}
