import { useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";

import { Button } from "../../../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../primitives/tooltip";
import { defineOpenUIComponent } from "../../types";

export const FollowUp = defineOpenUIComponent({
  name: "FollowUp",
  props: z.object({
    title: z.string().optional(),
    suggestions: z.array(
      z.object({
        label: z.string(),
        action: z.string(),
        description: z.string().optional(),
      })
    ),
  }),
  description:
    "A group of suggested follow-up action buttons. Each button triggers a specific action. Use to guide users to next steps after an operation.",
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const suggestions = props.suggestions ?? [];

    return (
      <div className="space-y-3">
        {props.title && <p className="text-foreground text-sm font-medium">{props.title}</p>}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={props.title ?? "Suggested actions"}
        >
          {suggestions.map((suggestion) => {
            const button = (
              <Button
                key={suggestion.action}
                variant="outline"
                size="sm"
                onClick={() => triggerAction(suggestion.action)}
              >
                {suggestion.label}
              </Button>
            );

            if (suggestion.description) {
              return (
                <Tooltip key={suggestion.action}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent>{suggestion.description}</TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </div>
      </div>
    );
  },
});
