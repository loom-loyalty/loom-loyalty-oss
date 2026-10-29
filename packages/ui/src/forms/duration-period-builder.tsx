/**
 * DurationPeriodBuilder - Configurable duration period selector
 *
 * Supports Sliding, Calendar, and Fixed (date range) duration types.
 * Includes an enable/disable checkbox to toggle the entire section.
 */

import type {
  DurationPeriodValueDurationPeriod,
  DurationPeriodValueDurationPeriodType,
} from "@loom-loyalty/sdk";
import { useId, type ReactNode } from "react";
import type { DurationPeriodValue } from "../entity/format-duration-period.js";
import { Checkbox } from "../primitives/checkbox.js";
import { Input } from "../primitives/input.js";
import { Label } from "../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select.js";
import { DatePicker } from "./date-picker.js";

export type { DurationPeriodValue };

export interface DurationPeriodBuilderProps {
  value?: DurationPeriodValue;
  onChange: (value: DurationPeriodValue | undefined) => void;
  disabled?: boolean;
  error?: string;
  /** Label shown next to the enable checkbox */
  label?: string;
  /** Helper text below the checkbox */
  description?: string;
}

const PERIOD_TYPE_OPTIONS: { value: DurationPeriodValueDurationPeriodType; label: string }[] = [
  { value: "SLIDING", label: "Sliding" },
  { value: "CALENDAR", label: "Calendar" },
  { value: "FIXED", label: "Fixed" },
];

const PERIOD_UNIT_OPTIONS: { value: DurationPeriodValueDurationPeriod; label: string }[] = [
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "MONTHS", label: "Months" },
  { value: "YEARS", label: "Years" },
];

const PERIOD_TYPE_DESCRIPTIONS: Record<string, string> = {
  SLIDING: "Rolling window from customer\u2019s start date",
  CALENDAR: "Calendar-based period (e.g., calendar month)",
  FIXED: "Specific date range",
};

/**
 * DurationPeriodBuilder - Checkbox-enabled duration period configuration.
 *
 * Supports Sliding/Calendar (value + unit) and Fixed (date range) period types.
 */
export function DurationPeriodBuilder({
  value,
  onChange,
  disabled = false,
  error,
  label = "Set Duration Period",
  description,
}: DurationPeriodBuilderProps): ReactNode {
  const id = useId();
  const isEnabled = !!value;

  const handleEnabledChange = (checked: boolean) => {
    if (!checked) {
      onChange(undefined);
    } else {
      onChange({
        durationPeriodType: "SLIDING",
        durationPeriod: "DAYS",
        durationPeriodValue: 30,
      });
    }
  };

  const handleTypeChange = (type: string) => {
    if (type === "FIXED") {
      onChange({
        durationPeriodType: "FIXED",
        durationPeriod: "FIXED",
        fixedDurationDateTimePeriod: undefined,
      });
    } else {
      onChange({
        durationPeriodType: type as DurationPeriodValueDurationPeriodType,
        durationPeriod: "DAYS",
        durationPeriodValue: 30,
      });
    }
  };

  const handlePeriodChange = (period: string) => {
    onChange({
      ...value,
      durationPeriod: period as DurationPeriodValueDurationPeriod,
    });
  };

  const handleValueChange = (val: string) => {
    if (val === "") {
      onChange({
        ...value,
        durationPeriodValue: undefined,
      });
      return;
    }
    const numValue = parseInt(val, 10);
    if (!isNaN(numValue) && numValue > 0) {
      onChange({
        ...value,
        durationPeriodValue: numValue,
      });
    }
  };

  const toISODateTime = (date: string | undefined): string | undefined =>
    date ? `${date}T00:00:00.000Z` : undefined;

  const handleStartDateChange = (date: string | undefined) => {
    const dateTime = toISODateTime(date);
    onChange({
      ...value,
      durationPeriodType: "FIXED",
      durationPeriod: "FIXED",
      // Confirmed backend OpenAPI spec-gen artifact: DateTimePeriod's @JsonCreator lacks
      // @Nullable and TimeZone leaks boolean getters; preserve an omitted endDateTime/timeZone.
      fixedDurationDateTimePeriod: {
        startDateTime: dateTime ?? value?.fixedDurationDateTimePeriod?.startDateTime ?? "",
        endDateTime: value?.fixedDurationDateTimePeriod?.endDateTime,
      } as DurationPeriodValue["fixedDurationDateTimePeriod"],
    } as DurationPeriodValue);
  };

  const handleEndDateChange = (date: string | undefined) => {
    onChange({
      ...value,
      durationPeriodType: "FIXED",
      durationPeriod: "FIXED",
      // Confirmed backend OpenAPI spec-gen artifact: DateTimePeriod's @JsonCreator lacks
      // @Nullable and TimeZone leaks boolean getters; preserve an omitted endDateTime/timeZone.
      fixedDurationDateTimePeriod: {
        startDateTime: value?.fixedDurationDateTimePeriod?.startDateTime ?? "",
        endDateTime: toISODateTime(date),
      } as DurationPeriodValue["fixedDurationDateTimePeriod"],
    } as DurationPeriodValue);
  };

  const checkboxId = `${id}-toggle`;
  const periodTypeId = `${id}-period-type`;
  const durationValueId = `${id}-duration-value`;
  const periodUnitId = `${id}-period-unit`;
  const startDateId = `${id}-start-date`;
  const endDateId = `${id}-end-date`;

  return (
    <div className="space-y-4">
      <div className="flex items-start space-x-3">
        <Checkbox
          id={checkboxId}
          checked={isEnabled}
          onCheckedChange={handleEnabledChange}
          disabled={disabled}
          className="mt-0.5"
          aria-describedby={description ? `${checkboxId}-desc` : undefined}
        />
        <div className="flex-1">
          <Label htmlFor={checkboxId} className="cursor-pointer font-normal">
            {label}
          </Label>
          {description && (
            <p id={`${checkboxId}-desc`} className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </p>
          )}
        </div>
      </div>

      {isEnabled && value && (
        <div className="space-y-4 pt-2 pl-7">
          {/* Period Type selector */}
          <div className="space-y-2">
            <Label htmlFor={periodTypeId}>Period Type</Label>
            <Select
              value={value.durationPeriodType ?? "SLIDING"}
              onValueChange={handleTypeChange}
              disabled={disabled}
            >
              <SelectTrigger id={periodTypeId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value.durationPeriodType && PERIOD_TYPE_DESCRIPTIONS[value.durationPeriodType] && (
              <p className="text-muted-foreground text-xs">
                {PERIOD_TYPE_DESCRIPTIONS[value.durationPeriodType]}
              </p>
            )}
          </div>

          {/* Sliding / Calendar: value + unit */}
          {value.durationPeriodType !== "FIXED" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={durationValueId}>Duration Value</Label>
                <Input
                  id={durationValueId}
                  type="number"
                  min="1"
                  value={value.durationPeriodValue ?? ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder="e.g., 30"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={periodUnitId}>Period Unit</Label>
                <Select
                  value={value.durationPeriod ?? "DAYS"}
                  onValueChange={handlePeriodChange}
                  disabled={disabled}
                >
                  <SelectTrigger id={periodUnitId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Fixed: date range pickers */}
          {value.durationPeriodType === "FIXED" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={startDateId}>Start Date</Label>
                <DatePicker
                  id={startDateId}
                  value={value.fixedDurationDateTimePeriod?.startDateTime}
                  onChange={handleStartDateChange}
                  placeholder="Select start date"
                  disabled={disabled}
                  aria-invalid={
                    !value.fixedDurationDateTimePeriod?.startDateTime ? true : undefined
                  }
                />
                {!value.fixedDurationDateTimePeriod?.startDateTime && (
                  <p className="text-destructive text-xs">Start date is required</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={endDateId}>End Date (Optional)</Label>
                <DatePicker
                  id={endDateId}
                  value={value.fixedDurationDateTimePeriod?.endDateTime}
                  onChange={handleEndDateChange}
                  placeholder="Select end date"
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive pl-7 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
