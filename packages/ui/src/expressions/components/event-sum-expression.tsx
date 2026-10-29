/**
 * Event Sum Expression Component (audience-only)
 *
 * Matches customers whose summed numeric field across an event type reaches a
 * minimum, optionally within a rolling window of days.
 */

import { memo, useId, type ReactNode } from "react";
import { EventTypeField } from "../../forms/event-type-field/index.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";

import { JsonPathInput } from "../inputs/json-path-input";
import type { EventSumExpression, ExpressionComponentProps } from "../types";

type EventSumData = EventSumExpression["eventSum"];

export const EventSumExpressionComponent = memo(function EventSumExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
  presentation,
}: ExpressionComponentProps<EventSumData>): ReactNode {
  const fieldId = useId();
  const minSumId = useId();
  const windowDaysId = useId();

  if (mode === "display") {
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          sum({value.eventTypeCode || "(event)"}.{value.fieldPath || "?"}) ≥ {value.minSum}
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
        <JsonPathInput
          value={value.fieldPath}
          onChange={(fieldPath) => onChange({ ...value, fieldPath })}
          label="Field Path"
          disabled={disabled}
          presentation={presentation}
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor={minSumId} className="mb-1.5 block text-xs">
              Minimum Sum
            </Label>
            <Input
              id={minSumId}
              type="number"
              value={value.minSum}
              onChange={(e) => onChange({ ...value, minSum: Number(e.target.value) })}
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
