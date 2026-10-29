/**
 * MetricRoleSelect
 *
 * Shared between element-dialog.tsx (the single-element edit form) and the
 * Data Model Builder's dense field-review-table: both let a numeric field be
 * tagged as a financial metric (Revenue/Cost/Margin) so analytics such as the
 * customer revenue-decile can read it off captured events.
 */

import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";

const METRIC_ROLE_NONE = "NONE" as const;
type MetricRoleSelectValue = "NONE" | "REVENUE" | "COST" | "MARGIN";

export interface MetricRoleSelectProps {
  id: string;
  value: "REVENUE" | "COST" | "MARGIN" | undefined;
  disabled: boolean;
  onChange: (value: "REVENUE" | "COST" | "MARGIN" | undefined) => void;
  /** Id of the always-visible helper text explaining the field/disabled state. */
  describedById?: string;
  /** Accessible name for the trigger. Falls back to the visible "Metric Role" label when omitted. */
  ariaLabel?: string;
  /** Overrides the trigger's className; defaults to the dialog's font-mono style. */
  triggerClassName?: string;
  /** Overrides each item's className; defaults to the dialog's font-mono style. */
  itemClassName?: string;
}

export function MetricRoleSelect({
  id,
  value,
  disabled,
  onChange,
  describedById,
  ariaLabel,
  triggerClassName = "font-mono",
  itemClassName = "font-mono",
}: MetricRoleSelectProps): ReactNode {
  return (
    <Select
      value={(value ?? METRIC_ROLE_NONE) satisfies MetricRoleSelectValue}
      onValueChange={(next: MetricRoleSelectValue) =>
        onChange(next === METRIC_ROLE_NONE ? undefined : next)
      }
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={triggerClassName}
        aria-describedby={describedById}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder="None" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={METRIC_ROLE_NONE} className={itemClassName}>
          None
        </SelectItem>
        <SelectItem value="REVENUE" className={itemClassName}>
          Revenue
        </SelectItem>
        <SelectItem value="COST" className={itemClassName}>
          Cost
        </SelectItem>
        <SelectItem value="MARGIN" className={itemClassName}>
          Margin
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
