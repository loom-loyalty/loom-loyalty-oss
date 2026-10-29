/**
 * Last Event Time Expression Component (audience-only)
 *
 * Matches customers whose most recent event of a type happened within the last
 * N days (recency).
 */

import { memo, useId, type ReactNode } from "react";
import { EventTypeField } from "../../forms/event-type-field/index.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";

import type { ExpressionComponentProps, LastEventTimeExpression } from "../types";

type LastEventTimeData = LastEventTimeExpression["lastEventTime"];

export const LastEventTimeExpressionComponent = memo(function LastEventTimeExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<LastEventTimeData>): ReactNode {
  const fieldId = useId();
  const withinDaysId = useId();

  if (mode === "display") {
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          last {value.eventTypeCode || "(event)"} within {value.maxDaysSinceLast}d
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
          <Label htmlFor={withinDaysId} className="mb-1.5 block text-xs">
            Within (days)
          </Label>
          <Input
            id={withinDaysId}
            type="number"
            value={value.maxDaysSinceLast}
            onChange={(e) => onChange({ ...value, maxDaysSinceLast: Number(e.target.value) })}
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
});
