import { useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";

import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import { defineOpenUIComponent } from "../../types";

export const RuleTemplate = defineOpenUIComponent({
  name: "RuleTemplate",
  props: z.object({
    templates: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string().optional(),
      })
    ),
    selectedId: z.string().optional(),
  }),
  description:
    "A grid of selectable rule template cards. Each template shows a name, description, and optional category. Used for selecting loyalty program rules.",
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const templates = props.templates ?? [];

    const handleSelect = (template: { id: string; name: string }) => {
      triggerAction(`Select template: ${template.name}`, undefined, {
        type: "select-template",
        params: { id: template.id },
      });
    };

    return (
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Rule templates"
      >
        {templates.map((template) => {
          const isSelected = props.selectedId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(template)}
              className={cn(
                "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-primary" : "text-foreground"
                  )}
                >
                  {template.name}
                </p>
                {template.category && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {template.category}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{template.description}</p>
            </button>
          );
        })}
        {templates.length === 0 && (
          <p className="text-muted-foreground col-span-full py-4 text-center text-sm" role="status">
            No templates available
          </p>
        )}
      </div>
    );
  },
});
