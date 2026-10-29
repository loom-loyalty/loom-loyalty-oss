import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { z } from "zod";

import { cn } from "../../../lib/utils";
import { defineOpenUIComponent } from "../../types";

const alertConfig = {
  info: {
    icon: Info,
    containerClass: "border-primary/30 bg-primary/5",
    iconClass: "text-primary",
    titleClass: "text-primary-dark",
    messageClass: "text-foreground",
    role: "status" as const,
  },
  success: {
    icon: CheckCircle2,
    containerClass: "border-success/30 bg-success/5",
    iconClass: "text-success-dark",
    titleClass: "text-success-dark",
    messageClass: "text-foreground",
    role: "status" as const,
  },
  warning: {
    icon: TriangleAlert,
    containerClass: "border-accent/30 bg-accent/5",
    iconClass: "text-accent",
    titleClass: "text-accent-dark",
    messageClass: "text-foreground",
    role: "alert" as const,
  },
  error: {
    icon: AlertCircle,
    containerClass: "border-destructive/30 bg-destructive/5",
    iconClass: "text-destructive",
    titleClass: "text-destructive",
    messageClass: "text-foreground",
    role: "alert" as const,
  },
};

export const Alert = defineOpenUIComponent({
  name: "Alert",
  props: z.object({
    type: z.enum(["info", "success", "warning", "error"]),
    title: z.string(),
    message: z.string().optional(),
  }),
  description:
    "An alert banner for displaying informational, success, warning, or error messages. Uses semantic colors and appropriate ARIA roles.",
  component: ({ props }) => {
    const type = props.type ?? "info";
    const config = alertConfig[type];
    const Icon = config.icon;

    return (
      <div
        role={config.role}
        className={cn("flex gap-3 rounded-md border p-4", config.containerClass)}
      >
        <Icon className={cn("h-5 w-5 shrink-0", config.iconClass)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", config.titleClass)}>{props.title}</p>
          {props.message && (
            <p className={cn("mt-1 text-sm", config.messageClass)}>{props.message}</p>
          )}
        </div>
      </div>
    );
  },
});
