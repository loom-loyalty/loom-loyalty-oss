/**
 * AI daily-limit types.
 *
 * ai-server refuses a budgeted request once the caller's daily AI allowance
 * is spent. Generator routes answer HTTP 429 with an {@link AiLimitResponseBody};
 * chat emits an AG-UI `RUN_ERROR` carrying the same fields.
 */

/** Error code ai-server sends when a daily AI budget refused the request. */
export type AiLimitCode = "DAILY_LIMIT_REACHED";

/**
 * Body of a budget 429 from a generator route. `upgrade` and `resets_at` were
 * added later, so older servers omit them.
 */
export interface AiLimitResponseBody {
  error: string;
  code: AiLimitCode;
  retry_after?: number;
  request_id?: string;
  /** True when upgrading lifts the limit (trial orgs): the client should offer an upgrade. */
  upgrade?: boolean;
  /** ISO 8601 time the allowance resets (next UTC midnight). */
  resets_at?: string;
}

/** The parsed limit refusal every AI surface renders. */
export interface AiLimit {
  /** When the allowance resets, or null when the server did not say. */
  resetsAt: Date | null;
  /** Whether to offer an upgrade (trial orgs only). */
  upgrade: boolean;
}
