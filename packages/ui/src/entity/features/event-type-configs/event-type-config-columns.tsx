/**
 * Event Type Configuration Column Definitions
 *
 * Column definitions for the Event Type Configurations DataTable using SDK type directly.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { EventTypeConfiguration } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

// API populates the resolved eventType object; eventTypeCode is a spec-side fallback.
export function resolveEventTypeCode(config: EventTypeConfiguration): string {
  const eventType = config.eventType as { code?: string } | undefined;
  return eventType?.code ?? config.eventTypeCode ?? "";
}

export function resolveEventTypeLabel(config: EventTypeConfiguration): string {
  const eventType = config.eventType as { name?: string } | undefined;
  return eventType?.name ?? resolveEventTypeCode(config);
}

/**
 * Format archival configuration for display
 * Returns a human-readable string based on processed/unprocessed days
 */
export function formatArchivalConfig(config: EventTypeConfiguration): string {
  const parts: string[] = [];

  if (config.processedDaysTillArchival != null) {
    parts.push(`${config.processedDaysTillArchival}d processed`);
  }
  if (config.unprocessedDaysTillArchival != null) {
    parts.push(`${config.unprocessedDaysTillArchival}d unprocessed`);
  }

  return parts.length > 0 ? parts.join(", ") : "\u2014";
}

/**
 * Extended columns for the event type configurations table
 * Shows all relevant data for efficient configuration management
 */
export function getEventTypeConfigColumnsExtended(): Column<EventTypeConfiguration>[] {
  return [
    {
      key: "name",
      header: "Event Type Config",
      render: (config) => (
        <div>
          <p className="text-foreground font-medium">{config.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{config.code}</p>
        </div>
      ),
    },
    {
      key: "eventType",
      header: "Event Type",
      render: (config) => {
        const label = resolveEventTypeLabel(config);
        return label ? (
          <Badge variant="secondary" className="font-normal">
            {label}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        );
      },
    },
    {
      key: "eventSubTypeIdentifier",
      header: "Sub Type",
      render: (config) => (
        <span className="text-muted-foreground text-sm">
          {config.eventSubTypeIdentifier || "\u2014"}
        </span>
      ),
    },
    {
      key: "synchronous",
      header: "Sync",
      render: (config) => (
        <Badge variant={config.synchronous ? "default" : "outline"} className="font-normal">
          {config.synchronous ? "Sync" : "Async"}
        </Badge>
      ),
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (config) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(config.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (config) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(config.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
