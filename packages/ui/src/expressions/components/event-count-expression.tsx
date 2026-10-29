/**
 * Event Count Expression Component (audience-only)
 *
 * Matches customers who triggered an event type at least N times, optionally
 * within a rolling window of days.
 */

import { memo, useId, type ReactNode } from "react";
import { EventTypeField } from "../../forms/event-type-field/index.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";

import type { EventCountExpression, ExpressionComponentProps } from "../types";

type EventCountData = EventCountExpression["eventCount"];

export const EventCountExpressionComponent = memo(function EventCountExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<EventCountData>): ReactNode {
  const fieldId = useId();
  const minCountId = useId();
  const windowDaysId = useId();

  if (mode === "display") {
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          {value.eventTypeCode || "(event)"} occurred ≥ {value.minCount}
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
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor={minCountId} className="mb-1.5 block text-xs">
              Minimum Count
            </Label>
            <Input
              id={minCountId}
              type="number"
              value={value.minCount}
              onChange={(e) => onChange({ ...value, minCount: Number(e.target.value) })}
              disabled={disabled}
              className="text-xs"
            />
          </div>
          <div className="flex-1">
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
    </div>
  );
});
