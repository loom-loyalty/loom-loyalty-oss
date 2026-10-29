import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        // Soft tint: white on solid secondary (#0891b2) is 3.7:1 and fails WCAG AA at 12px.
        secondary: "border-transparent bg-primary/10 text-primary-dark hover:bg-primary/15",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Loom-specific variants using semantic tokens
        teal: "border-transparent bg-primary text-primary-foreground",
        // Soft tints: white on solid emerald (3.8:1) or gold (2.2:1) fails WCAG AA at 12px.
        emerald: "border-transparent bg-status-active-bg text-status-active-fg",
        gold: "border-transparent bg-status-pending-bg text-status-pending-fg",
        success: "border-transparent bg-status-active-bg text-status-active-fg",
        warning: "border-transparent bg-status-pending-bg text-status-pending-fg",
        error: "border-transparent bg-status-error-bg text-status-error-fg",
        info: "border-transparent bg-status-trial-bg text-status-trial-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Render a leading status dot in the badge's text color. */
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
