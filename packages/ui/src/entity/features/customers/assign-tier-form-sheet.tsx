/**
 * AssignTierFormSheet — Create/edit tier assignment form sheet
 *
 * Uses the FormSheet pattern for assigning a tier to a customer
 * or editing an existing tier assignment. Fields: tier selector (create only),
 * start/end datetime, lifetime toggle, trial toggle.
 * Auto-generates eventId (UUID) and eventDateTime (now).
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { Switch } from "../../../primitives/switch.js";
import type { CustomerTierEntry } from "./types.js";
import { generateEventId } from "./types.js";

/** Format a Date as YYYY-MM-DDTHH:mm in local timezone for datetime-local inputs */
function toLocalDateTimeString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

export interface AssignTierFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new assignment or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<CustomerTierEntry>;
  /** Form submit handler */
  onSubmit: (data: {
    tierId?: string;
    tierCode?: string;
    eventId: string;
    eventDateTime: string;
    startDateTime?: string;
    endDateTime?: string;
    issueLifetimeTier?: boolean;
    issueTrialTier?: boolean;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /**
   * Render a custom tier selector.
   * In create mode, this allows the consumer to inject a TierField or similar.
   */
  renderTierSelector?: (
    value: string,
    onValueChange: (tierId: string) => void,
    disabled: boolean,
    /** HTML id for label association — set this on the selector element */
    id: string
  ) => ReactNode;
}

/**
 * Sheet form for assigning a tier to a customer or editing an existing assignment.
 */
export function AssignTierFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  renderTierSelector,
}: AssignTierFormSheetProps): ReactNode {
  const [tierId, setTierId] = useState(initialData?.tierId ?? "");
  const [tierCode, setTierCode] = useState(initialData?.tierCode ?? "");
  const [startDateTime, setStartDateTime] = useState(
    initialData?.startDateTime
      ? toLocalDateTimeString(new Date(initialData.startDateTime))
      : toLocalDateTimeString(new Date())
  );
  const [endDateTime, setEndDateTime] = useState(
    initialData?.endDateTime ? toLocalDateTimeString(new Date(initialData.endDateTime)) : ""
  );
  const [isLifetime, setIsLifetime] = useState(initialData?.lifetimeTier ?? false);
  const [isTrial, setIsTrial] = useState(initialData?.trialTier ?? false);

  const resetForm = () => {
    setTierId(initialData?.tierId ?? "");
    setTierCode(initialData?.tierCode ?? "");
    setStartDateTime(
      initialData?.startDateTime
        ? toLocalDateTimeString(new Date(initialData.startDateTime))
        : toLocalDateTimeString(new Date())
    );
    setEndDateTime(
      initialData?.endDateTime ? toLocalDateTimeString(new Date(initialData.endDateTime)) : ""
    );
    setIsLifetime(initialData?.lifetimeTier ?? false);
    setIsTrial(initialData?.trialTier ?? false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit({
      tierId: tierId || undefined,
      tierCode: tierCode || undefined,
      eventId: generateEventId(),
      eventDateTime: new Date().toISOString(),
      startDateTime: startDateTime ? new Date(startDateTime).toISOString() : undefined,
      endDateTime: endDateTime ? new Date(endDateTime).toISOString() : undefined,
      issueLifetimeTier: isLifetime || undefined,
      issueTrialTier: isTrial || undefined,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Assign Tier" : "Edit Tier Assignment";
  const submitLabel = mode === "create" ? "Assign" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Tier Selector (create mode only) */}
        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="tier-selector">
              Tier <span className="text-destructive">*</span>
            </Label>
            {renderTierSelector ? (
              renderTierSelector(tierId, setTierId, isSubmitting, "tier-selector")
            ) : (
              <WithFieldError field="tierCode">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="tier-selector"
                    value={tierCode}
                    onChange={(e) => setTierCode(e.target.value)}
                    placeholder="Enter tier code (e.g., GOLD)"
                    required
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            )}
          </div>
        )}

        {/* Edit mode: Show tier info (read-only) */}
        {mode === "edit" && initialData?.tierName && (
          <div className="space-y-2">
            <Label>Tier</Label>
            <p className="text-foreground text-sm font-medium">{initialData.tierName}</p>
            <p className="text-muted-foreground font-mono text-xs">{initialData.tierCode}</p>
          </div>
        )}

        {/* Start DateTime */}
        <div className="space-y-2">
          <Label htmlFor="tier-start-datetime">Start Date</Label>
          <WithFieldError field="dateTimePeriod.startDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="tier-start-datetime"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* End DateTime */}
        <div className="space-y-2">
          <Label htmlFor="tier-end-datetime">End Date</Label>
          <WithFieldError field="dateTimePeriod.endDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="tier-end-datetime"
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                disabled={isSubmitting || isLifetime}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Leave empty for no expiration. Disabled when lifetime is enabled.
          </p>
        </div>

        {/* Lifetime Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="tier-lifetime" className="text-sm font-medium">
              Lifetime tier
            </Label>
            <p className="text-muted-foreground text-xs">
              Assign as a lifetime tier that never expires
            </p>
          </div>
          <Switch
            id="tier-lifetime"
            checked={isLifetime}
            onCheckedChange={(checked) => {
              setIsLifetime(checked);
              if (checked) {
                setIsTrial(false);
                setEndDateTime("");
              }
            }}
            disabled={isSubmitting}
          />
        </div>

        {/* Trial Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="tier-trial" className="text-sm font-medium">
              Trial tier
            </Label>
            <p className="text-muted-foreground text-xs">Assign as a temporary trial tier</p>
          </div>
          <Switch
            id="tier-trial"
            checked={isTrial}
            onCheckedChange={(checked) => {
              setIsTrial(checked);
              if (checked) setIsLifetime(false);
            }}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </FormSheet>
  );
}
