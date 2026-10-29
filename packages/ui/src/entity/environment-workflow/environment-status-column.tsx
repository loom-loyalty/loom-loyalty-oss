/**
 * EnvironmentStatusColumn
 *
 * Displays which environments an entity is enabled in, and from when. The
 * enablement window (`dateTimePeriod`) controls when the entity is live in
 * that environment, so the column shows each environment's dates inline;
 * the popover adds full times and time zone.
 * Uses semantic color tokens and WCAG 2.1 AA compliant.
 */

import { formatDate, formatDateTime, parseISODateTime } from "@loom-loyalty/core";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import type { ReactNode } from "react";
import type { Column } from "../../data-display/data-table.js";
import { cn } from "../../lib/utils.js";
import { Badge } from "../../primitives/badge.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover.js";

/**
 * Environment enablement record attached to an entity
 */
export interface EnabledInEnvironment {
  organizationEnvironmentId: string;
  environmentCode?: string;
  dateTimePeriod: {
    startDateTime: string;
    endDateTime?: string;
    timeZone?: string;
  };
}

export interface EnvironmentStatusColumnProps {
  enabledInEnvironments?: EnabledInEnvironment[];
  className?: string;
}

export type EnvironmentStatus = "active" | "scheduled" | "expired";

/** Shared header for every list page's enabled-in-environment column. */
export const ENVIRONMENT_COLUMN_HEADER = "Enabled in Environment";

export function getEnvironmentStatus(env: EnabledInEnvironment): EnvironmentStatus {
  const now = new Date();
  const startDate = new Date(env.dateTimePeriod.startDateTime);

  if (now < startDate) {
    return "scheduled";
  }

  if (env.dateTimePeriod.endDateTime) {
    const endDate = new Date(env.dateTimePeriod.endDateTime);
    if (now > endDate) {
      return "expired";
    }
  }

  return "active";
}

/** True when at least one environment's enablement window is open right now. */
export function isEnabledNow(enabledInEnvironments: EnabledInEnvironment[] | undefined): boolean {
  return (enabledInEnvironments ?? []).some((env) => getEnvironmentStatus(env) === "active");
}

/** "Oct 1" for a date in the current year, "Mar 3 '25" otherwise. */
function formatCompactDate(iso: string | undefined): string {
  const date = parseISODateTime(iso);
  if (!date) return "";
  return formatDate(date, date.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d ''yy");
}

/**
 * Short, date-only description of an enablement window:
 * "Since Oct 1", "Starts Nov 1", or "Nov 1 – Dec 31" (the year shows only
 * when it isn't the current one, e.g. "Since Mar 3 '25").
 */
export function formatEnablementPeriod(env: EnabledInEnvironment): string {
  const start = formatCompactDate(env.dateTimePeriod.startDateTime);
  const end = formatCompactDate(env.dateTimePeriod.endDateTime);

  if (!start) return end ? `Until ${end}` : "—";
  if (end) return `${start} – ${end}`;
  return getEnvironmentStatus(env) === "scheduled" ? `Starts ${start}` : `Since ${start}`;
}

const statusConfig: Record<
  EnvironmentStatus,
  { label: string; className: string; borderClassName: string; icon: typeof CheckCircle }
> = {
  active: {
    label: "Active",
    className: "bg-success/10 text-success-dark",
    borderClassName: "border-success/50",
    icon: CheckCircle,
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-primary/10 text-primary",
    borderClassName: "border-primary/50",
    icon: Clock,
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground",
    borderClassName: "border-border",
    icon: AlertCircle,
  },
};

const statusOrder: Record<EnvironmentStatus, number> = {
  active: 0,
  scheduled: 1,
  expired: 2,
};

function sortByStatus(envs: EnabledInEnvironment[]): EnabledInEnvironment[] {
  return [...envs].sort(
    (a, b) => statusOrder[getEnvironmentStatus(a)] - statusOrder[getEnvironmentStatus(b)]
  );
}

export interface EnvironmentEnablementListProps {
  enabledInEnvironments: EnabledInEnvironment[];
  className?: string;
}

/**
 * Full per-environment breakdown: status, start, end, and time zone.
 * Used inside the column popover and in entity detail views.
 */
export function EnvironmentEnablementList({
  enabledInEnvironments,
  className,
}: EnvironmentEnablementListProps): ReactNode {
  const sortedEnvironments = sortByStatus(enabledInEnvironments);

  return (
    <ul className={cn("divide-y", className)}>
      {sortedEnvironments.map((env) => {
        const status = getEnvironmentStatus(env);
        const config = statusConfig[status];
        const StatusIcon = config.icon;

        return (
          <li key={env.organizationEnvironmentId} className="py-3 first:pt-0 last:pb-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {env.environmentCode || "Unknown Environment"}
              </span>
              <Badge variant="outline" className={cn("h-5 text-xs", config.className)}>
                <StatusIcon className="mr-1 h-3 w-3" aria-hidden="true" />
                {config.label}
              </Badge>
            </div>

            <dl className="text-muted-foreground grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 text-xs">
              <dt>Start:</dt>
              <dd>
                {formatDateTime(env.dateTimePeriod.startDateTime) ||
                  env.dateTimePeriod.startDateTime}
              </dd>
              <dt>End:</dt>
              <dd>
                {env.dateTimePeriod.endDateTime
                  ? formatDateTime(env.dateTimePeriod.endDateTime) || env.dateTimePeriod.endDateTime
                  : "Indefinite"}
              </dd>
              {env.dateTimePeriod.timeZone && (
                <>
                  <dt>Timezone:</dt>
                  <dd>{env.dateTimePeriod.timeZone}</dd>
                </>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Renders each enabled environment with its enablement dates for entity list
 * columns. Click opens a popover with full times and time zone.
 */
export function EnvironmentStatusColumn({
  enabledInEnvironments,
  className,
}: EnvironmentStatusColumnProps): ReactNode {
  if (!enabledInEnvironments || enabledInEnvironments.length === 0) {
    return <span className={cn("text-muted-foreground text-sm", className)}>{"—"}</span>;
  }

  const sortedEnvironments = sortByStatus(enabledInEnvironments);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "group focus-visible:ring-ring flex cursor-pointer flex-col items-start gap-1 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            className
          )}
          aria-label={`${enabledInEnvironments.length} environment${enabledInEnvironments.length === 1 ? "" : "s"} enabled, show details`}
        >
          {sortedEnvironments.map((env) => {
            const status = getEnvironmentStatus(env);
            const config = statusConfig[status];
            return (
              <span
                key={env.organizationEnvironmentId}
                className={cn(
                  "inline-flex overflow-hidden rounded-full border text-xs whitespace-nowrap transition-colors",
                  config.borderClassName,
                  status === "expired" && "opacity-60"
                )}
              >
                <span className={cn("px-2 py-0.5 font-semibold", config.className)}>
                  {env.environmentCode || "ENV"}
                </span>
                <span className="text-muted-foreground group-hover:bg-accent/50 px-2 py-0.5">
                  {formatEnablementPeriod(env)}
                </span>
                <span className="sr-only">({config.label})</span>
              </span>
            );
          })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-3">
          <h4 className="text-sm font-medium">Enabled Environments</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Each environment is live only within its dates
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto p-3">
          <EnvironmentEnablementList enabledInEnvironments={sortedEnvironments} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The shared enabled-in-environment list column. Every entity list page uses
 * this so the header, key, and dated rendering stay identical.
 */
export function getEnvironmentColumn<T extends object>(
  getEnvironments: (item: T) => EnabledInEnvironment[] | undefined = (item) =>
    (item as { enabledInEnvironments?: EnabledInEnvironment[] }).enabledInEnvironments
): Column<T> {
  return {
    key: "enabledInEnvironments",
    header: ENVIRONMENT_COLUMN_HEADER,
    render: (item) => <EnvironmentStatusColumn enabledInEnvironments={getEnvironments(item)} />,
  };
}
