/**
 * Audience Column Definitions
 *
 * Column definitions for the Audiences DataTable using CustomerAudience type.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { ReactNode } from "react";
import type { Column } from "../../../data-display/data-table.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";
import { AudienceStatusIndicator } from "./audience-status-indicator.js";
import { SegmentVersionStatusBadge } from "./segment-version-status-badge.js";
import { TypedAudienceBadge } from "./typed-audience-badge.js";
import { isCustomerSegment, type CustomerAudience } from "./types.js";
import { formatMemberCount, getAudienceMemberCount, getSegmentComputationNote } from "./utils.js";

/**
 * Version rendering — shows version number + Draft/Published badge for
 * CUSTOMER_SEGMENT rows only. CUSTOMER_LIST has no version concept.
 */
function renderVersion(audience: CustomerAudience): ReactNode {
  if (!isCustomerSegment(audience) || audience.version == null) {
    return <span className="text-muted-foreground text-sm">{"—"}</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground font-mono text-xs">v{audience.version}</span>
      {audience.versionStatus && <SegmentVersionStatusBadge status={audience.versionStatus} />}
    </div>
  );
}

/**
 * Extended columns for the audiences table
 * Shows all relevant data for efficient audience management
 */
export function getAudienceColumnsExtended(): Column<CustomerAudience>[] {
  return [
    {
      key: "type",
      header: "Type",
      render: (audience) => <TypedAudienceBadge audience={audience} size="sm" />,
    },
    {
      key: "name",
      header: "Audience",
      render: (audience) => (
        <div>
          <p className="text-foreground font-medium">{audience.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{audience.code}</p>
        </div>
      ),
    },
    {
      key: "members",
      header: "Members",
      render: (audience) => {
        const note = getSegmentComputationNote(audience);
        return (
          <div>
            <p className="text-foreground text-sm font-medium">
              {formatMemberCount(getAudienceMemberCount(audience))}
            </p>
            {note && <p className="text-muted-foreground text-xs">{note}</p>}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (audience) => <AudienceStatusIndicator audience={audience} />,
    },
    getEnvironmentColumn(),
    {
      key: "version",
      header: "Version",
      render: renderVersion,
    },
    {
      key: "createdAt",
      header: "Created",
      render: (audience) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(audience.createdAt) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "Modified",
      render: (audience) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(audience.updatedAt) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
