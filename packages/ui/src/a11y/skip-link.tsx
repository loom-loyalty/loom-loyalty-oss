"use client";

import * as React from "react";

import { cn } from "../lib/utils";

export interface SkipLinkProps {
  /** Target element ID to skip to */
  targetId: string;
  /** Link text (default: "Skip to main content") */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Skip link component for keyboard navigation (WCAG 2.4.1).
 * Hidden by default, becomes visible on focus for keyboard users.
 */
export function SkipLink({
  targetId,
  children = "Skip to main content",
  className,
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only",
        "focus:fixed focus:top-4 focus:left-4 focus:z-[100]",
        "focus:bg-primary focus:text-primary-foreground",
        "focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg",
        "focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none",
        className
      )}
    >
      {children}
    </a>
  );
}
