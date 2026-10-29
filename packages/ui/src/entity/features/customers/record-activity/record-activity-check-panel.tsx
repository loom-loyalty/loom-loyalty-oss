/**
 * RecordActivityCheckPanel: restates what will be recorded, in plain language.
 *
 * The panel restates; it does not predict. No dry run exists and reversal is
 * best-effort, so it echoes the activity, the customer, the date, and every
 * detail value, and never forecasts points, currency, or tiers. A wrong number
 * an agent repeats to a customer is worse than no number.
 *
 * Unset details are rendered explicitly rather than omitted, so an agent can see
 * what they have left blank before applying.
 */

"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { Separator } from "../../../../primitives/separator.js";
import type { ActivityDetailValue, EarlierRecordWarning } from "./types.js";

export interface RecordActivityCheckPanelProps {
  /** The selected activity's plain name, or null when nothing is selected yet. */
  activityName: string | null;
  /** The customer this is being recorded for. */
  customerName: string;
  /** The date and time, already formatted for display. */
  date: string;
  /** Every detail the form declares, set or not. */
  details: ActivityDetailValue[];
  /** An earlier comparable record, when one exists. Advisory only. */
  earlierRecord?: EarlierRecordWarning | null;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground text-sm break-words">{value}</dd>
    </div>
  );
}

export function RecordActivityCheckPanel({
  activityName,
  customerName,
  date,
  details,
  earlierRecord,
}: RecordActivityCheckPanelProps): ReactNode {
  return (
    <section aria-labelledby="record-activity-check-heading" className="flex flex-col gap-3">
      <h3
        id="record-activity-check-heading"
        className="text-foreground text-sm font-semibold tracking-tight"
      >
        Check before you apply
      </h3>

      {activityName ? (
        <>
          <dl className="divide-border divide-y">
            <Row label="Activity" value={activityName} />
            <Row label="Customer" value={customerName} />
            <Row label="When" value={date} />
          </dl>

          {details.length > 0 && (
            <>
              <Separator />
              <dl className="divide-border divide-y">
                {details.map((detail) => (
                  <Row
                    key={detail.name}
                    label={detail.label}
                    value={
                      detail.value === null || detail.value === "" ? (
                        <span className="text-muted-foreground italic">Not set</span>
                      ) : (
                        detail.value
                      )
                    }
                  />
                ))}
              </dl>
            </>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Choose an activity and this panel will show exactly what gets recorded.
        </p>
      )}

      {earlierRecord && (
        // Advisory, never blocking. The agent is better placed than we are to
        // judge whether a genuine repeat happened on the same day.
        <div
          role="status"
          className="border-warning/40 bg-warning/10 flex gap-2 rounded-lg border p-3"
        >
          <AlertTriangle aria-hidden="true" className="text-warning mt-0.5 size-4 shrink-0" />
          <p className="text-foreground text-xs">
            <span className="font-medium">{earlierRecord.activityName}</span> was already recorded
            for this customer on {earlierRecord.recordedOn}. You can still apply this one.
          </p>
        </div>
      )}
    </section>
  );
}
