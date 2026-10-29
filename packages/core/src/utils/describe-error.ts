/**
 * Turn any thrown value into what a screen shows the user.
 *
 * API errors carry a user-safe `message` written by the platform, a stable
 * `code`, `fieldErrors` and a `requestId`. Server faults and network failures
 * get a generic message; the request id lets support find the failing request.
 * Raw codes and HTTP status numbers are never part of the message.
 */

import type { ApiFieldError } from "@loom-loyalty/sdk/core";
import { getErrorCode, getFieldErrors, getRequestId } from "@loom-loyalty/sdk/core";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type ErrorCopyOverride = string | ((params: Record<string, unknown>) => string);

export interface DescribeErrorOptions {
  /** Shown for values that carry no usable message. Defaults to the generic message. */
  fallback?: string;
  /** Replaces the generic message for server faults and network failures. */
  genericMessage?: string;
  /** Per-code copy, for surfaces (such as the shopper portal) that need their own wording. */
  overrides?: Record<string, ErrorCopyOverride>;
}

export interface DescribedError {
  message: string;
  /** Catalog code, for branching; never shown to users. */
  code?: string;
  /** Support reference for the failing request. */
  requestId?: string;
  fieldErrors: ApiFieldError[];
  /**
   * True when trying again may succeed: server faults, network failures,
   * timeouts and rate limits, and errors with no HTTP status.
   */
  retryable: boolean;
  /** True when the error is not something the user can fix. */
  unexpected: boolean;
}

const RUNTIME_FAULTS = [TypeError, ReferenceError, SyntaxError, RangeError];

/** Client errors that are transient: request timeout, too early, too many requests. */
const TRANSIENT_CLIENT_STATUSES = new Set([408, 425, 429]);

function apiStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  if (typeof status === "number") return status;
  return typeof statusCode === "number" ? statusCode : undefined;
}

function nonEmptyMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { message } = error as { message?: unknown };
  return typeof message === "string" && message.trim().length > 0 ? message : undefined;
}

function paramsOf(error: unknown): Record<string, unknown> {
  if (typeof error !== "object" || error === null) return {};
  const { params } = error as { params?: unknown };
  return typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
}

export function describeError(error: unknown, options: DescribeErrorOptions = {}): DescribedError {
  const generic = options.genericMessage ?? GENERIC_ERROR_MESSAGE;
  const fallback = options.fallback ?? generic;
  const code = getErrorCode(error);
  const requestId = getRequestId(error);
  const fieldErrors = getFieldErrors(error);
  const status = apiStatus(error);

  const override = code ? options.overrides?.[code] : undefined;
  if (override !== undefined) {
    const message = typeof override === "function" ? override(paramsOf(error)) : override;
    const unexpected = status === undefined || status === 0 || status >= 500;
    return { message, code, requestId, fieldErrors, retryable: unexpected, unexpected };
  }

  if (status !== undefined) {
    if (status === 0 || status >= 500) {
      return { message: generic, code, requestId, fieldErrors, retryable: true, unexpected: true };
    }
    return {
      message: nonEmptyMessage(error) ?? fallback,
      code,
      requestId,
      fieldErrors,
      retryable: TRANSIENT_CLIENT_STATUSES.has(status),
      unexpected: false,
    };
  }

  // An error without an HTTP status never reached the API's answer (network
  // failure, app code, a hand-built `{ message }`), so trying again may help.
  if (error instanceof Error) {
    const runtimeFault = RUNTIME_FAULTS.some((type) => error instanceof type);
    const message = runtimeFault ? generic : (nonEmptyMessage(error) ?? fallback);
    return { message, requestId, fieldErrors, retryable: true, unexpected: runtimeFault };
  }

  const plainMessage = nonEmptyMessage(error);
  if (plainMessage !== undefined) {
    return { message: plainMessage, requestId, fieldErrors, retryable: true, unexpected: false };
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return { message: error, fieldErrors, retryable: false, unexpected: false };
  }

  return { message: fallback, fieldErrors, retryable: false, unexpected: true };
}
