/**
 * CorrectActivitySheet: fix a mistake in a recorded activity, in place.
 *
 * A separate surface rather than a reuse of RecordActivityModal: the modal is
 * create-oriented (choose an activity, start from empty, apply), while a
 * correction has a fixed activity, values already seeded, and a mandatory
 * reason. Threading a second mode through the modal's state would fight it.
 *
 * Correcting in place matters because reversal is best-effort. A
 * cancel-and-re-record cycle risks leaving a customer partly reversed, which is
 * worse than editing the record the engine already has.
 *
 * Copy here never promises complete reversal, on either control.
 */

"use client";

import { AlertTriangle } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../../forms/form-sheet.js";
import { Button } from "../../../../primitives/button.js";
import { Input } from "../../../../primitives/input.js";
import { Label } from "../../../../primitives/label.js";
import { Separator } from "../../../../primitives/separator.js";
import { Textarea } from "../../../../primitives/textarea.js";

/** One action's reversal outcome, as the engine reported it. */
export interface ReversalOutcome {
  /** Plain-language description of what was being reversed. */
  summary: string;
  /**
   * Whether the engine confirmed the reversal. `false` covers both a failed
   * reversal and one still in flight. Either way it is not confirmed, and the
   * agent must not be told it was.
   */
  reversed: boolean;
  /** Why it is not confirmed, when it is not. */
  detail?: string;
}

export interface CorrectActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The activity's plain name. Fixed: a correction cannot change it. */
  activityName: string;
  /**
   * When the record currently says it happened, as a `datetime-local` value
   * (`yyyy-MM-ddTHH:mm`). Date AND time, matching the record modal. A
   * correction that could only restate the calendar date would silently
   * overwrite the original time with an invented one.
   */
  date: string;
  onDateChange: (date: string) => void;
  /** The activity's details form, seeded with the current values. */
  detailsSlot?: ReactNode;
  onCorrect: (reason: string) => void | Promise<void>;
  onCancelActivity: (reason: string) => void | Promise<void>;
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /**
   * What the engine reported after a cancellation. Present once a cancellation
   * has been attempted.
   */
  reversalOutcomes?: ReversalOutcome[] | null;
}

const REASON_REQUIRED = "Give a reason. It is the audit trail for a manual change.";

export function CorrectActivitySheet({
  open,
  onOpenChange,
  activityName,
  date,
  onDateChange,
  detailsSlot,
  onCorrect,
  onCancelActivity,
  isSubmitting = false,
  error,
  fieldErrors,
  reversalOutcomes,
}: CorrectActivitySheetProps): ReactNode {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  /**
   * The record carries no usable date, or the agent cleared it. Saving would
   * otherwise stamp the correction moment onto the record, moving WHEN the
   * activity happened while the agent was only fixing a detail value.
   */
  const dateMissing = date.trim() === "";
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const requireReason = (): boolean => {
    if (reason.trim() === "") {
      setReasonError(REASON_REQUIRED);
      return false;
    }
    setReasonError(null);
    return true;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!requireReason()) return;
    void onCorrect(reason.trim());
  };

  const handleCancelActivity = () => {
    if (!requireReason()) return;
    void onCancelActivity(reason.trim());
  };

  // Once a cancellation has been attempted, the sheet reports what the engine
  // actually reversed rather than assuming it succeeded.
  if (reversalOutcomes) {
    const unconfirmed = reversalOutcomes.filter((outcome) => !outcome.reversed);
    return (
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={`${activityName} cancelled`}
        onSubmit={(e) => {
          e.preventDefault();
          onOpenChange(false);
        }}
        onCancel={() => onOpenChange(false)}
        submitLabel="Done"
        cancelLabel="Close"
      >
        <div className="flex flex-col gap-3">
          {reversalOutcomes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              The activity was cancelled. It had produced no changes to reverse.
            </p>
          ) : (
            <>
              <p className="text-foreground text-sm font-medium">What was reversed</p>
              <ul className="flex flex-col gap-2">
                {reversalOutcomes.map((outcome, index) => (
                  <li
                    key={`${outcome.summary}-${String(index)}`}
                    className={
                      outcome.reversed
                        ? "border-success/30 bg-success/10 rounded-md border p-2"
                        : "border-warning/40 bg-warning/10 rounded-md border p-2"
                    }
                  >
                    <p className="text-foreground text-sm">{outcome.summary}</p>
                    <p className="text-muted-foreground text-xs">
                      {outcome.reversed ? "Reversed" : (outcome.detail ?? "Not confirmed reversed")}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {unconfirmed.length > 0 && (
            <div
              role="status"
              className="border-warning/40 bg-warning/10 flex gap-2 rounded-lg border p-3"
            >
              <AlertTriangle aria-hidden="true" className="text-warning mt-0.5 size-4 shrink-0" />
              <p className="text-foreground text-xs">
                Not everything came back confirmed. Check this customer&rsquo;s balances and
                progress before telling them it is undone.
              </p>
            </div>
          )}
        </div>
      </FormSheet>
    );
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Correct ${activityName}`}
      description="Fix what was recorded. The rules run again on the corrected values."
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      isSubmitting={isSubmitting}
      submitLabel="Save correction"
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Activity</span>
          {/* Fixed: a correction fixes values, it does not change what happened. */}
          <p className="text-foreground text-sm font-medium">{activityName}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correct-activity-date">When it happened</Label>
          <WithFieldError field="eventDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="correct-activity-date"
                type="datetime-local"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                // A correction can never legitimately clear when it happened. An
                // empty value here would be filled in with the moment of the
                // correction, silently moving the record.
                required
                // Exposed programmatically, not just natively, and matching the
                // Reason field below and the record modal: `required` alone leaves a
                // screen-reader user with no indication of WHICH field is wrong when
                // a save is refused.
                aria-invalid={fe.error ? true : dateMissing || undefined}
                aria-describedby={
                  [
                    fe.inputProps["aria-describedby"],
                    dateMissing ? "correct-activity-date-error" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                className="min-h-11"
              />
            )}
          </WithFieldError>
          {dateMissing && (
            <p id="correct-activity-date-error" role="alert" className="text-destructive text-xs">
              Enter when this happened before saving.
            </p>
          )}
        </div>

        {detailsSlot}

        <Separator />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correct-activity-reason">
            Reason
            <span aria-hidden="true" className="text-destructive ml-0.5">
              *
            </span>
          </Label>
          <Textarea
            id="correct-activity-reason"
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
            aria-invalid={!!reasonError || undefined}
            aria-describedby={reasonError ? "correct-activity-reason-error" : undefined}
            placeholder="e.g. Customer confirmed the stay was two nights, not three"
          />
          {reasonError && (
            <p id="correct-activity-reason-error" role="alert" className="text-destructive text-xs">
              {reasonError}
            </p>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            If correcting is not enough, you can cancel this activity instead. Cancelling tries to
            undo what it produced, and may not reverse everything.
          </p>
          {confirmingCancel ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingCancel(false)}
                className="min-h-11"
              >
                Keep the activity
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancelActivity}
                disabled={isSubmitting}
                className="min-h-11"
              >
                Cancel this activity
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingCancel(true)}
              className="min-h-11 self-start"
            >
              Cancel this activity instead
            </Button>
          )}
        </div>
      </div>
    </FormSheet>
  );
}
