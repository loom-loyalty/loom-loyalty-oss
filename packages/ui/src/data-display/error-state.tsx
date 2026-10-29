"use client";

/**
 * ErrorState - shows a failed load or action in the main content area.
 *
 * Takes the thrown value and turns it into user copy with `describeError`:
 * the API's message for errors the user can act on, a generic message for
 * server faults, and the request id as a copyable support reference. Retry is
 * offered only when trying again may help (server faults, network failures,
 * timeouts and rate limits).
 */

import { describeError, type DescribeErrorOptions } from "@loom-loyalty/core";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { CopyButton } from "../primitives/copy-button";

export interface ErrorStateProps {
  /** The thrown value (SDK `ApiError`, `Error`, string, or anything else). */
  error: unknown;
  /** Short heading, e.g. "Couldn't load offers". */
  title: string;
  /** Message shown when the error carries none of its own. */
  fallback?: string;
  /** Per-code copy overrides passed to `describeError`. */
  overrides?: DescribeErrorOptions["overrides"];
  /** Retry handler; the button shows only for retryable errors. */
  onRetry?: () => void;
  isRetrying?: boolean;
  /** `page` fills a list or page body; `inline` sits inside a section or sheet. */
  variant?: "page" | "inline";
  className?: string;
}

/** Support reference line: "Reference: <id>" with a copy button. */
export function ErrorReference({
  requestId,
  className,
}: {
  requestId: string;
  className?: string;
}): ReactNode {
  return (
    <p className={cn("text-muted-foreground flex items-center gap-1 text-xs", className)}>
      <span>
        Reference: <span className="font-mono">{requestId}</span>
      </span>
      <CopyButton value={requestId} label="Copy support reference" className="min-h-11 min-w-11" />
    </p>
  );
}

export function ErrorState({
  error,
  title,
  fallback,
  overrides,
  onRetry,
  isRetrying = false,
  variant = "page",
  className,
}: ErrorStateProps): ReactNode {
  const described = describeError(error, { fallback, overrides });
  const showRetry = onRetry !== undefined && described.retryable;

  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between",
        variant === "page" ? "p-4" : "p-3",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-destructive text-sm font-medium">{title}</p>
          <p className="text-destructive mt-1 text-sm">{described.message}</p>
          {described.requestId && (
            <ErrorReference requestId={described.requestId} className="mt-1" />
          )}
        </div>
      </div>
      {showRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="min-h-11 self-start sm:self-auto"
        >
          {isRetrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  );
}
