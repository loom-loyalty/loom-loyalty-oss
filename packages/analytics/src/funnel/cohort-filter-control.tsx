import type { ReactNode } from "react";

import type { CohortFilter } from "../types";

// Re-export the shared date converter so existing imports from this file keep working.
// New code should import from "../lib/cohort" directly.
export { cohortToDateRange } from "../lib/cohort";

interface CohortFilterControlProps {
  value: CohortFilter;
  onChange: (cohort: CohortFilter) => void;
}

const PERIOD_LABELS: Record<"all" | "7d" | "30d" | "90d" | "1y", string> = {
  all: "All customers (no cohort filter)",
  "7d": "Acquired in last 7 days",
  "30d": "Acquired in last 30 days",
  "90d": "Acquired in last 90 days",
  "1y": "Acquired in last 1 year",
};

/**
 * Cohort filter for the customer-funnel page. The underlying pipe filters by
 * `created_datetime` (acquisition date) — NOT activity. Label calls this out
 * explicitly so operators don't confuse it with the activity-window date
 * controls on the overview page.
 *
 * Default = "All customers" → renders a snapshot of every current customer.
 */
export function CohortFilterControl({ value, onChange }: CohortFilterControlProps): ReactNode {
  const current = value.kind === "all" ? "all" : value.kind === "period" ? value.period : "range";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="cohort-filter" className="text-foreground text-sm font-medium">
        Cohort filter (UTC) —{" "}
        <span className="text-muted-foreground font-normal">filter to customers acquired in:</span>
      </label>
      {/*
        This control exposes the snapshot + 4 period presets. The `kind: 'range'`
        variant of CohortFilter is reserved for programmatic callers (e.g. a
        future date-picker UI); rendering 'range' here would have nothing to
        select against, so it falls through to the snapshot option.
      */}
      <select
        id="cohort-filter"
        value={current === "range" ? "all" : current}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "all") onChange({ kind: "all" });
          else if (v === "7d" || v === "30d" || v === "90d" || v === "1y") {
            onChange({ kind: "period", period: v });
          }
        }}
        className="border-border bg-background text-foreground rounded-md border px-3 py-1.5 text-sm"
      >
        <option value="all">{PERIOD_LABELS.all}</option>
        <option value="7d">{PERIOD_LABELS["7d"]}</option>
        <option value="30d">{PERIOD_LABELS["30d"]}</option>
        <option value="90d">{PERIOD_LABELS["90d"]}</option>
        <option value="1y">{PERIOD_LABELS["1y"]}</option>
      </select>
    </div>
  );
}
