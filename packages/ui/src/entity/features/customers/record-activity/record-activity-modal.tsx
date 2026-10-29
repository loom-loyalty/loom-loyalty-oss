/**
 * RecordActivityModal: lets a care agent record something the platform missed.
 *
 * Opens from the customer's existing actions menu, so the customer is already
 * established and is not re-selected. Two columns: the work on the left
 * (describe, choose, date, details), the check panel and confirmation on the
 * right.
 *
 * Presentational only. The activity list, the details form, and the submission
 * all live in the consuming app. This component owns layout, copy, and the
 * empty-registry state.
 *
 * Operator-facing copy names activities and their consequences in customer-care
 * language. The dotted activity code travels on the request and never appears
 * here.
 */

"use client";

import type { FormEvent, ReactNode } from "react";

import type { FormFieldError } from "../../../../forms/field-errors.js";
import { FormErrorBanner } from "../../../../forms/form-error-banner.js";
import type { FormSheetError } from "../../../../forms/form-sheet.js";
import { Button } from "../../../../primitives/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../primitives/dialog.js";
import { Input } from "../../../../primitives/input.js";
import { Label } from "../../../../primitives/label.js";
import { Separator } from "../../../../primitives/separator.js";
import { ActivityPicker } from "./activity-picker.js";
import { RecordActivityCheckPanel } from "./record-activity-check-panel.js";
import type {
  ActivityDetailValue,
  CareActivityOption,
  EarlierRecordWarning,
  RecordedActivityAction,
} from "./types.js";

export interface RecordActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer this activity is recorded for. Displayed, never re-selected. */
  customerName: string;
  /** Activities offered on the customer-care surface. */
  activities: CareActivityOption[];
  /** True while the offered list is still being fetched. */
  activitiesLoading?: boolean;
  /**
   * The offered list could not be read. Distinct from an empty registry:
   * "nothing is configured" and "we could not find out" are different facts,
   * and telling an agent the first when the second is true sends them to an
   * administrator who has nothing to fix.
   */
  activitiesError?: boolean;
  /** Retry the offered-list read. */
  onRetryActivities?: () => void;
  selectedActivityCode: string | null;
  onSelectActivity: (code: string) => void;
  /** A proposed activity from the agent's description. Never auto-applied. */
  suggestedActivityCode?: string | null;
  /**
   * When the activity happened, as a `datetime-local` value
   * (`yyyy-MM-ddTHH:mm`).
   *
   * Date AND time, not date alone: an event carries an `eventDateTime`, and a
   * date-only control forces the app to invent a time, which silently
   * backdates the activity and can drop it below the start of the very rules it
   * should trigger.
   */
  date: string;
  onDateChange: (date: string) => void;
  /** The date and time as the check panel should read them. */
  dateLabel: string;
  /** Details as the check panel restates them. */
  details: ActivityDetailValue[];
  /** An earlier comparable record on the same date, when one exists. */
  earlierRecord?: EarlierRecordWarning | null;
  /** The plain-language description box (supplied by the app). */
  descriptionSlot?: ReactNode;
  /** The activity's generated details form (supplied by the app). */
  detailsSlot?: ReactNode;
  /** The active environment, named in the confirmation region. */
  environmentName: string;
  onApply: () => void | Promise<void>;
  isApplying?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; the modal has no per-field slots, so they show with `error` */
  fieldErrors?: readonly FormFieldError[];
  /**
   * What the engine actually did. Present after a successful apply; the surface
   * shows these rather than a generic confirmation.
   */
  resultActions?: RecordedActivityAction[] | null;
  /** True once applied, even when the engine produced no actions. */
  applied?: boolean;
  /**
   * The engine accepted the activity but has not finished processing it, so no
   * actions are available YET. Distinct from "produced no changes": an activity
   * whose event type is not configured for synchronous processing always comes
   * back this way, and telling an agent nothing happened would have them tell
   * the customer the same while the rewards are still landing.
   */
  resultPending?: boolean;
  /** Who to contact when nothing is configured. */
  administratorHint?: string;
}

const DEFAULT_ADMINISTRATOR_HINT =
  "Your organization administrator can choose which activities appear here.";

export function RecordActivityModal({
  open,
  onOpenChange,
  customerName,
  activities,
  activitiesLoading = false,
  activitiesError = false,
  onRetryActivities,
  selectedActivityCode,
  onSelectActivity,
  suggestedActivityCode,
  date,
  onDateChange,
  dateLabel,
  details,
  earlierRecord,
  descriptionSlot,
  detailsSlot,
  environmentName,
  onApply,
  isApplying = false,
  error,
  fieldErrors,
  resultActions,
  applied = false,
  resultPending = false,
  administratorHint = DEFAULT_ADMINISTRATOR_HINT,
}: RecordActivityModalProps): ReactNode {
  const selectedActivity = activities.find((a) => a.code === selectedActivityCode);
  const hasActivities = activities.length > 0;
  const showErrorState = !activitiesLoading && activitiesError && !hasActivities;
  /**
   * The agent cleared the date. Apply is blocked on it as well as on the
   * activity, because every downstream consequence of an empty date is silent:
   * the record would be stamped at submission time, the duplicate check would
   * short-circuit, and the check panel would simply show nothing.
   */
  const dateMissing = date.trim() === "";
  const showEmptyState = !activitiesLoading && !activitiesError && !hasActivities;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void onApply();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-w-5xl, not 4xl: at 896px the two columns land at 411px each, which
          reads dense once the details form is populated. 1024px gives each
          column ~471px without leaving the check panel looking sparse. */}
      <DialogContent className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Record activity</DialogTitle>
          <DialogDescription>
            Record something that happened but never reached {customerName}&rsquo;s account, so
            their rewards and progress catch up.
          </DialogDescription>
        </DialogHeader>

        {showErrorState ? (
          <div className="border-border bg-muted/40 rounded-lg border p-6 text-center">
            <p role="alert" className="text-foreground text-sm font-medium">
              The list of activities could not be loaded.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              This is not the same as nothing being set up. Try again, and tell an administrator if
              it keeps happening.
            </p>
            {onRetryActivities && (
              <Button
                type="button"
                variant="outline"
                onClick={onRetryActivities}
                className="mt-3 min-h-11"
              >
                Try again
              </Button>
            )}
          </div>
        ) : showEmptyState ? (
          // Not an error and not an empty control, but an explanation. "Nothing
          // configured" and "broken" look identical otherwise.
          <div className="border-border bg-muted/40 rounded-lg border p-6 text-center">
            <p className="text-foreground text-sm font-medium">
              No activities are set up for recording yet.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">{administratorHint}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
            {/* ── Describe what happened ────────────────────────────────────
                Spans both columns: it is the entry point to the whole surface,
                and prose needs the width more than any single control does.
                Guarded rather than rendered bare: as a grid child an absent
                slot would still occupy a cell and leave a gap-6 band behind. */}
            {descriptionSlot && <div className="md:col-span-2">{descriptionSlot}</div>}

            {/* ── Work column ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Customer</span>
                {/* Established by the page that opened this, not a control. */}
                <p className="text-foreground text-sm font-medium">{customerName}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="record-activity-picker">What happened</Label>
                <ActivityPicker
                  id="record-activity-picker"
                  activities={activities}
                  selectedCode={selectedActivityCode}
                  onSelect={onSelectActivity}
                  suggestedCode={suggestedActivityCode}
                  loading={activitiesLoading}
                  label="What happened"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="record-activity-date">When it happened</Label>
                <Input
                  id="record-activity-date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                  // A cleared date is never a valid record. Without this it
                  // degrades in three silent ways at once: the activity is
                  // stamped at the submission moment, the duplicate-record
                  // check short-circuits so its warning never appears, and the
                  // check panel's "When" row renders blank.
                  required
                  aria-describedby={dateMissing ? "record-activity-date-error" : undefined}
                  aria-invalid={dateMissing || undefined}
                  className="min-h-11"
                />
                {dateMissing && (
                  <p
                    id="record-activity-date-error"
                    role="alert"
                    className="text-destructive text-xs"
                  >
                    Enter when this happened before applying.
                  </p>
                )}
              </div>

              {selectedActivity && detailsSlot && (
                <>
                  <Separator />
                  {detailsSlot}
                </>
              )}

              <FormErrorBanner error={error} fieldErrors={fieldErrors} />
            </div>

            {/* ── Check and confirm column ──────────────────────────────── */}
            <div className="border-border bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
              <RecordActivityCheckPanel
                activityName={selectedActivity?.name ?? null}
                customerName={customerName}
                date={dateLabel}
                details={details}
                earlierRecord={earlierRecord}
              />

              {applied ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-foreground text-sm font-semibold">What this changed</h4>
                  {resultActions && resultActions.length > 0 ? (
                    // Stable hook for the e2e helper, which reads these back as
                    // the engine's own output. Without it, scoping by `li` would
                    // also pick up the description box's assumptions list.
                    <ul data-testid="record-activity-result" className="flex flex-col gap-2">
                      {resultActions.map((action, index) => (
                        <li
                          key={`${action.summary}-${String(index)}`}
                          className="border-success/30 bg-success/10 rounded-md border p-2"
                        >
                          <p className="text-foreground text-sm">{action.summary}</p>
                          {action.detail && (
                            <p className="text-muted-foreground text-xs">{action.detail}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : resultPending ? (
                    <p role="status" className="text-muted-foreground text-sm">
                      Recorded. This activity is still being processed, so any rewards or tier
                      changes will appear on this customer&rsquo;s account shortly.
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Recorded. Nothing changed on this customer&rsquo;s account as a result.
                    </p>
                  )}
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <Separator />
                  <div className="flex flex-col gap-3">
                    <p className="text-muted-foreground text-xs">
                      This applies to{" "}
                      <span className="text-foreground font-medium">{environmentName}</span> right
                      away. Rewards and tiers update immediately. Undoing this later may not reverse
                      everything.
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="min-h-11"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!selectedActivityCode || dateMissing || isApplying}
                        className="min-h-11"
                      >
                        {isApplying ? "Applying…" : "Apply"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
