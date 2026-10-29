/**
 * Target Column Definitions
 *
 * Column definitions for the Targets DataTable using SDK ResponseTargetData type.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type {
  CompletionTarget,
  CounterTarget,
  MilestoneTarget,
  MilestoneTargetItem,
  ResponseTargetData,
  XOfYTarget,
} from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

import { TARGET_SCOPE_LABELS, TARGET_TYPE_LABELS } from "./types.js";

/**
 * Format the target configuration for display.
 * Shows type-specific summary information.
 */
export function formatTargetConfig(target: ResponseTargetData): string {
  const type = (target as unknown as { type: string }).type;

  if (type === "COMPLETION") {
    const ct = target as CompletionTarget;
    return ct.completionTargetType?.name ?? "\u2014";
  }

  if (type === "COUNTER") {
    const ct = target as CounterTarget;
    const parts: string[] = [];
    if (ct.targetValue != null) {
      parts.push(`Target: ${ct.targetValue}`);
    }
    if (ct.numberOfCycles != null && ct.numberOfCycles > 0) {
      parts.push(`${ct.numberOfCycles} cycles`);
    }
    return parts.length > 0 ? parts.join(" / ") : "\u2014";
  }

  if (type === "MILESTONE") {
    const mt = target as MilestoneTarget;
    const count = (mt.items as MilestoneTargetItem[] | undefined)?.length ?? 0;
    return `${count} step${count !== 1 ? "s" : ""}`;
  }

  if (type === "X_OF_Y") {
    const xt = target as XOfYTarget;
    const itemCount = (xt.items as string[] | undefined)?.length ?? 0;
    return `${xt.targetValue ?? 0} of ${itemCount}`;
  }

  return "\u2014";
}

/**
 * Get a short description from target data
 */
export function getDescription(target: ResponseTargetData): string | null {
  const desc = target.description;
  if (!desc || typeof desc !== "object") return null;
  const descObj = desc as Record<string, string>;
  return descObj.en ?? Object.values(descObj)[0] ?? null;
}

/**
 * Extended columns for the targets table
 */
export function getTargetColumnsExtended(): Column<ResponseTargetData>[] {
  return [
    {
      key: "name",
      header: "Target",
      render: (target) => (
        <div>
          <p className="text-foreground font-medium">{target.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{target.code}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (target) => {
        const type = (target as unknown as { type: string }).type;
        return (
          <Badge variant="secondary" className="font-normal">
            {TARGET_TYPE_LABELS[type] ?? type}
          </Badge>
        );
      },
    },
    {
      key: "config",
      header: "Configuration",
      render: (target) => {
        const type = (target as unknown as { type: string }).type;
        const config = formatTargetConfig(target);

        if (type === "COUNTER") {
          const ct = target as CounterTarget;
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">{config}</span>
              {ct.cappingTarget && (
                <Badge variant="outline" className="text-xs font-normal">
                  Capping
                </Badge>
              )}
            </div>
          );
        }

        return <span className="text-muted-foreground text-sm">{config}</span>;
      },
    },
    {
      key: "scope",
      header: "Scope",
      render: (target) => {
        const scope = (target as unknown as { scope: string }).scope;
        return (
          <Badge variant="outline" className="font-normal">
            {TARGET_SCOPE_LABELS[scope] ?? scope}
          </Badge>
        );
      },
    },
    {
      key: "programs",
      header: "Programs",
      render: (target) => {
        const count = target.programIds?.length ?? 0;
        if (count === 0) {
          return <span className="text-muted-foreground text-sm">{"\u2014"}</span>;
        }
        return (
          <Badge variant="outline" className="font-normal">
            {count} {count === 1 ? "program" : "programs"}
          </Badge>
        );
      },
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (target) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(target.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (target) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(target.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
