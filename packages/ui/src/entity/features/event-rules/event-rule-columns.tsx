/**
 * Event Rule Column Definitions
 *
 * Column definitions for the Event Rules DataTable.
 */

import { formatShortDate } from "@loom-loyalty/core";

import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import type { EntityRecord } from "../../entity-list.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";
import { EventRuleCategoryBadge } from "./event-rule-category-badge.js";
import { CATEGORY_INFO, type EventRuleCategory } from "./types.js";

/**
 * Extended columns for the event rules table.
 */
export function getEventRuleColumnsExtended(): Column<EntityRecord>[] {
  return [
    {
      key: "name",
      header: "Event Rule",
      render: (rule) => (
        <div>
          <p className="text-foreground font-medium">{rule.name as string}</p>
          <p className="text-muted-foreground font-mono text-xs">{rule.code as string}</p>
          <DraftOpenMarker rule={rule} />
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (rule) => {
        const category = rule.category as string;
        if (category && category in CATEGORY_INFO) {
          return <EventRuleCategoryBadge category={category as EventRuleCategory} size="sm" />;
        }
        return (
          <Badge variant="outline" className="font-normal">
            {category ?? "\u2014"}
          </Badge>
        );
      },
    },
    {
      key: "eventType",
      header: "Event Type",
      render: (rule) => {
        // Polymorphic: could be string, object with name/code, or eventTypeCode field
        const eventType = rule.eventType as Record<string, unknown> | string | undefined;
        const eventTypeCode = rule.eventTypeCode as string | undefined;

        let display = "\u2014";
        if (typeof eventType === "object" && eventType !== null) {
          display = (eventType.name as string) ?? (eventType.code as string) ?? "\u2014";
        } else if (typeof eventType === "string") {
          display = eventType;
        } else if (eventTypeCode) {
          display = eventTypeCode;
        }

        return <span className="text-muted-foreground text-sm">{display}</span>;
      },
    },
    {
      key: "programIds",
      header: "Programs",
      render: (rule) => {
        const ids = rule.programIds as string[] | undefined;
        const count = ids?.length ?? 0;
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
      render: (rule) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(rule.createdDateTime as string) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (rule) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(rule.modifiedDateTime as string) ?? "\u2014"}
        </span>
      ),
    },
  ];
}

/**
 * "Draft open · vN" on a live, paused or archived row whose rule has an
 * unpublished draft. The API sets `openDraftVersion` on list rows only; an
 * older API leaves it out, and then nothing shows.
 */
function DraftOpenMarker({ rule }: { rule: EntityRecord }) {
  const draftVersion = rule.openDraftVersion;
  if (typeof draftVersion !== "number" || rule.versionStatus === "DRAFT") return null;
  return (
    <Badge variant="outline" className="mt-1 font-normal">
      <span aria-hidden="true">Draft open · v{draftVersion}</span>
      <span className="sr-only">Draft version {draftVersion} open</span>
    </Badge>
  );
}
