/**
 * DatePicker
 *
 * A date picker component that combines a popover trigger with a Calendar.
 * Uses semantic color tokens and follows WCAG 2.1 AA accessibility standards.
 */

"use client";

import { formatDate, parseISODateTime } from "@loom-loyalty/core";
import { CalendarIcon } from "lucide-react";
import { type ReactNode, useCallback, useMemo } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Calendar } from "../primitives/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";

export interface DatePickerProps {
  /** Selected date as ISO string (YYYY-MM-DD) */
  value?: string;
  /** Called when date selection changes */
  onChange: (date: string | undefined) => void;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** HTML id for the trigger */
  id?: string;
  /** Additional className for the trigger */
  className?: string;
  /** ARIA label */
  "aria-label"?: string;
  /** ARIA invalid state */
  "aria-invalid"?: boolean;
  /** ARIA describedby */
  "aria-describedby"?: string;
}

/**
 * DatePicker - A date selection component with calendar popover.
 *
 * @example
 * ```tsx
 * const [date, setDate] = useState<string | undefined>();
 *
 * <DatePicker
 *   value={date}
 *   onChange={setDate}
 *   placeholder="Select a date..."
 * />
 * ```
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps): ReactNode {
  const selectedDate = useMemo(
    () => (value ? (parseISODateTime(value) ?? undefined) : undefined),
    [value]
  );

  const handleSelect = useCallback(
    (date: Date | undefined) => {
      onChange(date ? formatDate(date, "yyyy-MM-dd") || undefined : undefined);
    },
    [onChange]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "bg-card w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          aria-label={ariaLabel ?? "Select date"}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        >
          <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          {value ? formatDate(value, "MMMM d, yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selectedDate} onSelect={handleSelect} autoFocus />
      </PopoverContent>
    </Popover>
  );
}
