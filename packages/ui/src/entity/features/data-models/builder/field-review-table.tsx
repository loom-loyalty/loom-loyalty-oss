/**
 * FieldReviewTable
 *
 * The builder's right pane. Whatever mode drafted the fields, they land here as
 * rows the user confirms. "AI proposes, human confirms" holds for paste and
 * sample input too.
 *
 * `onViewJsonSchema` is a callback, not local behavior: schema generation stays
 * in the orchestration layer so it can render nested preview rows appropriately.
 */

import { Braces, CheckCheck, Lock, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "../../../../primitives/badge.js";
import { Button } from "../../../../primitives/button.js";
import { FieldReviewRow } from "./field-review-row.js";
import { hasUnresolvedRows, type FieldReviewTableProps } from "./types.js";

export function FieldReviewTable({
  rows,
  typeOptions,
  onFieldChange,
  onFieldMarkAsNestedArray,
  onFieldDelete,
  onNestedTypeNameChange,
  onAddField,
  onNestedFieldChange,
  onNestedFieldDelete,
  onNestedFieldAdd,
  onAcceptAll,
  onViewJsonSchema,
  disabled = false,
}: FieldReviewTableProps): ReactNode {
  const unresolved = hasUnresolvedRows(rows);
  const unresolvedCount = rows.filter((row) => row.state === "needs-review-nested").length;
  const hasInherited = rows.some((row) => row.state === "inherited");

  return (
    <section aria-labelledby="builder-fields-heading" className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 id="builder-fields-heading" className="text-foreground text-sm font-semibold">
            Fields
          </h3>
          <Badge variant="secondary" className="font-mono tabular-nums">
            {rows.length}
          </Badge>
          {unresolvedCount > 0 ? (
            <Badge
              variant="outline"
              className="border-warning/30 bg-warning/15 text-warning-dark font-medium"
            >
              {unresolvedCount} need{unresolvedCount === 1 ? "s" : ""} review
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {onAcceptAll ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAcceptAll}
              disabled={disabled || rows.length === 0}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Accept all
            </Button>
          ) : null}
          {onViewJsonSchema ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewJsonSchema}
              disabled={disabled}
            >
              <Braces className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              View as JSON Schema
            </Button>
          ) : null}
        </div>
      </div>

      {hasInherited ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          Inherited from the parent type. Read-only here.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-md border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No fields yet. Draft them from the left, or add them one at a time.
          </p>
        </div>
      ) : (
        <div className="border-border rounded-md border">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-chrome-border bg-muted/50 border-b">
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-xs font-medium tracking-wide uppercase"
                >
                  Label
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground py-2 pr-3 text-xs font-medium tracking-wide uppercase"
                >
                  Field
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground w-[128px] py-2 pr-3 text-xs font-medium tracking-wide uppercase"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground w-[104px] py-2 pr-3 text-xs font-medium tracking-wide uppercase"
                >
                  Metric
                </th>
                <th
                  scope="col"
                  aria-label="Required"
                  className="text-chrome-muted-foreground w-[74px] py-2 pr-3 text-center text-xs font-medium tracking-wide uppercase"
                >
                  Req
                </th>
                <th scope="col" className="w-[30px] py-2 pr-3">
                  <span className="sr-only">Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <FieldReviewRow
                  key={row.field._rowKey ?? index}
                  row={row}
                  index={index}
                  typeOptions={typeOptions}
                  onFieldChange={(patch) => onFieldChange(index, patch)}
                  onMarkAsNestedArray={() => onFieldMarkAsNestedArray(index)}
                  onFieldDelete={() => onFieldDelete(index)}
                  onNestedTypeNameChange={(name) => onNestedTypeNameChange(index, name)}
                  onNestedFieldChange={(nestedIndex, patch) =>
                    onNestedFieldChange(index, nestedIndex, patch)
                  }
                  onNestedFieldDelete={(nestedIndex) => onNestedFieldDelete(index, nestedIndex)}
                  onNestedFieldAdd={() => onNestedFieldAdd(index)}
                  disabled={disabled}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddField}
          disabled={disabled}
          className="border-dashed"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Add field
        </Button>
        {unresolved ? (
          <p className="text-warning-dark text-xs" role="status">
            Declare the nested array&apos;s fields to finish this model.
          </p>
        ) : null}
      </div>
    </section>
  );
}
