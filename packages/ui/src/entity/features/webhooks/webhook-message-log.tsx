/**
 * WebhookMessageLog - Timeline/table of webhook delivery attempts
 *
 * Shows timestamp, event type, delivery status, response code, and retry button.
 * Follows the same card-based layout pattern as the existing webhook deliveries UI.
 */

import { CheckCircle, Loader2, RefreshCw, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { WebhookMessageLogProps } from "./types.js";

/**
 * Status icon component for message delivery status
 */
function StatusIcon({ status }: { status: "success" | "failed" | "pending" }) {
  switch (status) {
    case "success":
      return <CheckCircle className="text-success-dark h-4 w-4 shrink-0" aria-hidden="true" />;
    case "failed":
      return <XCircle className="text-destructive h-4 w-4 shrink-0" aria-hidden="true" />;
    case "pending":
      return (
        <Loader2
          className="text-muted-foreground h-4 w-4 shrink-0 motion-safe:animate-spin"
          aria-hidden="true"
        />
      );
  }
}

/**
 * Get human-readable label for delivery status
 */
function getStatusLabel(status: "success" | "failed" | "pending"): string {
  switch (status) {
    case "success":
      return "Delivered";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
  }
}

/**
 * Webhook message log - shows delivery attempts with status and actions
 */
export function WebhookMessageLog({
  messages,
  isLoading = false,
  onRetry,
  canRetry = false,
  onSelect,
}: WebhookMessageLogProps): ReactNode {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading webhook messages">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border-border bg-muted/50 flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="border-border rounded-lg border p-8 text-center">
        <p className="text-muted-foreground text-sm">
          No delivery attempts yet. Messages will appear here when webhooks are triggered.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" role="log" aria-label="Webhook delivery log">
      {messages.map((message) => {
        const info = (
          <>
            <div className="flex items-center gap-3">
              <StatusIcon status={message.status} />
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {message.eventType}
                </Badge>
                {message.responseCode != null && (
                  <span
                    className={cn(
                      "font-mono text-xs",
                      message.responseCode >= 200 && message.responseCode < 300
                        ? "text-success-dark"
                        : "text-destructive"
                    )}
                  >
                    {message.responseCode}
                  </span>
                )}
              </div>
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-sm">
              {message.duration && <span className="text-xs">{message.duration}</span>}
              <time className="text-xs" dateTime={message.rawTimestamp}>
                {message.timestamp}
              </time>
            </div>
          </>
        );

        // A row is interactive only when the caller wired onSelect AND the row
        // permits drill-in — otherwise it would render a button that silently
        // does nothing (e.g. an attempt with no messageId to fetch).
        const selectable = Boolean(onSelect) && message.selectable !== false;

        return (
          <article
            key={message.id}
            className="border-border bg-muted/50 flex items-center gap-2 rounded-lg border p-3"
            // When selectable, the nested button carries the accessible name; a
            // label here would make screen readers announce it twice.
            aria-label={
              selectable ? undefined : `${message.eventType} - ${getStatusLabel(message.status)}`
            }
          >
            {selectable ? (
              <button
                type="button"
                onClick={() => onSelect?.(message.id)}
                className="focus-visible:ring-ring hover:bg-muted flex flex-1 items-center justify-between gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none motion-safe:transition-colors"
                aria-label={`View ${message.eventType} delivery attempt`}
              >
                {info}
              </button>
            ) : (
              <div className="flex flex-1 items-center justify-between gap-3">{info}</div>
            )}
            {canRetry && message.status === "failed" && onRetry && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRetry(message.id)}
                aria-label={`Retry ${message.eventType} delivery`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}
