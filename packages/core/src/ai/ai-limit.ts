/**
 * Recognise an AI daily-limit refusal from ai-server.
 *
 * Only a refusal coded `DAILY_LIMIT_REACHED` counts. Every other response,
 * including the request limiter's 429 (`RATE_LIMITED`), yields null so the
 * caller keeps its existing copy.
 */

import { parseISODateTime } from "../utils/dates";
import type { AiLimit } from "./ai-limit-types";

const AI_LIMIT_CODE = "DAILY_LIMIT_REACHED";

/** Plain-text fallback for an AI limit, for callers that only render strings. */
export const AI_LIMIT_MESSAGE = "Daily AI limit reached.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Parse an already-decoded 429 body or chat `RUN_ERROR` event. Returns null
 * unless it carries `code: "DAILY_LIMIT_REACHED"`.
 */
export function parseAiLimit(value: unknown, now: Date = new Date()): AiLimit | null {
  if (!isRecord(value) || value.code !== AI_LIMIT_CODE) return null;

  let resetsAt: Date | null = null;
  if (typeof value.resets_at === "string") {
    resetsAt = parseISODateTime(value.resets_at);
  }
  if (!resetsAt && typeof value.retry_after === "number" && Number.isFinite(value.retry_after)) {
    resetsAt = new Date(now.getTime() + Math.max(0, value.retry_after) * 1000);
  }

  return { resetsAt, upgrade: value.upgrade === true };
}

/** A `Response` resolves asynchronously; a parsed body or event answers at once. */
export type ReadAiLimitResult<T> =
  T extends Pick<Response, "status" | "json"> ? Promise<AiLimit | null> : AiLimit | null;

/**
 * Read an AI limit refusal.
 *
 * - Given a `Response`, reads a 429's JSON body through a clone (so the caller
 *   can still read the original) and resolves to the limit or null.
 * - Given a parsed body or a chat `RUN_ERROR` event, returns the limit or null.
 */
export function readAiLimit<T>(value: T): ReadAiLimitResult<T> {
  const result = isResponseLike(value) ? readAiLimitResponse(value) : parseAiLimit(value);
  return result as ReadAiLimitResult<T>;
}

type ResponseLike = Pick<Response, "status" | "json"> & { clone?: () => Pick<Response, "json"> };

/** A fetch `Response`, or a test double with the same `status` and `json()`. */
function isResponseLike(value: unknown): value is ResponseLike {
  if (typeof Response !== "undefined" && value instanceof Response) return true;
  return isRecord(value) && typeof value.status === "number" && typeof value.json === "function";
}

async function readAiLimitResponse(response: ResponseLike): Promise<AiLimit | null> {
  if (response.status !== 429) return null;
  try {
    // Read a clone so the caller can still read the original body.
    const source = typeof response.clone === "function" ? response.clone() : response;
    const body: unknown = await source.json();
    return parseAiLimit(body);
  } catch {
    // Non-JSON or already-consumed body: not something we can recognise.
    return null;
  }
}
