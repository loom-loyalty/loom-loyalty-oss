/**
 * AudienceMembershipFormSheet — Add customer to an audience
 *
 * Create-only sheet (no edit mode) — audiences are add/remove, not update.
 * At least one of audience ID or audience code must be provided.
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";

export interface AudienceMembershipFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Form submit handler */
  onSubmit: (data: { customerAudienceId?: string; customerAudienceCode?: string }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/**
 * Sheet form for adding a customer to an audience.
 */
export function AudienceMembershipFormSheet({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: AudienceMembershipFormSheetProps): ReactNode {
  const [audienceId, setAudienceId] = useState("");
  const [audienceCode, setAudienceCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setAudienceId("");
    setAudienceCode("");
    setValidationError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);

    if (!audienceId.trim() && !audienceCode.trim()) {
      setValidationError("At least one of Audience ID or Audience Code is required.");
      return;
    }

    await onSubmit({
      customerAudienceId: audienceId.trim() || undefined,
      customerAudienceCode: audienceCode.trim() || undefined,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Add to Audience"
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel="Add to Audience"
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Audience ID */}
        <div className="space-y-2">
          <Label htmlFor="audience-id">Audience ID</Label>
          <WithFieldError field="customerAudienceId">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="audience-id"
                type="text"
                value={audienceId}
                onChange={(e) => setAudienceId(e.target.value)}
                placeholder="e.g., aud_abc123"
                disabled={isSubmitting}
                aria-describedby={
                  fe.error
                    ? `${fe.errorId} audience-id-hint audience-constraint-hint`
                    : "audience-id-hint audience-constraint-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="audience-id-hint" className="text-muted-foreground text-xs">
            The unique ID of the audience to add this customer to.
          </p>
        </div>

        {/* Audience Code */}
        <div className="space-y-2">
          <Label htmlFor="audience-code">Audience Code</Label>
          <WithFieldError field="customerAudienceCode">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="audience-code"
                type="text"
                value={audienceCode}
                onChange={(e) => setAudienceCode(e.target.value)}
                placeholder="e.g., VIP_CUSTOMERS"
                disabled={isSubmitting}
                aria-describedby={
                  fe.error ? `${fe.errorId} audience-constraint-hint` : "audience-constraint-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="audience-constraint-hint" className="text-muted-foreground text-xs">
            The code of the audience. At least one of ID or Code is required.
          </p>
        </div>

        {validationError && (
          <div
            className="border-destructive/30 bg-destructive/5 rounded-lg border p-3"
            role="alert"
          >
            <p className="text-destructive text-xs">{validationError}</p>
          </div>
        )}
      </div>
    </FormSheet>
  );
}
