import { useTriggerAction } from "@openuidev/react-lang";
import { useState } from "react";
import { z } from "zod";

import { Badge } from "../../../primitives/badge";
import { Switch } from "../../../primitives/switch";
import { defineOpenUIComponent } from "../../types";

export const FeatureCard = defineOpenUIComponent({
  name: "FeatureCard",
  props: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    enabled: z.boolean().optional(),
    recommended: z.boolean().optional(),
  }),
  description:
    "A card for toggling a feature on/off. Includes a title, description, toggle switch, and optional recommended badge. Used in onboarding and configuration flows.",
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const [enabled, setEnabled] = useState(props.enabled ?? false);

    const handleToggle = (checked: boolean) => {
      setEnabled(checked);
      triggerAction(`${checked ? "Enable" : "Disable"} feature: ${props.title}`, undefined, {
        type: "toggle-feature",
        params: { id: props.id, enabled: checked },
      });
    };

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleToggle(!enabled)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle(!enabled);
          }
        }}
        className={[
          "group flex w-full cursor-pointer items-center gap-4 rounded-lg border px-5 py-4 text-left transition-all duration-150 ease-out",
          enabled
            ? "border-primary/30 bg-primary/[0.03] shadow-hover"
            : "border-border bg-card hover:shadow-hover shadow-sm",
        ].join(" ")}
        aria-pressed={enabled}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-serif text-base font-semibold">
              {props.title}
            </span>
            {props.recommended && <Badge variant="success">Recommended</Badge>}
          </div>
          {props.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{props.description}</p>
          )}
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          aria-label={`Toggle ${props.title}`}
          tabIndex={-1}
          className="pointer-events-none shrink-0"
        />
      </div>
    );
  },
});
