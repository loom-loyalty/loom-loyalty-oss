/**
 * Offer Column Definitions
 *
 * Column definitions for the Offers DataTable using SDK Offer type directly.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Offer } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import {
  getEnvironmentColumn,
  isEnabledNow,
} from "../../environment-workflow/environment-status-column.js";
import { OfferStatusBadge } from "./offer-status-badge.js";
import { OfferTypeBadge } from "./offer-type-badge.js";

/**
 * Extended columns for the offers table
 * Shows all relevant data for efficient offer management
 */
export function getOfferColumnsExtended(): Column<Offer>[] {
  return [
    {
      key: "name",
      header: "Offer",
      render: (offer) => (
        <div>
          <p className="text-foreground font-medium">{offer.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{offer.code}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (offer) => <OfferTypeBadge type={offer.type} />,
    },
    {
      key: "status",
      header: "Status",
      render: (offer) => <OfferStatusBadge active={isEnabledNow(offer.enabledInEnvironments)} />,
    },
    {
      key: "programIds",
      header: "Programs",
      render: (offer) => {
        const count = offer.programIds?.length ?? 0;
        return (
          <span className="text-muted-foreground text-sm">
            {count === 0 ? "\u2014" : `${count} program${count !== 1 ? "s" : ""}`}
          </span>
        );
      },
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (offer) =>
        offer.createdDateTime ? (
          <time dateTime={offer.createdDateTime} className="text-muted-foreground text-sm">
            {formatShortDate(offer.createdDateTime)}
          </time>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
  ];
}
