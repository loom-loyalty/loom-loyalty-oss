"use client";

import type { ComponentType, ReactNode } from "react";
import { useId } from "react";

import { useReducedMotion } from "../a11y/use-reduced-motion";
import { cn } from "../lib/utils";

export interface FormSectionProps {
  /** Section icon */
  icon?: ComponentType<{ className?: string }>;
  /** Section title */
  title: string;
  /** Optional description */
  description?: string;
  /** Collapse state (for conditional sections) */
  collapsed?: boolean;
  /** Animation on expand/collapse */
  animate?: boolean;
  /** Children content */
  children: ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * Semantic section container for grouping related form fields.
 * Supports collapsible content with smooth animations.
 *
 * @example
 * ```tsx
 * <FormSection
 *   icon={Clock}
 *   title="Expiration Settings"
 *   description="Configure when points expire"
 *   collapsed={!hasExpiration}
 * >
 *   <ExpirationFields />
 * </FormSection>
 * ```
 */
export function FormSection({
  icon: Icon,
  title,
  description,
  collapsed = false,
  animate = true,
  children,
  className,
}: FormSectionProps) {
  const id = useId();
  const contentId = `${id}-content`;
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <section className={cn("space-y-4", className)} aria-labelledby={`${id}-title`}>
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="text-primary h-5 w-5 flex-shrink-0" aria-hidden="true" />}
          <h3 id={`${id}-title`} className="text-foreground text-base font-semibold">
            {title}
          </h3>
        </div>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </header>

      {/* Collapsible Content */}
      <div
        id={contentId}
        className={cn(
          "grid overflow-hidden",
          shouldAnimate && "transition-[grid-template-rows] duration-300 ease-out",
          collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
        aria-hidden={collapsed}
      >
        <div className={cn("min-h-0", collapsed && "invisible")}>
          <div className="space-y-4 p-px">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * Variant with a card-like appearance
 */
export interface FormSectionCardProps extends FormSectionProps {
  /** Show border around section */
  bordered?: boolean;
}

export function FormSectionCard({ bordered = true, className, ...props }: FormSectionCardProps) {
  return (
    <FormSection
      {...props}
      className={cn(bordered && "bg-card rounded-lg border p-4", className)}
    />
  );
}
