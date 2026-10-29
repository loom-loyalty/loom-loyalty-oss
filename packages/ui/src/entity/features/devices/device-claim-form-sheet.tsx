/**
 * DeviceClaimFormSheet — Claim a self-registered TRMNL device to a Location
 *
 * Uses the FormSheet pattern to claim a device via its confirmation code.
 * Fields: location selector, confirmation code. When onCreateLocation is
 * provided, the location dropdown offers "Add New Location", which opens the
 * metadata create sheet limited to Location types and selects the result.
 */

"use client";

import type { CreateLocation, MetadataTypeCategory } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { LocationField, useLocationField } from "../../../forms/location-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { MetadataFormSheet } from "../metadata/metadata-form-sheet.js";
import type { MetadataSubmitData } from "../metadata/types.js";

/** The Location a create call produced, enough to select it and claim with it. */
export interface CreatedLocation {
  locationId: string;
  code: string;
}

export interface DeviceClaimFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Form submit handler */
  onSubmit: (data: { locationCode: string; confirmationCode: string }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /**
   * Creates a Location from the claim form. When provided, the location
   * dropdown offers "Add New Location"; the created Location is selected.
   * Reject with an Error to show its message on the create sheet.
   */
  onCreateLocation?: (data: CreateLocation) => Promise<CreatedLocation>;
}

/**
 * Sheet form for claiming a self-registered device to a Location.
 */
export function DeviceClaimFormSheet({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  onCreateLocation,
}: DeviceClaimFormSheetProps): ReactNode {
  const [locationId, setLocationId] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  // Remembered so a just-created Location can be claimed before the location
  // list has refetched and findLocation can see it.
  const [createdLocation, setCreatedLocation] = useState<CreatedLocation | null>(null);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [createLocationError, setCreateLocationError] = useState<string | null>(null);
  const { findLocation } = useLocationField();

  const resetForm = () => {
    setLocationId("");
    setConfirmationCode("");
    setCreatedLocation(null);
    setCreateLocationError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const locationCode =
    findLocation(locationId)?.code ??
    (createdLocation?.locationId === locationId ? createdLocation.code : undefined);

  const handleCreateLocation = async (
    data: MetadataSubmitData,
    category: MetadataTypeCategory,
    closeCreateSheet: () => void
  ) => {
    if (!onCreateLocation) return;
    // The type picker only offers Location types; anything else would be sent
    // to the wrong endpoint.
    if (category !== "LOCATION") {
      setCreateLocationError("Choose a Location type.");
      return;
    }
    setCreateLocationError(null);
    setIsCreatingLocation(true);
    try {
      const created = await onCreateLocation(data as CreateLocation);
      setCreatedLocation(created);
      setLocationId(created.locationId);
      closeCreateSheet();
    } catch (err) {
      setCreateLocationError(err instanceof Error ? err.message : "Failed to create location.");
    } finally {
      setIsCreatingLocation(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!locationCode) return;
    await onSubmit({ locationCode, confirmationCode });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Claim Device"
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitDisabled={!locationCode || !confirmationCode}
      submitLabel="Claim"
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="device-claim-location">
            Location <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="locationCode" value={locationId}>
            {(fe) => (
              <LocationField
                {...fe.inputProps}
                id="device-claim-location"
                value={locationId}
                onValueChange={setLocationId}
                placeholder="Select a location..."
                disabled={isSubmitting}
                aria-required
                renderCreateSheet={
                  onCreateLocation
                    ? (createOpen, onCreateOpenChange) => (
                        <MetadataFormSheet
                          open={createOpen}
                          onOpenChange={(next) => {
                            if (!next) setCreateLocationError(null);
                            onCreateOpenChange(next);
                          }}
                          mode="create"
                          entityLabel="Location"
                          typeCategory="LOCATION"
                          onSubmit={(data, category) =>
                            handleCreateLocation(data, category, () => onCreateOpenChange(false))
                          }
                          isSubmitting={isCreatingLocation}
                          error={createLocationError}
                        />
                      )
                    : undefined
                }
              />
            )}
          </WithFieldError>
        </div>

        <div className="space-y-2">
          <Label htmlFor="device-claim-confirmation-code">
            Confirmation Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="confirmationCode">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="device-claim-confirmation-code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="Enter the code shown on the device"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>
      </div>
    </FormSheet>
  );
}
