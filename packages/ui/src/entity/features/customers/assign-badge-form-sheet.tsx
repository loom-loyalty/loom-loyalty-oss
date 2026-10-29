/**
 * AssignBadgeFormSheet — Create/edit badge assignment form sheet
 *
 * Uses the FormSheet pattern for awarding a badge to a customer
 * or editing an existing badge. Fields: badge selector (create only),
 * start/end datetime.
 * Auto-generates eventId (UUID) and eventDateTime (now).
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import type { CustomerBadgeEntry } from "./types.js";
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

export interface AssignBadgeFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new badge assignment or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<CustomerBadgeEntry>;
  /** Form submit handler */
  onSubmit: (data: {
    badgeId?: string;
    badgeCode?: string;
    eventId: string;
    eventDateTime: string;
    startDateTime?: string;
    endDateTime?: string;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /**
   * Render a custom badge selector.
   * In create mode, this allows the consumer to inject a BadgeField or similar.
   */
  renderBadgeSelector?: (
    value: string,
    onValueChange: (badgeId: string) => void,
    disabled: boolean,
    /** HTML id for label association — set this on the selector element */
    id: string
  ) => ReactNode;
}

/**
 * Sheet form for awarding a badge to a customer or editing an existing badge.
 */
export function AssignBadgeFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  renderBadgeSelector,
}: AssignBadgeFormSheetProps): ReactNode {
  const [badgeId, setBadgeId] = useState(initialData?.badgeId ?? "");
  const [badgeCode, setBadgeCode] = useState(initialData?.badgeCode ?? "");
  const [startDateTime, setStartDateTime] = useState(
    initialData?.startDateTime
      ? toLocalDateTimeString(new Date(initialData.startDateTime))
      : toLocalDateTimeString(new Date())
  );
  const [endDateTime, setEndDateTime] = useState(
    initialData?.endDateTime ? toLocalDateTimeString(new Date(initialData.endDateTime)) : ""
  );

  const resetForm = () => {
    setBadgeId(initialData?.badgeId ?? "");
    setBadgeCode(initialData?.badgeCode ?? "");
    setStartDateTime(
      initialData?.startDateTime
        ? toLocalDateTimeString(new Date(initialData.startDateTime))
        : toLocalDateTimeString(new Date())
    );
    setEndDateTime(
      initialData?.endDateTime ? toLocalDateTimeString(new Date(initialData.endDateTime)) : ""
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit({
      badgeId: badgeId || undefined,
      badgeCode: badgeCode || undefined,
      eventId: generateEventId(),
      eventDateTime: new Date().toISOString(),
      startDateTime: startDateTime ? new Date(startDateTime).toISOString() : undefined,
      endDateTime: endDateTime ? new Date(endDateTime).toISOString() : undefined,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Award Badge" : "Edit Badge";
  const submitLabel = mode === "create" ? "Award" : "Save Changes";

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
        {/* Badge Selector (create mode only) */}
        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="badge-selector">
              Badge <span className="text-destructive">*</span>
            </Label>
            {renderBadgeSelector ? (
              renderBadgeSelector(badgeId, setBadgeId, isSubmitting, "badge-selector")
            ) : (
              <WithFieldError field="badgeCode">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="badge-selector"
                    value={badgeCode}
                    onChange={(e) => setBadgeCode(e.target.value)}
                    placeholder="Enter badge code (e.g., VIP_BADGE)"
                    required
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            )}
          </div>
        )}

        {/* Edit mode: Show badge info (read-only) */}
        {mode === "edit" && initialData?.badgeName && (
          <div className="space-y-2">
            <Label>Badge</Label>
            <p className="text-foreground text-sm font-medium">{initialData.badgeName}</p>
            <p className="text-muted-foreground font-mono text-xs">{initialData.badgeCode}</p>
          </div>
        )}

        {/* Start DateTime */}
        <div className="space-y-2">
          <Label htmlFor="badge-start-datetime">Start Date</Label>
          <WithFieldError field="dateTimePeriod.startDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="badge-start-datetime"
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
          <Label htmlFor="badge-end-datetime">End Date</Label>
          <WithFieldError field="dateTimePeriod.endDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="badge-end-datetime"
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">Leave empty for no expiration.</p>
        </div>
      </div>
    </FormSheet>
  );
}
