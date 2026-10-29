/**
 * Currency Column Definitions
 *
 * Column definitions for the Currencies DataTable using SDK ProgramCurrency type directly.
 * Uses extended columns for data-dense display.
 */

import { extractLocalizedString, formatShortDate } from "@loom-loyalty/core";
import type { ProgramCurrency } from "@loom-loyalty/sdk";
import type { Column } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { getEnvironmentColumn } from "../../environment-workflow/environment-status-column.js";

/**
 * Extended columns for the currencies table
 * Shows all relevant data for efficient currency management
 */
export function getCurrencyColumnsExtended(): Column<ProgramCurrency>[] {
  return [
    {
      key: "name",
      header: "Currency",
      render: (currency) => (
        <div>
          <p className="text-foreground font-medium">{currency.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{currency.code}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (currency) => {
        const desc = extractLocalizedString(currency.description);
        return (
          <p className="text-muted-foreground truncate text-sm" title={desc}>
            {desc || "\u2014"}
          </p>
        );
      },
    },
    {
      key: "currencyType",
      header: "Type",
      render: (currency) =>
        currency.currencyType ? (
          <Badge variant="secondary" className="font-normal">
            {currency.currencyType.name ?? currency.currencyType.code}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    {
      key: "programIds",
      header: "Programs",
      render: (currency) => {
        const count = currency.programIds?.length ?? 0;
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
      render: (currency) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(currency.createdDateTime) ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "modifiedDateTime",
      header: "Modified",
      render: (currency) => (
        <span className="text-muted-foreground text-sm">
          {formatShortDate(currency.modifiedDateTime) ?? "\u2014"}
        </span>
      ),
    },
  ];
}
