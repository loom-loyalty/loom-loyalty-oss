/**
 * ContactPhoneList — Displays a list of customer phone numbers
 *
 * Shows phone entries with primary badge, type label, and status.
 * Supports add/edit/delete actions when editing is enabled.
 */

"use client";

import { Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

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
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { ContactPhone } from "./types.js";

export interface ContactPhoneListProps {
  /** List of phone numbers to display */
  phones: ContactPhone[];
  /** Handler for adding a new phone number */
  onAdd?: () => void;
  /** Handler for editing a phone number */
  onEdit?: (phone: ContactPhone) => void;
  /** Handler for deleting a phone number */
  onDelete?: (phoneId: string) => void;
  /** Whether editing actions are enabled */
  canEdit?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
}

/**
 * Renders a list of customer phone numbers with status indicators and actions.
 */
export function ContactPhoneList({
  phones,
  onAdd,
  onEdit,
  onDelete,
  canEdit = false,
  isLoading = false,
}: ContactPhoneListProps): ReactNode {
  const [deleteTarget, setDeleteTarget] = useState<ContactPhone | null>(null);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget && onDelete) {
      onDelete(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  if (isLoading) {
    return (
      <section aria-label="Phone numbers" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Phone Numbers</h4>
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
      <section aria-label="Phone numbers" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Phone Numbers</h4>
          {canEdit && onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              aria-label="Add phone number"
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          )}
        </div>

        {phones.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No phone numbers"
            description="No phone numbers have been added yet."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2" role="list">
            {phones.map((phone) => (
              <li
                key={phone.id}
                className="bg-background border-border flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Phone
                    className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-foreground min-w-0 text-sm">
                    <MaskedField reason="phone number">
                      {phone.number}
                      {phone.extension && ` ext. ${phone.extension}`}
                    </MaskedField>
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {phone.typeName && (
                    <Badge variant="outline" className="text-xs">
                      {phone.typeName}
                    </Badge>
                  )}
                  {phone.primary && (
                    <Badge
                      variant="success"
                      className="text-xs"
                      role="status"
                      aria-label={`${phone.number} is the primary phone`}
                    >
                      Primary
                    </Badge>
                  )}
                  <StatusBadge status={phone.status} />
                  {canEdit && (
                    <div className="ml-1 flex items-center gap-0.5">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(phone)}
                          aria-label={`Edit ${phone.number}`}
                          className="h-7 min-h-11 w-7 min-w-11 p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(phone)}
                          aria-label={`Delete ${phone.number}`}
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
            <AlertDialogTitle>Delete Phone Number</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {deleteTarget?.number ? `"${deleteTarget.number}"` : "this phone number"}? This action
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
