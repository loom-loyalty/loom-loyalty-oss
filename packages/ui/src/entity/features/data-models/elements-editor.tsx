/**
 * ElementsEditor
 *
 * The editable "Elements" table for a data model: a header with Add (and
 * optional Bulk Import) actions, an empty state, and a row-per-element table
 * whose rows open an editor on click. Presentational — it renders the current
 * `elements` and calls back on add/edit/delete; the parent owns the element list
 * state and renders the actual `ElementDialog` / `BulkElementImportDialog`.
 *
 * Extracted from DataModelFormSheet so any surface editing a model's elements
 * shares ONE elements editor (no second entry UI). Omit `onBulkImport` to hide
 * the Bulk Import action.
 */

import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import { Label } from "../../../primitives/label.js";
import { SystemElementBadge } from "./system-element-badge.js";
import type { DataModelElementFormData } from "./types.js";

export interface ElementsEditorProps {
  elements: DataModelElementFormData[];
  onAddElement: () => void;
  onEditElement: (index: number) => void;
  onDeleteElement: (index: number) => void;
  /** When provided, renders a Bulk Import action alongside Add Element. */
  onBulkImport?: () => void;
  disabled?: boolean;
}

export function ElementsEditor({
  elements,
  onAddElement,
  onEditElement,
  onDeleteElement,
  onBulkImport,
  disabled = false,
}: ElementsEditorProps): ReactNode {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Elements{" "}
          <span className="text-muted-foreground font-mono text-xs normal-case">
            ({elements.length})
          </span>
        </Label>
        <div className="flex items-center gap-2">
          {onBulkImport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBulkImport}
              disabled={disabled}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Bulk Import
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddElement}
            disabled={disabled}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Add Element
          </Button>
        </div>
      </div>

      {elements.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-md border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No elements yet. Add one to define this schema.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onAddElement}
            disabled={disabled}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Add First Element
          </Button>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="border-chrome-border border-b">
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Attribute
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  Required
                </th>
                <th scope="col" aria-label="Actions" className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {elements.map((el, idx) => (
                <tr
                  key={el._rowKey ?? `row-${idx}`}
                  className={cn(
                    "border-border/60 border-t transition-colors",
                    idx === 0 && "border-t-0"
                  )}
                >
                  <td className="text-foreground px-3 py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      {el.name}
                      {el.system && <SystemElementBadge />}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                    {el.inputAttribute || "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                    {el.typeCode}
                    {el.isArray && <span className="text-muted-foreground">[]</span>}
                  </td>
                  <td className="px-3 py-2">
                    {el.required ? (
                      <span className="text-success-dark text-xs">Yes</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {/* System elements are platform-managed: the API refuses to
                        update or delete them, so they get no row actions. */}
                    {el.system ? null : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditElement(idx);
                          }}
                          aria-label={`Edit ${el.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-11 w-11"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteElement(idx);
                          }}
                          aria-label={`Delete ${el.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
