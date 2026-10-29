/**
 * IdentifierList — Displays a list of customer identifiers
 *
 * Shows identifier entries with monospaced value, type name, status badge, and created date.
 * Supports add/edit/delete actions when editing is enabled.
 */

"use client";

import { Hash, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { formatShortDate } from "@loom-loyalty/core";
import { EmptyState } from "../../../data-display/empty-state.js";
import { StatusBadge } from "../../../data-display/status-badge.js";
import { MaskedField } from "../../../forms/masked-field.js";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../primitives/alert-dialog.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { CustomerIdentifier } from "./types.js";

export interface IdentifierListProps {
  /** List of identifiers to display */
  identifiers: CustomerIdentifier[];
  /** Handler for adding a new identifier */
  onAdd?: () => void;
  /** Handler for editing an identifier */
  onEdit?: (identifier: CustomerIdentifier) => void;
  /** Handler for deleting an identifier */
  onDelete?: (identifierId: string) => void;
  /** Whether editing actions are enabled */
  canEdit?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
}

/**
 * Renders a list of customer identifiers with status indicators and actions.
 */
export function IdentifierList({
  identifiers,
  onAdd,
  onEdit,
  onDelete,
  canEdit = false,
  isLoading = false,
}: IdentifierListProps): ReactNode {
  const [deleteTarget, setDeleteTarget] = useState<CustomerIdentifier | null>(null);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget && onDelete) {
      onDelete(deleteTarget.identifierId);
    }
    setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  if (isLoading) {
    return (
      <section aria-label="Identifiers" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Identifiers</h4>
        </div>
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section aria-label="Identifiers" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Identifiers</h4>
          {canEdit && onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              aria-label="Add identifier"
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          )}
        </div>

        {identifiers.length === 0 ? (
          <EmptyState
            icon={Hash}
            title="No identifiers"
            description="No identifiers have been added yet."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2" role="list">
            {identifiers.map((identifier) => (
              <li
                key={identifier.identifierId}
                className="bg-background border-border flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-foreground font-mono text-sm">
                    <MaskedField reason="identifier">{identifier.value}</MaskedField>
                  </p>
                  <p className="text-muted-foreground text-xs">{identifier.typeName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={identifier.status} />
                  <time
                    dateTime={identifier.createdDateTime}
                    className="text-muted-foreground text-xs"
                  >
                    {formatShortDate(identifier.createdDateTime)}
                  </time>
                  {canEdit && (
                    <div className="ml-1 flex items-center gap-0.5">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(identifier)}
                          aria-label={`Edit identifier ${identifier.value}`}
                          className="h-7 min-h-11 w-7 min-w-11 p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(identifier)}
                          aria-label={`Delete identifier ${identifier.value}`}
                          className="text-destructive hover:text-destructive h-7 min-h-11 w-7 min-w-11 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Identifier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {deleteTarget?.value ? `"${deleteTarget.value}"` : "this identifier"}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
