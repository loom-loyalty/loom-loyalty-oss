/**
 * Customer Tag List
 *
 * Displays auto-generated metadata tags assigned to a customer, grouped by
 * `metadataTypeCategory`. Each tag shows the metadata code label with an
 * interaction count badge. Hover/focus reveals a tooltip with recency score,
 * first/last interaction dates, and source event type. Tags are read-only
 * (auto-generated from events) but can be deleted.
 */

"use client";

import { formatShortDate } from "@loom-loyalty/core";
import { Tag, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { EmptyState } from "../../../data-display/empty-state";
import { cn } from "../../../lib/utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../primitives/alert-dialog";
import { Badge } from "../../../primitives/badge";
import { Button } from "../../../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../primitives/tooltip";
import type { CustomerTagEntry } from "./types";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface CustomerTagListProps {
  /** Tags to display, grouped by category */
  tags: CustomerTagEntry[];
  /** Callback to delete a tag */
  onDeleteTag?: (tag: CustomerTagEntry) => void;
  /** Additional className for the root element */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CustomerTagList({ tags, onDeleteTag, className }: CustomerTagListProps) {
  const [deleteTarget, setDeleteTarget] = useState<CustomerTagEntry | null>(null);

  // Group tags by metadataTypeCategory
  const grouped = useMemo(() => {
    const map = new Map<string, CustomerTagEntry[]>();
    for (const tag of tags) {
      const category = tag.metadataTypeCategory || "Uncategorized";
      const existing = map.get(category) ?? [];
      existing.push(tag);
      map.set(category, existing);
    }
    return map;
  }, [tags]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget && onDeleteTag) {
      onDeleteTag(deleteTarget);
    }
    setDeleteTarget(null);
  }, [deleteTarget, onDeleteTag]);

  if (tags.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="No Tags"
        description="No auto-generated tags found for this customer."
        className={cn("py-6", className)}
      />
    );
  }

  return (
    <>
      <div className={cn("space-y-4", className)}>
        {Array.from(grouped.entries()).map(([category, categoryTags]) => (
          <div key={category}>
            <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              {formatCategoryLabel(category)}
            </h4>
            <div
              className="flex flex-wrap gap-2"
              role="list"
              aria-label={`${formatCategoryLabel(category)} tags`}
            >
              {categoryTags.map((tag) => (
                <Tooltip key={tag.customerTagId}>
                  <TooltipTrigger asChild>
                    <div
                      role="listitem"
                      className={cn(
                        "bg-muted/50 border-border inline-flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-3",
                        "hover:bg-muted transition-colors",
                        "focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-1"
                      )}
                    >
                      <Tag className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="text-foreground text-sm font-medium">
                        {formatTagLabel(tag.metadataCode)}
                      </span>
                      <Badge
                        variant="outline"
                        className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-xs"
                        role="status"
                        aria-label={`${tag.interactionCount} interaction${tag.interactionCount !== 1 ? "s" : ""}`}
                      >
                        {tag.interactionCount}
                      </Badge>
                      {onDeleteTag && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-5 min-h-11 w-5 min-w-11 shrink-0 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(tag);
                          }}
                          aria-label={`Remove tag ${formatTagLabel(tag.metadataCode)}`}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-popover text-popover-foreground border-border max-w-xs border p-3 shadow-md"
                  >
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">{formatTagLabel(tag.metadataCode)}</p>
                      <div className="text-muted-foreground space-y-0.5 text-xs">
                        <p>
                          Type: <span className="text-foreground">{tag.metadataTypeCode}</span>
                        </p>
                        <p>
                          Recency Score:{" "}
                          <span className="text-foreground">{tag.recencyScore.toFixed(2)}</span>
                        </p>
                        {tag.firstInteractionDateTime && (
                          <p>
                            First Seen:{" "}
                            <time
                              dateTime={tag.firstInteractionDateTime}
                              className="text-foreground"
                            >
                              {formatShortDate(tag.firstInteractionDateTime)}
                            </time>
                          </p>
                        )}
                        {tag.lastInteractionDateTime && (
                          <p>
                            Last Seen:{" "}
                            <time
                              dateTime={tag.lastInteractionDateTime}
                              className="text-foreground"
                            >
                              {formatShortDate(tag.lastInteractionDateTime)}
                            </time>
                          </p>
                        )}
                        {tag.sourceEventType && (
                          <p>
                            Source: <span className="text-foreground">{tag.sourceEventType}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the tag &ldquo;
              {deleteTarget ? formatTagLabel(deleteTarget.metadataCode) : ""}
              &rdquo;? This tag was auto-generated from event data and will not be recreated unless
              new matching events occur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a SCREAMING_SNAKE or kebab-case category to Title Case. */
function formatCategoryLabel(category: string): string {
  return category
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert a snake_case or kebab-case metadata code to a readable label. */
function formatTagLabel(code: string): string {
  return code.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
