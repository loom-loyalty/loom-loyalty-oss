/**
 * DateTimeInput
 *
 * A combined date and time input. Renders a DatePicker for the date portion
 * and an <input type="time"> for the time portion side-by-side. The value is
 * an ISO 8601 datetime string.
 */

"use client";

import { useCallback, useId, useMemo } from "react";

import { cn } from "../lib/utils";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { DatePicker } from "./date-picker";

export interface DateTimeInputProps {
  /** Field label */
  label?: string;
  /** ISO datetime string value (e.g. "2024-06-15T14:30:00") */
  value?: string;
  /** Called when the datetime value changes */
  onChange?: (value: string) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Disable interactions */
  disabled?: boolean;
  /** ARIA label */
  "aria-label"?: string;
  /** ARIA describedby */
  "aria-describedby"?: string;
}

/**
 * DateTimeInput - Combined date picker and time input.
 *
 * @example
 * ```tsx
 * const [dateTime, setDateTime] = useState<string>();
 *
 * <DateTimeInput
 *   label="Event Start"
 *   value={dateTime}
 *   onChange={setDateTime}
 *   required
 * />
 * ```
 */
export function DateTimeInput({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: DateTimeInputProps) {
  const id = useId();

  const { datePart, timePart } = useMemo(() => {
    if (!value) return { datePart: undefined, timePart: "00:00" };
    const [date, time] = value.split("T");
    return {
      datePart: date || undefined,
      timePart: time?.slice(0, 5) || "00:00",
    };
  }, [value]);

  const combine = useCallback(
    (date: string | undefined, time: string) => {
      onChange?.(date ? `${date}T${time}:00` : "");
    },
    [onChange]
  );

  const handleDateChange = useCallback(
    (date: string | undefined) => {
      combine(date, timePart);
    },
    [combine, timePart]
  );

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      combine(datePart, e.target.value || "00:00");
    },
    [combine, datePart]
  );

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={`${id}-time`}>
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}

      <div
        className="flex items-center gap-2"
        role="group"
        aria-label={ariaLabel ?? label ?? "Date and time"}
        aria-describedby={ariaDescribedBy}
      >
        <div className="flex-1">
          <DatePicker
            value={datePart}
            onChange={handleDateChange}
            disabled={disabled}
            aria-label={`${label ? `${label} ` : ""}date`}
          />
        </div>
        <Input
          id={`${id}-time`}
          type="time"
          value={timePart}
          onChange={handleTimeChange}
          disabled={disabled}
          required={required}
          className={cn("w-auto")}
          aria-label={`${label ? `${label} ` : ""}time`}
        />
      </div>
    </div>
  );
}
