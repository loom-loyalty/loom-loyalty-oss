"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";

export interface EmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Call-to-action button text */
  actionLabel?: string;
  /** Call-to-action click handler */
  onAction?: () => void;
  /** Icon for the action button */
  actionIcon?: LucideIcon;
  /** Additional className */
  className?: string;
}

/**
 * Empty state component for displaying when no data is available.
 * Used across list pages when there are no items to display.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-4 py-12 text-center", className)}
      role="status"
      aria-label={title}
    >
      <div className="bg-muted rounded-full p-4">
        <Icon className="text-muted-foreground h-8 w-8" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-foreground font-serif text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="primary-gradient" onClick={onAction}>
          {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" aria-hidden="true" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
