/**
 * Webhook Detail Sheet Content
 *
 * Displays all webhook endpoint fields with action buttons. Sections cover basic
 * info, event subscriptions, signing-secret management (reveal / copy / rotate +
 * an inline verification snippet), and timestamps.
 */

import { formatDateTime } from "@loom-loyalty/core";
import {
  ChevronDown,
  Code2,
  Edit,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "../../../data-display/status-badge.js";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { CopyButton } from "../../../primitives/copy-button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import { DetailRow } from "./detail-row.js";
import type { WebhookDetailProps } from "./types.js";

const HIDDEN_SECRET = "•".repeat(24);

const VERIFICATION_SNIPPET = `import { Webhook } from "svix";

// Your endpoint's signing secret
const wh = new Webhook(secret);

// Verify the raw request body against the Svix headers
const event = wh.verify(payload, {
  "svix-id": req.headers["svix-id"],
  "svix-timestamp": req.headers["svix-timestamp"],
  "svix-signature": req.headers["svix-signature"],
});`;

/**
 * Webhook detail content for Sheet display
 */
export function WebhookDetail({
  webhook,
  onEdit,
  onDelete,
  onTest,
  onRotateSecret,
  canEdit = true,
  canDelete = true,
  secret,
  showSecret = false,
  onToggleSecret,
  transformation,
  transformationLoading = false,
  onEditTransformation,
}: WebhookDetailProps): ReactNode {
  const hasEvents = Boolean(webhook.events && webhook.events.length > 0);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="URL" value={webhook.url} mono />
          {webhook.description && <DetailRow label="Description" value={webhook.description} />}
          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            <div className="mt-1">
              <StatusBadge status={webhook.status} />
            </div>
          </div>
        </div>
      </section>

      {/* Event Subscriptions */}
      {hasEvents && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Event Subscriptions
          </h3>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Subscribed events">
            {webhook.events?.map((event) => (
              <Badge key={event} variant="secondary" className="font-mono text-xs" role="listitem">
                {event}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {webhook.events?.length} event{webhook.events?.length !== 1 ? "s" : ""} subscribed
          </p>
        </section>
      )}

      {/* Signing Secret */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Signing Secret
        </h3>
        <div className="space-y-3">
          <div className="bg-muted flex items-center justify-between rounded-lg p-3">
            <code
              className={cn(
                "text-foreground flex-1 truncate font-mono text-sm",
                !showSecret && "select-none"
              )}
              aria-label={
                showSecret
                  ? secret
                    ? "Signing secret"
                    : "Signing secret unavailable"
                  : "Signing secret (hidden)"
              }
            >
              {showSecret ? (secret ? secret : "Secret unavailable") : HIDDEN_SECRET}
            </code>
            <div className="ml-2 flex gap-1">
              {onToggleSecret && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleSecret}
                  aria-label={showSecret ? "Hide secret" : "Reveal secret"}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              )}
              {showSecret && secret && <CopyButton value={secret} label="Copy signing secret" />}
              {onRotateSecret && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRotateSecret}
                  aria-label="Rotate signing secret"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Use this secret to verify webhook payload signatures.
          </p>

          {/* Inline verification snippet */}
          <details className="group border-border rounded-lg border">
            <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <ShieldCheck className="text-primary h-4 w-4" aria-hidden="true" />
                How to verify signatures
              </span>
              <ChevronDown
                className="text-muted-foreground h-4 w-4 group-open:rotate-180 motion-safe:transition-transform"
                aria-hidden="true"
              />
            </summary>
            <div className="border-border space-y-3 border-t p-3">
              <p className="text-muted-foreground text-xs">
                Every delivery is signed and carries these headers:
              </p>
              <ul className="flex flex-wrap gap-1.5" aria-label="Signature headers">
                {["svix-id", "svix-timestamp", "svix-signature"].map((header) => (
                  <li key={header}>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {header}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="bg-muted overflow-hidden rounded-md">
                <div className="border-border/60 flex items-center justify-between border-b px-3 py-1.5">
                  <span className="text-muted-foreground text-xs">Node.js</span>
                  <CopyButton value={VERIFICATION_SNIPPET} label="Copy verification snippet" />
                </div>
                <pre
                  tabIndex={0}
                  role="region"
                  aria-label="Signature verification snippet"
                  className="text-foreground overflow-x-auto p-3 font-mono text-xs leading-relaxed"
                >
                  <code>{VERIFICATION_SNIPPET}</code>
                </pre>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* Transformation — outbound JS run on each delivery. Section is shown
          only when the consumer wires an editor handler. */}
      {onEditTransformation && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Transformation
          </h3>
          {transformationLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading transformation">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant={transformation?.enabled ? "success" : "secondary"}>
                {transformation?.enabled ? "Enabled" : "Disabled"}
              </Badge>
              {transformation?.code ? (
                <pre
                  tabIndex={0}
                  role="region"
                  aria-label="Transformation code preview"
                  className="bg-muted text-foreground max-h-40 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed"
                >
                  <code>{transformation.code}</code>
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No transformation configured — the raw event payload is delivered as-is.
                </p>
              )}
              <Button variant="outline" onClick={onEditTransformation}>
                <Code2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit transformation
              </Button>
              <p className="text-muted-foreground text-xs">
                JavaScript that rewrites each payload before delivery.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow
            label="Created"
            value={formatDateTime(webhook.createdDateTime) || "—"}
            dateTime={webhook.createdDateTime}
          />
          <DetailRow
            label="Last Updated"
            value={formatDateTime(webhook.updatedDateTime) || "—"}
            dateTime={webhook.updatedDateTime}
          />
        </div>
      </section>

      {/* Action Buttons */}
      {(canEdit || canDelete || onTest) && (
        <div className="border-border flex flex-wrap gap-2 border-t pt-4">
          {onTest && (
            <Button variant="outline" className="flex-1" onClick={onTest}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Test
            </Button>
          )}
          {canDelete && onDelete && (
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 flex-1"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          )}
          {canEdit && onEdit && (
            <Button variant="primary-gradient" className="flex-1" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
