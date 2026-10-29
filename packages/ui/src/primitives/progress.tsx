"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../lib/utils";

const progressVariants = cva("relative h-2 w-full overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      sm: "h-1.5",
      default: "h-2",
      lg: "h-3",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const indicatorVariants = cva("h-full w-full flex-1 transition-all", {
  variants: {
    variant: {
      default: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
      accent: "bg-accent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ProgressProps
  extends
    React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof indicatorVariants> {
  /** Current progress value (0-100 or 0-max) */
  value?: number;
  /** Maximum value (defaults to 100) */
  max?: number;
}

/**
 * Progress bar component built on Radix UI.
 * Supports multiple color variants and sizes.
 *
 * @example
 * ```tsx
 * <Progress value={60} />
 * <Progress value={85} variant="warning" />
 * <Progress value={100} variant="destructive" />
 * ```
 */
function Progress({ className, value = 0, max = 100, variant, size, ...props }: ProgressProps) {
  // Clamp value between 0 and max
  const clampedValue = Math.min(Math.max(0, value), max);
  const percentage = (clampedValue / max) * 100;

  return (
    <ProgressPrimitive.Root
      className={cn(progressVariants({ size }), className)}
      value={clampedValue}
      max={max}
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={max}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(indicatorVariants({ variant }))}
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { indicatorVariants, Progress, progressVariants };
