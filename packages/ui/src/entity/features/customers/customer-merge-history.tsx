/**
 * Customer merge history — what a merge left behind on each customer.
 *
 * CustomerMergedBanner sits on a customer that was merged away and links to
 * the customer it became. CustomerMergeHistory sits on a merged customer and
 * lists the customers it was made from, with the replay progress of each
 * merge.
 */

"use client";

import { formatDate } from "@loom-loyalty/core";
import { GitMerge } from "lucide-react";
import type { ReactNode } from "react";

import { Badge, type BadgeProps } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";

export interface CustomerMergedBannerProps {
  /** The customer this one was merged into; absent when the record can't be read. */
  mergedCustomerId?: string;
  isLoading?: boolean;
  onViewMergedCustomer?: (customerId: string) => void;
}

/** Banner on a MERGED customer pointing at the customer it was merged into. */
export function CustomerMergedBanner({
  mergedCustomerId,
  isLoading = false,
  onViewMergedCustomer,
}: CustomerMergedBannerProps): ReactNode {
  return (
    <div
      role="status"
      className="bg-muted border-border flex flex-wrap items-center gap-3 border-b px-4 py-2"
    >
      <GitMerge className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="text-foreground flex-1 text-sm">
        {mergedCustomerId
          ? "This customer was merged into another customer. Its record is kept for history and can't be changed."
          : "This customer was merged. Its record is kept for history and can't be changed."}
      </p>
      {isLoading && <Skeleton className="h-9 w-40" />}
      {!isLoading && mergedCustomerId && onViewMergedCustomer && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => onViewMergedCustomer(mergedCustomerId)}
        >
          View merged customer
        </Button>
      )}
    </div>
  );
}

export interface CustomerMergeHistoryEntry {
  consolidationId: string;
  sourceCustomerIds: string[];
  createdDateTime?: string;
  status?: string;
  totalEvents?: number;
  processedEvents?: number;
  failedEvents?: number;
}

export interface CustomerMergeHistoryProps {
  entries: CustomerMergeHistoryEntry[];
  isLoading?: boolean;
  onViewCustomer?: (customerId: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  PENDING: { label: "Pending", variant: "warning" },
  IN_PROGRESS: { label: "In progress", variant: "info" },
  SYNC_COMPLETE: { label: "Data moved", variant: "info" },
  REPLAY_IN_PROGRESS: { label: "Replaying events", variant: "info" },
  REPLAY_COMPLETE: { label: "Events replayed", variant: "success" },
  COMPLETED: { label: "Complete", variant: "success" },
  FAILED: { label: "Failed", variant: "error" },
};

/** "Merged from" list on a customer that was created by one or more merges. */
export function CustomerMergeHistory({
  entries,
  isLoading = false,
  onViewCustomer,
}: CustomerMergeHistoryProps): ReactNode {
  if (isLoading) {
    return (
      <div className="border-border border-b px-4 py-3">
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (entries.length === 0) return null;

  return (
    <section aria-label="Merged from" className="border-border space-y-2 border-b px-4 py-3">
      <h2 className="text-foreground flex items-center gap-2 text-sm font-medium">
        <GitMerge className="text-muted-foreground h-4 w-4" aria-hidden="true" />
        Merged from
      </h2>
      <ul className="space-y-2">
        {entries.map((entry) => {
          // An unknown status from a newer API shows as-is.
          const status = entry.status
            ? (STATUS_LABELS[entry.status] ?? { label: entry.status, variant: "outline" })
            : undefined;
          const failed = entry.failedEvents ?? 0;
          return (
            <li
              key={entry.consolidationId}
              className="bg-background border-border flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex flex-wrap items-center gap-2">
                {entry.sourceCustomerIds.map((id) =>
                  onViewCustomer ? (
                    <Button
                      key={id}
                      type="button"
                      variant="link"
                      size="sm"
                      className="min-h-11 px-0 font-mono text-xs"
                      onClick={() => onViewCustomer(id)}
                    >
                      {id}
                    </Button>
                  ) : (
                    <span key={id} className="font-mono text-xs">
                      {id}
                    </span>
                  )
                )}
              </span>
              {entry.createdDateTime && (
                <span className="text-muted-foreground">
                  {formatDate(entry.createdDateTime, "MMM d, yyyy h:mm a")}
                </span>
              )}
              {status && <Badge variant={status.variant}>{status.label}</Badge>}
              {entry.totalEvents !== undefined && entry.totalEvents > 0 && (
                <span className="text-muted-foreground">
                  {entry.processedEvents ?? 0} of {entry.totalEvents} events replayed
                </span>
              )}
              {failed > 0 && (
                <span className="text-destructive font-medium">
                  {failed} {failed === 1 ? "event" : "events"} failed
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
