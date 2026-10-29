import { z } from "zod";

import { Badge } from "../../../primitives/badge";
import { defineOpenUIComponent } from "../../types";

const variantMap: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "error" | "info"
> = {
  default: "default",
  primary: "default",
  secondary: "secondary",
  success: "success",
  accent: "default",
  destructive: "destructive",
  warning: "warning",
  error: "error",
  info: "info",
  outline: "outline",
};

export const BadgeGroup = defineOpenUIComponent({
  name: "BadgeGroup",
  props: z.object({
    badges: z.array(
      z.object({
        label: z.string(),
        variant: z
          .enum([
            "default",
            "primary",
            "secondary",
            "success",
            "accent",
            "destructive",
            "warning",
            "error",
            "info",
            "outline",
          ])
          .optional(),
      })
    ),
  }),
  description:
    "A horizontal group of badge labels. Use for displaying tags, statuses, or categories together.",
  component: ({ props }) => {
    const badges = props.badges ?? [];

    return (
      <div className="flex flex-wrap gap-2" role="list" aria-label="Badges">
        {badges.map((badge, index) => (
          <Badge
            key={index}
            variant={variantMap[badge.variant ?? "default"] ?? "default"}
            role="listitem"
          >
            {badge.label}
          </Badge>
        ))}
      </div>
    );
  },
});
