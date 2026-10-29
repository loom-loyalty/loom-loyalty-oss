/**
 * AudienceMembershipList — Displays customer audience/segment memberships
 *
 * Shows segment entries with name, type badge (Dynamic/Static), member count, and code.
 * Supports add/remove actions when editing is enabled.
 * Uses "Remove" action (not "Delete") with confirmation dialog.
 */

"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { EmptyState } from "../../../data-display/empty-state.js";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../primitives/alert-dialog.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { CustomerSegment } from "./types.js";

export interface AudienceMembershipListProps {
  /** List of segments/audiences to display */
  segments: CustomerSegment[];
  /** Handler for adding customer to an audience */
  onAdd?: () => void;
  /** Handler for removing customer from an audience */
  onRemove?: (segmentId: string) => void;
  /** Whether editing actions are enabled */
  canEdit?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
}

/**
 * Renders a list of customer audience memberships with actions.
 */
export function AudienceMembershipList({
  segments,
  onAdd,
  onRemove,
  canEdit = false,
  isLoading = false,
}: AudienceMembershipListProps): ReactNode {
  const [removeTarget, setRemoveTarget] = useState<CustomerSegment | null>(null);

  const handleConfirmRemove = useCallback(() => {
    if (removeTarget && onRemove) {
      onRemove(removeTarget.segmentId);
    }
    setRemoveTarget(null);
  }, [removeTarget, onRemove]);

  if (isLoading) {
    return (
      <section aria-label="Audience memberships" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Audiences</h4>
        </div>
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section aria-label="Audience memberships" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Audiences</h4>
          {canEdit && onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              aria-label="Add to audience"
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          )}
        </div>

        {segments.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No audience memberships"
            description="This customer is not part of any audiences."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2" role="list">
            {segments.map((segment) => (
              <li
                key={segment.segmentId}
                className="bg-background border-border flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium">{segment.segmentName}</p>
                  <p className="text-muted-foreground text-xs">
                    {segment.segmentType === "DYNAMIC" ? "Dynamic" : "Static"} &middot;{" "}
                    {(segment.memberCount ?? 0).toLocaleString()} members
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge
                    variant={segment.segmentType === "DYNAMIC" ? "info" : "outline"}
                    className="text-xs"
                  >
                    {segment.segmentCode}
                  </Badge>
                  {canEdit && onRemove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoveTarget(segment)}
                      aria-label={`Remove from ${segment.segmentName}`}
                      className="text-destructive hover:text-destructive ml-1 h-7 min-h-11 w-7 min-w-11 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Audience</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this customer from{" "}
              {removeTarget?.segmentName ? `"${removeTarget.segmentName}"` : "this audience"}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmRemove}>
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
