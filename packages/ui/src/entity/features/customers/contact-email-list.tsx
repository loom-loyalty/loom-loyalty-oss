/**
 * ContactEmailList — Displays a list of customer email addresses
 *
 * Shows email entries with primary badge, verified status, and type label.
 * Supports add/edit/delete actions when editing is enabled.
 */

"use client";

import { CheckCircle, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { EmptyState } from "../../../data-display/empty-state.js";
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
import type { ContactEmail } from "./types.js";

export interface ContactEmailListProps {
  /** List of email addresses to display */
  emails: ContactEmail[];
  /** Handler for adding a new email */
  onAdd?: () => void;
  /** Handler for editing an email */
  onEdit?: (email: ContactEmail) => void;
  /** Handler for deleting an email */
  onDelete?: (emailId: string) => void;
  /** Whether editing actions are enabled */
  canEdit?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
}

/**
 * Renders a list of customer email addresses with status indicators and actions.
 */
export function ContactEmailList({
  emails,
  onAdd,
  onEdit,
  onDelete,
  canEdit = false,
  isLoading = false,
}: ContactEmailListProps): ReactNode {
  const [deleteTarget, setDeleteTarget] = useState<ContactEmail | null>(null);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget && onDelete) {
      onDelete(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  if (isLoading) {
    return (
      <section aria-label="Email addresses" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Email Addresses</h4>
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
      <section aria-label="Email addresses" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Email Addresses</h4>
          {canEdit && onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              aria-label="Add email address"
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          )}
        </div>

        {emails.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No email addresses"
            description="No email addresses have been added yet."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2" role="list">
            {emails.map((email) => (
              <li
                key={email.id}
                className="bg-background border-border flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-foreground min-w-0 text-sm">
                    <MaskedField reason="email address">{email.emailAddress}</MaskedField>
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {email.typeName && (
                    <Badge variant="outline" className="text-xs">
                      {email.typeName}
                    </Badge>
                  )}
                  {email.primary && (
                    <Badge
                      variant="success"
                      className="text-xs"
                      role="status"
                      aria-label={`${email.emailAddress} is the primary email`}
                    >
                      Primary
                    </Badge>
                  )}
                  {email.verified ? (
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs"
                      role="status"
                      aria-label={`${email.emailAddress} is verified`}
                    >
                      <CheckCircle className="h-3 w-3" aria-hidden="true" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge
                      variant="warning"
                      className="text-xs"
                      role="status"
                      aria-label={`${email.emailAddress} is unverified`}
                    >
                      Unverified
                    </Badge>
                  )}
                  {canEdit && (
                    <div className="ml-1 flex items-center gap-0.5">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(email)}
                          aria-label={`Edit ${email.emailAddress}`}
                          className="h-7 min-h-11 w-7 min-w-11 p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(email)}
                          aria-label={`Delete ${email.emailAddress}`}
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
            <AlertDialogTitle>Delete Email Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {deleteTarget?.emailAddress ? `"${deleteTarget.emailAddress}"` : "this email address"}
              ? This action cannot be undone.
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
