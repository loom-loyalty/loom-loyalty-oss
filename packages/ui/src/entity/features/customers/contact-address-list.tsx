/**
 * ContactAddressList — Displays a list of customer addresses
 *
 * Card-based layout for addresses (not a table, since addresses are multi-line).
 * Each card shows formatted address, type badge, and primary badge.
 * Supports add/edit/delete actions when editing is enabled.
 */

"use client";

import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { EmptyState } from "../../../data-display/empty-state.js";
import { PostalAddressDisplay } from "../../../data-display/postal-address-display.js";
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
import { Card, CardContent } from "../../../primitives/card.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { ContactAddress } from "./types.js";

export interface ContactAddressListProps {
  /** List of addresses to display */
  addresses: ContactAddress[];
  /** Handler for adding a new address */
  onAdd?: () => void;
  /** Handler for editing an address */
  onEdit?: (address: ContactAddress) => void;
  /** Handler for deleting an address */
  onDelete?: (addressId: string) => void;
  /** Whether editing actions are enabled */
  canEdit?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
}

/**
 * Renders a card-based list of customer addresses with actions.
 */
export function ContactAddressList({
  addresses,
  onAdd,
  onEdit,
  onDelete,
  canEdit = false,
  isLoading = false,
}: ContactAddressListProps): ReactNode {
  const [deleteTarget, setDeleteTarget] = useState<ContactAddress | null>(null);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget && onDelete) {
      onDelete(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  if (isLoading) {
    return (
      <section aria-label="Addresses" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Addresses</h4>
        </div>
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section aria-label="Addresses" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Addresses</h4>
          {canEdit && onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              aria-label="Add address"
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          )}
        </div>

        {addresses.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No addresses"
            description="No addresses have been added yet."
            className="py-6"
          />
        ) : (
          <ul className="space-y-3" role="list">
            {addresses.map((address) => (
              <li key={address.id}>
                <Card className="shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <MapPin
                          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <MaskedField reason="postal address">
                            <PostalAddressDisplay
                              address={{
                                addressLine1: address.addressLine1,
                                addressLine2: address.addressLine2,
                                city: address.cityLocality,
                                stateProvince: address.stateProvinceRegion,
                                postalCode: address.postalCode,
                                countryCode: address.countryCode,
                              }}
                            />
                          </MaskedField>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {address.typeName && (
                              <Badge variant="outline" className="text-xs">
                                {address.typeName}
                              </Badge>
                            )}
                            {address.primary && (
                              <Badge
                                variant="success"
                                className="text-xs"
                                role="status"
                                aria-label={`${address.typeName ?? "This"} address is the primary address`}
                              >
                                Primary
                              </Badge>
                            )}
                            <StatusBadge status={address.status} />
                          </div>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(address)}
                              aria-label={`Edit ${address.typeName ?? ""} address`}
                              className="h-7 min-h-11 w-7 min-w-11 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(address)}
                              aria-label={`Delete ${address.typeName ?? ""} address`}
                              className="text-destructive hover:text-destructive h-7 min-h-11 w-7 min-w-11 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {deleteTarget?.typeName
                ? `the ${deleteTarget.typeName.toLowerCase()} address`
                : "this address"}
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
