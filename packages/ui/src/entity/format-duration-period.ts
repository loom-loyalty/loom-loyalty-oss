/**
 * Shared formatter for DurationPeriodValue display.
 */

import { formatDateTime } from "@loom-loyalty/core";
import type { DurationPeriodValue as DurationPeriodValueSchema } from "@loom-loyalty/sdk";

// The SDK schema marks `durationPeriodType` required, but
// real persisted records predate that field and omit it — this formatter and
// DurationPeriodBuilder both already treat it as optional intentionally (see
// the "without type label" test below). This shim reflects that documented
// runtime shape rather than the schema's aspirational one.
export type DurationPeriodValue = Omit<DurationPeriodValueSchema, "durationPeriodType"> & {
  durationPeriodType?: DurationPeriodValueSchema["durationPeriodType"];
};

/**
 * Fill in the SDK's required `durationPeriodType` for submission, defaulting to
 * "SLIDING" — the same default the builder UI already applies when displaying
 * a value that predates the field.
 */
export function toStrictDurationPeriodValue(
  value: DurationPeriodValue | undefined
): DurationPeriodValueSchema | undefined {
  if (!value) return undefined;
  return { ...value, durationPeriodType: value.durationPeriodType ?? "SLIDING" };
}

/**
 * Format a DurationPeriodValue for display.
 * Handles Sliding/Calendar (value + unit) and Fixed (date range).
 */
export function formatDurationPeriod(dp?: DurationPeriodValue): string | null {
  if (!dp) return null;

  if (dp.durationPeriodType === "FIXED" && dp.fixedDurationDateTimePeriod) {
    const start = formatDateTime(dp.fixedDurationDateTimePeriod.startDateTime);
    const end = dp.fixedDurationDateTimePeriod.endDateTime
      ? formatDateTime(dp.fixedDurationDateTimePeriod.endDateTime)
      : "ongoing";
    return `${start ?? "?"} \u2013 ${end}`;
  }

  if (dp.durationPeriodValue && dp.durationPeriod) {
    const unit =
      dp.durationPeriod.charAt(0).toUpperCase() + dp.durationPeriod.slice(1).toLowerCase();
    const typeLabel = dp.durationPeriodType
      ? ` (${dp.durationPeriodType.charAt(0).toUpperCase() + dp.durationPeriodType.slice(1).toLowerCase()})`
      : "";
    return `${dp.durationPeriodValue} ${unit}${typeLabel}`;
  }

  return null;
}
