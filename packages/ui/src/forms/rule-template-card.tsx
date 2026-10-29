"use client";

import { Check } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";

/**
 * Template definition for rule selection cards
 */
export interface RuleTemplate {
  /** Unique template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon component */
  icon: ComponentType<{ className?: string }>;
  /** Category for grouping */
  category: string;
  /** Example text showing what the rule does */
  example?: string;
}

export interface RuleTemplateCardProps {
  /** Template to display */
  template: RuleTemplate;
  /** Whether this card is selected */
  selected: boolean;
  /** Called when card is clicked */
  onSelect: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Selectable card for rule template selection.
 * Displays icon, name, description, and category badge.
 *
 * @example
 * ```tsx
 * <RuleTemplateCard
 *   template={{
 *     id: "points-per-dollar",
 *     name: "Points per Dollar",
 *     description: "Award points based on purchase amount",
 *     icon: ShoppingCart,
 *     category: "earn",
 *     example: "Earn 10 points for every $1 spent",
 *   }}
 *   selected={selectedId === "points-per-dollar"}
 *   onSelect={() => setSelectedId("points-per-dollar")}
 * />
 * ```
 */
export function RuleTemplateCard({
  template,
  selected,
  onSelect,
  disabled = false,
  className,
}: RuleTemplateCardProps) {
  const { icon: Icon, name, description, category, example } = template;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-all",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/50 hover:shadow-md",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="bg-primary absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Category badge */}
      <Badge
        variant="secondary"
        className={cn("text-xs capitalize", selected && "bg-primary/10 text-primary")}
      >
        {category}
      </Badge>

      {/* Icon */}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          selected
            ? "bg-primary text-white"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="space-y-1">
        <h4
          className={cn(
            "font-semibold transition-colors",
            selected ? "text-primary" : "text-foreground"
          )}
        >
          {name}
        </h4>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {/* Example */}
      {example && (
        <p
          className={cn(
            "mt-auto border-t pt-3 text-xs italic",
            selected ? "border-primary/20 text-primary/80" : "border-border text-muted-foreground"
          )}
        >
          &ldquo;{example}&rdquo;
        </p>
      )}
    </button>
  );
}

/**
 * Grid container for rule template cards
 */
export interface RuleTemplateGridProps {
  /** Available templates */
  templates: RuleTemplate[];
  /** Currently selected template ID */
  selectedId?: string;
  /** Called when a template is selected */
  onSelect: (id: string) => void;
  /** Number of columns */
  columns?: 2 | 3;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
  /** Accessible label for the group */
  "aria-label"?: string;
}

/**
 * Grid wrapper for rule template selection.
 * Manages radio group semantics and layout.
 *
 * @example
 * ```tsx
 * <RuleTemplateGrid
 *   templates={AWARD_RULE_TEMPLATES}
 *   selectedId={selectedTemplate}
 *   onSelect={setSelectedTemplate}
 *   columns={3}
 *   aria-label="Select an award rule template"
 * />
 * ```
 */
export function RuleTemplateGrid({
  templates,
  selectedId,
  onSelect,
  columns = 2,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Rule templates",
}: RuleTemplateGridProps) {
  const columnClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid gap-4", columnClasses[columns], className)}
    >
      {templates.map((template) => (
        <RuleTemplateCard
          key={template.id}
          template={template}
          selected={selectedId === template.id}
          onSelect={() => onSelect(template.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/**
 * Compact variant for smaller spaces
 */
export interface CompactRuleTemplateCardProps {
  template: RuleTemplate;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
}

export function CompactRuleTemplateCard({
  template,
  selected,
  onSelect,
  disabled = false,
  className,
}: CompactRuleTemplateCardProps) {
  const { icon: Icon, name, description } = template;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
          selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <h4
          className={cn(
            "truncate text-sm font-medium",
            selected ? "text-primary" : "text-foreground"
          )}
        >
          {name}
        </h4>
        <p className="text-muted-foreground truncate text-xs">{description}</p>
      </div>

      {/* Selection indicator */}
      {selected && (
        <div className="bg-primary flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
}
