/**
 * NestedFieldSubtable
 *
 * The child-field editor for a nested array row. Rules can only read into an
 * array whose element shape is declared, so this is where that shape gets
 * declared. Collapsible, open by default.
 */

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../../../primitives/button.js";
import { Checkbox } from "../../../../primitives/checkbox.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../primitives/collapsible.js";
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
import type { NestedFieldSubtableProps } from "./types.js";

export function NestedFieldSubtable({
  rows,
  typeName,
  typeOptions,
  open,
  onOpenChange,
  onTypeNameChange,
  onFieldChange,
  onFieldDelete,
  onAddField,
  disabled = false,
}: NestedFieldSubtableProps): ReactNode {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 px-1.5"
        >
          {open ? (
            <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          )}
          Nested fields ({rows.length}): declare so rules can read them
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {/* Indented and boxed so the child rows read as a sub-table inside the
            parent row, not as peer rows stacked under it. */}
        <div className="border-warning/30 bg-background mt-2 ml-6 space-y-2 rounded-md border p-2">
          <label className="block space-y-1">
            <span className="text-foreground text-xs font-medium">Type name</span>
            <Input
              value={typeName}
              onChange={(event) => onTypeNameChange(event.target.value)}
              disabled={disabled}
              placeholder="Line Item"
              className="h-8 w-full px-2 text-xs md:text-xs"
            />
          </label>

          {rows.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">No nested fields declared yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((row, nestedIndex) => (
                <li
                  key={row.field._rowKey ?? nestedIndex}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_128px_104px_74px_30px] items-center gap-2"
                >
                  <Input
                    aria-label={`Nested field ${nestedIndex + 1} name`}
                    value={row.field.name}
                    onChange={(event) => onFieldChange(nestedIndex, { name: event.target.value })}
                    disabled={disabled}
                    className="h-8 w-full px-2 text-xs md:text-xs"
                  />
                  <Input
                    aria-label={`Nested field ${nestedIndex + 1} attribute`}
                    value={row.field.inputAttribute ?? ""}
                    onChange={(event) =>
                      onFieldChange(nestedIndex, { inputAttribute: event.target.value })
                    }
                    disabled={disabled}
                    placeholder="attributeName"
                    className="bg-muted/40 h-8 w-full px-2 font-mono text-[10px] md:text-[10px]"
                  />
                  <Select
                    value={row.field.typeCode}
                    onValueChange={(typeCode) => onFieldChange(nestedIndex, { typeCode })}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className="h-8 px-2 text-[11px]"
                      aria-label={`Type for nested field ${row.field.name || nestedIndex + 1}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((option) => (
                        <SelectItem
                          key={option.code}
                          value={option.code}
                          className="py-1 pl-6 text-xs"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isMetricRoleEligibleType(row.field.typeCode) ? (
                    <MetricRoleSelect
                      id={`nested-field-${nestedIndex}-metric-role`}
                      value={row.field.metricRole}
                      disabled={disabled}
                      onChange={(metricRole) => onFieldChange(nestedIndex, { metricRole })}
                      ariaLabel={`Metric role for nested field ${row.field.name || nestedIndex + 1}`}
                      triggerClassName="h-8 px-2 text-[11px]"
                      itemClassName="py-1 pl-6 text-xs"
                    />
                  ) : (
                    <span
                      className="text-muted-foreground/60 block px-1 text-[11px]"
                      aria-hidden="true"
                    >
                      —
                    </span>
                  )}
                  <div className="flex justify-center">
                    <Checkbox
                      checked={row.field.required ?? false}
                      onCheckedChange={(checked) =>
                        onFieldChange(nestedIndex, { required: checked === true })
                      }
                      disabled={disabled}
                      aria-label={`Required for nested field ${row.field.name || nestedIndex + 1}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onFieldDelete(nestedIndex)}
                    disabled={disabled}
                    aria-label={`Delete nested field ${row.field.name || nestedIndex + 1}`}
                  >
                    <Trash2 className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddField}
            disabled={disabled}
            className="h-7"
          >
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Add nested field
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
