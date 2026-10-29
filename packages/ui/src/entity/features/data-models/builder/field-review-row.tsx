/**
 * FieldReviewRow
 *
 * One row of the field review table, switched on `row.state`:
 * - `inherited`: muted, lock icon (see the table's legend for what it means),
 *   read-only, no row action. The icon is decorative; an sr-only "Inherited."
 *   carries the meaning for assistive tech.
 * - `editable`: editable name and attribute, inline Type select, Required
 *   checkbox, delete.
 * - `needs-review-nested`: warning-tinted with a warning triangle and an
 *   expanded child table for the array's own fields.
 */

import { AlertTriangle, Lock, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "../../../../lib/utils.js";
import { Button } from "../../../../primitives/button.js";
import { Checkbox } from "../../../../primitives/checkbox.js";
import { Input } from "../../../../primitives/input.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../primitives/select.js";
import { MetricRoleSelect } from "../metric-role-select.js";
import { isMetricRoleEligibleType } from "../types.js";
import { NestedFieldSubtable } from "./nested-field-subtable.js";
import type { FieldReviewRowProps } from "./types.js";

export const ARRAY_OF_OBJECTS_SENTINEL = "__ARRAY_OF_OBJECTS__";

export function FieldReviewRow({
  row,
  index,
  typeOptions,
  onFieldChange,
  onMarkAsNestedArray,
  onFieldDelete,
  onNestedTypeNameChange,
  onNestedFieldChange,
  onNestedFieldDelete,
  onNestedFieldAdd,
  disabled = false,
}: FieldReviewRowProps): ReactNode {
  const [nestedOpen, setNestedOpen] = useState(true);

  const { field, state } = row;
  const inherited = state === "inherited";
  const needsReview = state === "needs-review-nested";
  const rowLabel = field.name || `field ${index + 1}`;

  return (
    <>
      <tr
        data-row-state={state}
        className={cn(
          "border-border border-b align-middle",
          inherited && "text-muted-foreground bg-muted/40",
          needsReview && "bg-warning/10"
        )}
      >
        <td className="py-2 pr-3 pl-3">
          <div className="flex items-center gap-1.5">
            {inherited ? (
              <>
                <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">Inherited.</span>
              </>
            ) : null}
            {needsReview ? (
              <AlertTriangle className="text-warning-dark h-3 w-3 shrink-0" aria-hidden="true" />
            ) : null}

            {inherited ? (
              <span className="min-w-0 flex-1 truncate text-xs" title={field.name}>
                {field.name}
              </span>
            ) : (
              <Input
                aria-label={`Field ${index + 1} name`}
                value={field.name}
                onChange={(event) => onFieldChange({ name: event.target.value })}
                disabled={disabled}
                className="h-8 flex-1 px-2 text-xs md:text-xs"
              />
            )}
          </div>
        </td>

        <td className="py-2 pr-3">
          {inherited ? (
            <span className="text-muted-foreground block truncate px-1 font-mono text-[10px]">
              {field.inputAttribute}
            </span>
          ) : (
            <Input
              aria-label={`Field ${index + 1} attribute`}
              value={field.inputAttribute ?? ""}
              onChange={(event) => onFieldChange({ inputAttribute: event.target.value })}
              disabled={disabled}
              placeholder="attributeName"
              className="bg-muted/40 h-8 w-full px-2 font-mono text-[10px] md:text-[10px]"
            />
          )}
        </td>

        <td className="w-[128px] py-2 pr-3">
          {inherited ? (
            <span className="text-muted-foreground font-mono text-[11px]">{field.typeCode}</span>
          ) : (
            <Select
              value={field.typeCode}
              onValueChange={(typeCode) => {
                if (typeCode === ARRAY_OF_OBJECTS_SENTINEL) {
                  onMarkAsNestedArray();
                  return;
                }
                onFieldChange({ typeCode });
              }}
              disabled={disabled}
            >
              <SelectTrigger
                aria-label={`Type for ${rowLabel}`}
                className={cn("h-8 px-2 text-[11px]", needsReview && "border-warning-dark")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.code} value={option.code} className="py-1 pl-6 text-xs">
                    {option.label}
                  </SelectItem>
                ))}
                <SelectItem value={ARRAY_OF_OBJECTS_SENTINEL} className="py-1 pl-6 text-xs">
                  Array of objects...
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </td>

        <td className="w-[104px] py-2 pr-3">
          {!inherited && isMetricRoleEligibleType(field.typeCode) ? (
            <MetricRoleSelect
              id={`field-${index}-metric-role`}
              value={field.metricRole}
              disabled={disabled}
              onChange={(metricRole) => onFieldChange({ metricRole })}
              ariaLabel={`Metric role for ${rowLabel}`}
              triggerClassName="h-8 px-2 text-[11px]"
              itemClassName="py-1 pl-6 text-xs"
            />
          ) : (
            <span className="text-muted-foreground/60 block px-1 text-[11px]" aria-hidden="true">
              —
            </span>
          )}
        </td>

        <td className="w-[74px] py-2 pr-3 text-center">
          <Checkbox
            checked={field.required ?? false}
            onCheckedChange={(checked) => onFieldChange({ required: checked === true })}
            disabled={disabled || inherited}
            aria-label={`Required for ${rowLabel}`}
          />
        </td>

        <td className="w-[30px] py-2 pr-3">
          {inherited ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onFieldDelete}
              disabled={disabled}
              aria-label={`Delete ${rowLabel}`}
            >
              <Trash2 className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </td>
      </tr>

      {needsReview ? (
        <tr
          data-row-state="needs-review-nested-detail"
          className="border-border bg-warning/10 border-b"
        >
          <td colSpan={6} className="px-3 pb-3">
            <NestedFieldSubtable
              rows={row.nested ?? []}
              typeOptions={typeOptions}
              open={nestedOpen}
              onOpenChange={setNestedOpen}
              typeName={row.nestedTypeName ?? ""}
              onTypeNameChange={onNestedTypeNameChange}
              onFieldChange={onNestedFieldChange}
              onFieldDelete={onNestedFieldDelete}
              onAddField={onNestedFieldAdd}
              disabled={disabled}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}
