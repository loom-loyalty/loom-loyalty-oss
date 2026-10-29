/**
 * Webhook Column Definitions
 *
 * Column definitions for the Webhooks DataTable.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Column } from "../../../data-display/data-table.js";
import { StatusBadge } from "../../../data-display/status-badge.js";
import { Badge } from "../../../primitives/badge.js";
import type { WebhookEndpoint } from "./types.js";

/**
 * Extended columns for the webhooks table.
 * Shows URL, status, events count, created date, and last delivery info.
 */
export function getWebhookColumnsExtended(): Column<WebhookEndpoint>[] {
  return [
    {
      key: "url",
      header: "Endpoint URL",
      render: (webhook) => (
        <div className="max-w-[300px]">
          <p className="text-foreground truncate font-mono text-sm">{webhook.url}</p>
          {webhook.description && (
            <p className="text-muted-foreground truncate text-xs">{webhook.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (webhook) => <StatusBadge status={webhook.status} />,
    },
    {
      key: "events",
      header: "Events",
      render: (webhook) => {
        const events = webhook.events ?? [];
        if (events.length === 0) {
          return <span className="text-muted-foreground text-sm">{"\u2014"}</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "createdDateTime",
      header: "Created",
      render: (webhook) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(webhook.createdDateTime) || "\u2014"}
        </span>
      ),
    },
    {
      key: "updatedDateTime",
      header: "Last Updated",
      render: (webhook) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(webhook.updatedDateTime) || "\u2014"}
        </span>
      ),
    },
  ];
}
