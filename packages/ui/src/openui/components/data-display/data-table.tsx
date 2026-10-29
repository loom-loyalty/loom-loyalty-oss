import { z } from "zod";

import { cn } from "../../../lib/utils";
import { defineOpenUIComponent } from "../../types";

export const DataTable = defineOpenUIComponent({
  name: "DataTable",
  props: z.object({
    columns: z.array(
      z.object({
        key: z.string(),
        header: z.string(),
      })
    ),
    rows: z.array(z.record(z.string(), z.string())),
  }),
  description:
    "A simple data table for displaying rows of key-value data. Use for structured data presentation with column headers.",
  component: ({ props }) => {
    const columns = props.columns ?? [];
    const rows = props.rows ?? [];

    if (columns.length === 0) {
      return (
        <p className="text-muted-foreground py-4 text-center text-sm" role="status">
          No columns configured
        </p>
      );
    }

    return (
      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full text-sm" aria-label="Data table">
          <thead>
            <tr className="border-chrome-border bg-muted/50 border-b">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-chrome-muted-foreground px-4 py-2.5 text-left font-medium"
                  scope="col"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  No data available
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={columns.map((col) => row[col.key]).join("-") || rowIndex}
                  className={cn(
                    "border-border border-b last:border-0",
                    rowIndex % 2 === 1 && "bg-muted/50"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="text-foreground px-4 py-2.5">
                      {row[col.key] ?? ""}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  },
});
