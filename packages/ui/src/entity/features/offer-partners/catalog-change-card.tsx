/**
 * One catalog change from an offer partner's daily sync: what changed, what it
 * means for members, before and after, and Accept/Dismiss when it waits for an
 * admin. Automatic changes render as a record with no actions.
 */
import { formatDateTime } from "@loom-loyalty/core";
import type { OfferPartnerCatalogChange } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import { describeCatalogChange } from "./catalog-changes.js";

export interface CatalogChangeCardProps {
  change: OfferPartnerCatalogChange;
  /** Name of the offer the change is on; omitted inside that offer's own sheet. */
  offerName?: string;
  currency?: string;
  /** Accepts the change; Accept/Dismiss show only when both handlers are given. */
  onAccept?: () => void;
  onDismiss?: () => void;
  /** Disables the actions while an answer is being saved. */
  answering?: boolean;
  /** Error from the last answer, shown inline. */
  error?: string | null;
  className?: string;
}

export function CatalogChangeCard({
  change,
  offerName,
  currency,
  onAccept,
  onDismiss,
  answering = false,
  error,
  className,
}: CatalogChangeCardProps): ReactNode {
  const description = describeCatalogChange(change, currency);
  const automatic =
    change.changeType === "ITEM_RETIRED" || change.changeType === "DENOMINATIONS_PAUSED";
  const tone = description.needsReview
    ? "border-warning/50 bg-status-pending-bg text-status-pending-fg"
    : automatic
      ? "border-destructive/30 bg-status-error-bg text-status-error-fg"
      : "border-border bg-card text-foreground";
  const canAnswer = description.needsReview && onAccept && onDismiss;

  return (
    <article
      className={cn("space-y-4 rounded-lg border p-4", tone, className)}
      aria-label={`${description.title}${offerName ? ` on ${offerName}` : ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold">
            {description.title}
            {offerName ? <span className="font-normal"> · {offerName}</span> : null}
          </p>
          {description.impact ? <p className="text-sm">{description.impact}</p> : null}
        </div>
        <p className="text-xs whitespace-nowrap">
          {description.statusLabel}
          {change.createdDateTime ? (
            <>
              {" · "}
              <time dateTime={change.createdDateTime}>
                {formatDateTime(change.createdDateTime)}
              </time>
            </>
          ) : null}
        </p>
      </header>

      {description.lines.length > 0 ? (
        <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
          {description.lines.map((line) => (
            <div key={line.label} className="contents">
              <dt className="font-medium">{line.label}</dt>
              <dd className="min-w-0 space-y-0.5 break-words">
                <span className="block line-through opacity-80">
                  <span className="sr-only">Before: </span>
                  {line.before}
                </span>
                <span className="block font-medium">
                  <span className="sr-only">After: </span>
                  {line.after}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {canAnswer ? (
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={onAccept} disabled={answering}>
            Accept change
          </Button>
          <Button className="min-h-11" variant="outline" onClick={onDismiss} disabled={answering}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </article>
  );
}
