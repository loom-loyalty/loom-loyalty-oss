import type { LucideIcon } from "lucide-react";
import { z } from "zod";

import { StatCard as StatCardPrimitive } from "../../../data-display/stat-card";
import { defineOpenUIComponent, resolveIcon } from "../../types";

export const StatCard = defineOpenUIComponent({
  name: "StatCard",
  props: z.object({
    title: z.string(),
    value: z.string(),
    subtitle: z.string().optional(),
    trend: z
      .object({
        value: z.string(),
        direction: z.enum(["up", "down", "neutral"]),
      })
      .optional(),
    variant: z.enum(["primary", "secondary", "success", "accent"]).optional(),
    icon: z.string().optional(),
  }),
  description:
    "A gradient stat card for displaying a key metric with optional trend indicator. Use for dashboards and summary views.",
  component: ({ props }) => {
    const Icon = resolveIcon(props.icon) as LucideIcon;

    return (
      <StatCardPrimitive
        title={props.title ?? ""}
        value={props.value ?? ""}
        subtitle={props.subtitle}
        icon={Icon}
        trend={props.trend}
        variant={props.variant ?? "primary"}
      />
    );
  },
});
