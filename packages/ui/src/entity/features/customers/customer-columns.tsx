/**
 * Customer Column Definitions
 *
 * Column definitions for the Customers DataTable using SDK Customer type directly.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Customer } from "@loom-loyalty/sdk";
import { Eye } from "lucide-react";
import type { Column } from "../../../data-display/data-table.js";
import { StatusBadge } from "../../../data-display/status-badge.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { getSDKCustomerName, getSDKPrimaryEmail } from "./types.js";

/**
 * Options for customizing customer column behavior.
 */
export interface CustomerColumnOptions {
  /** Callback when the preview (eye) icon is clicked on a customer row. */
  onPreview?: (customer: Customer) => void;
}

/**
 * Extended columns for the customers table
 * Shows all relevant data for efficient customer management
 */
export function getCustomerColumnsExtended(options?: CustomerColumnOptions): Column<Customer>[] {
  return [
    {
      key: "name",
      header: "Customer",
      render: (customer) => {
        const c = customer as Record<string, unknown>;
        const emailAddresses = c.emailAddresses as
          | Array<{ emailAddress?: string; primary?: boolean }>
          | undefined;
        const primaryEmail = getSDKPrimaryEmail(emailAddresses);
        return (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-foreground font-medium">{getSDKCustomerName(customer)}</p>
              <p className="text-muted-foreground text-xs">
                {primaryEmail?.emailAddress ?? "\u2014"}
              </p>
            </div>
            {options?.onPreview && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                aria-label={`Preview ${getSDKCustomerName(customer)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  options.onPreview!(customer);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (customer) => {
        const c = customer as Record<string, unknown>;
        const hasCorpIdentity = c.corporateIdentity != null;
        return (
          <Badge variant="secondary" className="font-normal">
            {hasCorpIdentity ? "Corporate" : "Individual"}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (customer) => {
        const c = customer as Record<string, unknown>;
        const status = c.status as { name?: string; code?: string } | undefined;
        const label = status?.name ?? status?.code ?? "Unknown";
        return <StatusBadge status={label} />;
      },
    },
    {
      key: "programs",
      header: "Programs",
      render: (customer) => {
        const c = customer as Record<string, unknown>;
        const programs = c.programs as unknown[] | undefined;
        const count = programs?.length;
        return (
          <span className="text-muted-foreground text-sm">
            {count != null && count > 0 ? count : "\u2014"}
          </span>
        );
      },
    },
    {
      key: "createdDateTime",
      header: "Created",
      render: (customer) => {
        const c = customer as Record<string, unknown>;
        const dt = c.createdDateTime as string | undefined;
        return (
          <span className="text-muted-foreground text-sm">
            {dt ? <time dateTime={dt}>{formatShortDate(dt)}</time> : "\u2014"}
          </span>
        );
      },
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (customer) => {
        const c = customer as Record<string, unknown>;
        const dt = c.modifiedDateTime as string | undefined;
        return (
          <span className="text-muted-foreground text-sm">
            {dt ? <time dateTime={dt}>{formatShortDate(dt)}</time> : "\u2014"}
          </span>
        );
      },
    },
  ];
}
