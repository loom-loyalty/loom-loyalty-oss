"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Actions to display on the right side (e.g., buttons) */
  actions?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * Consistent page header component for dashboard pages.
 * Displays a title, optional description, and optional action buttons.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div>
        <h1 className="text-foreground text-2xl font-semibold">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
