/**
 * WebhookAttemptDetail - read-only view of a single webhook delivery attempt.
 *
 * Mirrors WebhookDetail: a status summary, then the request payload and response
 * body as plain monospace blocks (no syntax highlighter). Request/response
 * headers aren't exposed by the provider SDK, so they're intentionally omitted.
 */

import type { ReactNode } from "react";
import { StatusBadge } from "../../../data-display/status-badge.js";
import { CopyButton } from "../../../primitives/copy-button.js";
import { DetailRow } from "./detail-row.js";
import type { WebhookAttemptDetailProps } from "./types.js";

/** Pretty-print an arbitrary JSON payload; pass strings through untouched. */
function formatBody(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Detail content for a single delivery attempt, rendered inside a Sheet.
 */
export function WebhookAttemptDetail({ message }: WebhookAttemptDetailProps): ReactNode {
  const requestBody = formatBody(message.payload);
  const responseBody = message.responseBody ?? "";

  return (
    <div className="space-y-6">
      {/* Status */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Status</h3>
        <div className="space-y-3">
          <StatusBadge status={message.status} />
          {message.triggerType && <DetailRow label="Trigger" value={message.triggerType} />}
          {message.responseCode != null && (
            <DetailRow label="Response code" value={String(message.responseCode)} mono />
          )}
          {message.duration && <DetailRow label="Duration" value={message.duration} mono />}
          {message.endpointUrl && <DetailRow label="Endpoint" value={message.endpointUrl} mono />}
          <DetailRow label="Event" value={message.eventType} mono />
          <DetailRow label="Attempted" value={message.timestamp} dateTime={message.rawTimestamp} />
        </div>
      </section>

      {/* Request */}
      <CodeSection label="Request payload" body={requestBody} emptyHint="No request payload." />

      {/* Response */}
      <CodeSection
        label="Response body"
        body={responseBody}
        emptyHint="No response body returned."
      />
    </div>
  );
}

interface CodeSectionProps {
  label: string;
  body: string;
  emptyHint: string;
}

function CodeSection({ label, body, emptyHint }: CodeSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">{label}</h3>
      {body ? (
        <div className="bg-muted overflow-hidden rounded-md">
          <div className="border-border/60 flex items-center justify-end border-b px-3 py-1.5">
            <CopyButton value={body} label={`Copy ${label.toLowerCase()}`} />
          </div>
          <pre
            tabIndex={0}
            role="region"
            aria-label={label}
            className="text-foreground overflow-x-auto p-3 font-mono text-xs leading-relaxed"
          >
            <code>{body}</code>
          </pre>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{emptyHint}</p>
      )}
    </section>
  );
}
