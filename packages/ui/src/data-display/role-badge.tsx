"use client";

import { cn } from "../lib/utils";

export interface RoleBadgeProps {
  /** Role name to display */
  role: string;
  /** Badge variant */
  variant?: "default" | "outline";
  /** Additional className */
  className?: string;
}

/**
 * Style map for common role names.
 * Uses semantic color tokens — never hardcoded colors.
 */
const roleStyles: Record<string, { default: string; outline: string }> = {
  owner: {
    default: "bg-primary text-primary-foreground",
    outline: "border-primary/30 text-primary",
  },
  admin: {
    default: "bg-accent text-accent-foreground",
    outline: "border-accent/30 text-accent",
  },
  member: {
    default: "bg-success/15 text-success-dark",
    outline: "border-success/30 text-success-dark",
  },
  viewer: {
    default: "bg-muted text-muted-foreground",
    outline: "border-border text-muted-foreground",
  },
};

const defaultStyle = {
  default: "bg-muted text-muted-foreground",
  outline: "border-border text-muted-foreground",
};

/**
 * Colored badge for role names.
 * Maps common roles (Owner, Admin, Member, Viewer) to semantic color variants.
 * Unknown roles fall back to a neutral muted style.
 * Includes ARIA attributes for accessibility (WCAG 2.1 AA).
 *
 * @example
 * ```tsx
 * <RoleBadge role="Admin" />
 * <RoleBadge role="Viewer" variant="outline" />
 * ```
 */
export function RoleBadge({ role, variant = "default", className }: RoleBadgeProps) {
  const roleKey = role.toLowerCase();
  const styles = roleStyles[roleKey] || defaultStyle;
  const style = styles[variant];

  return (
    <span
      role="status"
      aria-label={`Role: ${role}`}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variant === "outline" && "border",
        style,
        className
      )}
    >
      {role}
    </span>
  );
}
