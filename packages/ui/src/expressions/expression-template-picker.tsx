/**
 * Expression Template Picker
 *
 * A row of starter-template cards shown on an empty expression draft (e.g.
 * "Lapsed customers", "Birthday today" for audience segments). Picking one
 * hands its expression back to the caller, which loads it into the draft; the
 * user still edits and saves as normal.
 */

import { useId, type ReactNode } from "react";

import { cn } from "../lib/utils.js";
import type { Expression, ExpressionTemplate } from "./types.js";

export interface ExpressionTemplatePickerProps {
  templates: ExpressionTemplate[];
  onSelect: (expression: Expression) => void;
  disabled?: boolean;
  className?: string;
}

export function ExpressionTemplatePicker({
  templates,
  onSelect,
  disabled,
  className,
}: ExpressionTemplatePickerProps): ReactNode {
  const headingId = useId();
  if (templates.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cn("space-y-2", className)}>
      <h3
        id={headingId}
        className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase"
      >
        Start from a template
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onSelect(template.expression)}
              disabled={disabled}
              className={cn(
                "border-border bg-card hover:border-primary hover:bg-muted/40 flex h-full min-h-11 w-full flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors motion-reduce:transition-none",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              <span className="text-foreground text-sm font-semibold">{template.label}</span>
              <span className="text-muted-foreground text-xs">{template.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
