"use client";

import * as React from "react";

export interface VisuallyHiddenProps {
  /** Content to hide visually but keep accessible to screen readers */
  children: React.ReactNode;
  /** HTML element to render as (default: "span") */
  as?: React.ElementType;
}

/**
 * Visually hidden component for screen reader only content.
 * Content is hidden visually but remains accessible to assistive technologies.
 */
export function VisuallyHidden({ children, as: Component = "span" }: VisuallyHiddenProps) {
  return <Component className="sr-only">{children}</Component>;
}
