/**
 * Program Column Definitions
 *
 * Column definitions for the Programs DataTable using SDK Program type directly.
 * Uses extended columns for data-dense display.
 */

import { extractLocalizedString, formatShortDate } from "@loom-loyalty/core";
import type { Program } from "@loom-loyalty/sdk";
import { Building2 } from "lucide-react";
import type { Column } from "../../../data-display/data-table.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

/**
 * Extended columns for the programs table
 * Shows all relevant data for efficient program management
 */
export function getProgramColumnsExtended(): Column<Program>[] {
  return [
    {
      key: "name",
      header: "Program",
      render: (program) => (
        <div>
          <p className="text-foreground font-medium">{program.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{program.code}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (program) => {
        const desc = extractLocalizedString(program.description);
        return (
          <p className="text-muted-foreground truncate text-sm" title={desc}>
            {desc || "\u2014"}
          </p>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (program) => (
        <span className="text-muted-foreground text-sm">{program.type?.name ?? "\u2014"}</span>
      ),
    },
    {
      key: "partner",
      header: "Partner",
      render: (program) =>
        program.partner ? (
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-full">
              <Building2 className="text-primary h-3.5 w-3.5" />
            </div>
            <span className="text-foreground text-sm">{program.partner.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    {
      key: "autoCreate",
      header: "Auto-create",
      render: (program) => (
        <span
          className={
            program.createAccountOnCustomerCreation
              ? "text-success-dark text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {program.createAccountOnCustomerCreation ? "Yes" : "No"}
        </span>
      ),
    },
    getEnvironmentColumn(),
    {
      key: "createdDateTime",
      header: "Created",
      render: (program) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(program.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (program) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(program.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
