/**
 * Event Exists Expression Component (audience-only)
 *
 * Matches customers who triggered an event type at least once, optionally
 * within a rolling window of days.
 */

import { memo, useId, type ReactNode } from "react";
import { EventTypeField } from "../../forms/event-type-field/index.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";

import type { EventExistsExpression, ExpressionComponentProps } from "../types";

type EventExistsData = EventExistsExpression["eventExists"];

export const EventExistsExpressionComponent = memo(function EventExistsExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<EventExistsData>): ReactNode {
  const fieldId = useId();
  const windowDaysId = useId();

  if (mode === "display") {
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          {value.eventTypeCode || "(event)"} occurred
          {value.windowDays != null ? ` in ${value.windowDays}d` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={fieldId} className="mb-1.5 block text-xs">
            Event Type
          </Label>
          <EventTypeField
            id={fieldId}
            value={value.eventTypeCode ?? ""}
            onValueChange={(eventTypeCode) => onChange({ ...value, eventTypeCode })}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={windowDaysId} className="mb-1.5 block text-xs">
            Window (days, optional)
          </Label>
          <Input
            id={windowDaysId}
            type="number"
            value={value.windowDays ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                windowDays: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="All time"
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
});
