"use client";

import type { ReactNode } from "react";

import { CompletionTargetCard } from "./completion-target-card";
import { CounterTargetCard } from "./counter-target-card";
import { MilestoneTargetCard } from "./milestone-target-card";
import type { EntityTargetCardProps, TargetCardInput } from "./types";
import { XOfYTargetCard } from "./x-of-y-target-card";

export type { EntityTargetCardProps } from "./types";

/**
 * EntityTargetCard is a discriminator component that routes to the correct
 * target card subtype based on the target type.
 *
 * Supported target types:
 * - COMPLETION: Binary completion targets
 * - COUNTER: Numeric counter targets with optional cycles
 * - MILESTONE: Multi-step milestone targets
 * - X_OF_Y: X of Y items completion targets
 *
 * Features:
 * - Automatic type discrimination
 * - Consistent API across all target types
 * - Extension point via renderCard prop
 * - WCAG 2.1 AA accessible
 */
export function EntityTargetCard({
  target,
  progress,
  onClick,
  onCelebrate,
  variant = "default",
  renderCard,
  className,
}: EntityTargetCardProps): ReactNode {
  // Get the default render based on target type
  const getDefaultRender = (): ReactNode => {
    switch (target.type) {
      case "COMPLETION":
        return (
          <CompletionTargetCard
            target={target}
            progress={progress}
            onClick={onClick}
            onCelebrate={onCelebrate}
            variant={variant}
            className={className}
          />
        );
      case "COUNTER":
        return (
          <CounterTargetCard
            target={target}
            progress={progress}
            onClick={onClick}
            variant={variant}
            className={className}
          />
        );
      case "MILESTONE":
        return (
          <MilestoneTargetCard
            target={target}
            progress={progress}
            onClick={onClick}
            variant={variant}
            className={className}
          />
        );
      case "X_OF_Y":
        return (
          <XOfYTargetCard
            target={target}
            progress={progress}
            onClick={onClick}
            variant={variant}
            className={className}
          />
        );
      default:
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[EntityTargetCard] Unknown target type: ${(target as TargetCardInput).type}`
          );
        }
        return null;
    }
  };

  const defaultRender = getDefaultRender();

  // If custom render function is provided, use it
  if (renderCard) {
    return renderCard(target, progress, defaultRender);
  }

  return defaultRender;
}
