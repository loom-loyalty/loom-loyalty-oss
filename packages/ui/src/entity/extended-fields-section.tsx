/**
 * ExtendedFieldsSection
 *
 * Renders additional fields from data model extensions in a collapsible section.
 * Used in hybrid entity pages to display fields beyond the standard rich UI fields.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { Button } from "../primitives/button.js";

import { EntityField } from "./entity-field.js";

export interface ExtendedFieldsSectionProps {
  /** UI schema containing field configurations */
  schema: UIEntitySchema;
  /** Field names to render (extended fields only) */
  fields: string[];
  /** Entity data containing field values (accepts SDK types directly) */
  data: object;
  /** Display mode */
  mode: "view" | "edit";
  /** Callback when a field value changes (edit mode) */
  onChange?: (field: string, value: unknown) => void;
  /** Section title */
  title?: string;
  /** Whether the section is initially collapsed */
  defaultCollapsed?: boolean;
  /** Whether to hide the section when there are no fields */
  hideWhenEmpty?: boolean;
}

/**
 * Renders extended fields in a collapsible section
 */
export function ExtendedFieldsSection({
  schema,
  fields,
  data,
  mode,
  onChange,
  title = "Additional Information",
  defaultCollapsed = false,
  hideWhenEmpty = true,
}: ExtendedFieldsSectionProps): ReactNode {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const panelId = useId();

  // Build a field value lookup from the entity using Object.entries()
  // This avoids unsafe casts — Object.entries() works on any object type
  const fieldValues = useMemo(() => Object.fromEntries(Object.entries(data)), [data]);

  // Filter to fields that exist in the schema. In edit (write) mode, restrict to
  // INPUT fields — output-only fields (readonly in the data model: no
  // inputAttribute / outputOnly, surfaced as showInCreate/showInEdit=false) are
  // a read-side concern and must never appear in a create/edit form. View (read)
  // mode shows every extension field, including output-only ones.
  const validFields = fields.filter((fieldName) => {
    const field = schema.fields[fieldName];
    if (!field) return false;
    if (mode === "edit") return field.showInCreate || field.showInEdit;
    return true;
  });

  // Hide if no valid fields and hideWhenEmpty is true
  if (hideWhenEmpty && validFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" data-extended-section>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border p-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground text-xs">
            ({validFields.length} field{validFields.length !== 1 ? "s" : ""})
          </span>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "text-muted-foreground h-4 w-4 motion-safe:transition-transform motion-safe:duration-200",
            isOpen && "rotate-180"
          )}
        />
      </Button>
      <div
        id={panelId}
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={cn(
          "overflow-hidden motion-safe:transition-all motion-safe:duration-200",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-4 px-4 pt-2 pb-4">
          {validFields.map((fieldName) => {
            const fieldConfig = schema.fields[fieldName];
            if (!fieldConfig) return null;

            return (
              <EntityField
                key={fieldName}
                field={fieldConfig}
                value={fieldValues[fieldName]}
                mode={mode}
                onChange={onChange ? (value: unknown) => onChange(fieldName, value) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Non-collapsible version for inline use
 */
export interface ExtendedFieldsInlineProps {
  /** UI schema containing field configurations */
  schema: UIEntitySchema;
  /** Field names to render */
  fields: string[];
  /** Entity data containing field values (accepts SDK types directly) */
  data: object;
  /** Display mode */
  mode: "view" | "edit";
  /** Callback when a field value changes (edit mode) */
  onChange?: (field: string, value: unknown) => void;
}

export function ExtendedFieldsInline({
  schema,
  fields,
  data,
  mode,
  onChange,
}: ExtendedFieldsInlineProps): ReactNode {
  // Build a field value lookup from the entity using Object.entries()
  const fieldValues = useMemo(() => Object.fromEntries(Object.entries(data)), [data]);

  // Filter to fields that exist in the schema. In edit (write) mode, restrict to
  // INPUT fields — output-only fields (readonly in the data model: no
  // inputAttribute / outputOnly, surfaced as showInCreate/showInEdit=false) are
  // a read-side concern and must never appear in a create/edit form. View (read)
  // mode shows every extension field, including output-only ones.
  const validFields = fields.filter((fieldName) => {
    const field = schema.fields[fieldName];
    if (!field) return false;
    if (mode === "edit") return field.showInCreate || field.showInEdit;
    return true;
  });

  if (validFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {validFields.map((fieldName) => {
        const fieldConfig = schema.fields[fieldName];
        if (!fieldConfig) return null;

        return (
          <EntityField
            key={fieldName}
            field={fieldConfig}
            value={fieldValues[fieldName]}
            mode={mode}
            onChange={onChange ? (value: unknown) => onChange(fieldName, value) : undefined}
          />
        );
      })}
    </div>
  );
}
