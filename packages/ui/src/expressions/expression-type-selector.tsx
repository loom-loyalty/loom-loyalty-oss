/**
 * Expression Type Selector
 *
 * Categorized dropdown for selecting an expression type. Groups types into
 * Logical, Comparison, String, Collection, Structural, Loyalty, and (customer
 * surface only) Event Behavior.
 *
 * Surface scoping: the event surface hides the audience-only aggregate
 * operators — they are invalid for single-event evaluation, so emitting them
 * there produces silent dead rules. The surface is read from the expression
 * context (authoritative at every depth) when a provider is present.
 */

import { isOperatorAllowed, type OperatorSurface } from "@loom-loyalty/schema/expressions";
import { useMemo, type ReactNode } from "react";
import { cn } from "../lib/utils.js";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../primitives/select.js";
import { ToggleGroup, ToggleGroupItem } from "../primitives/toggle-group.js";

import { useExpressionContext } from "./expression-context.js";
import { EXPRESSION_CATEGORIES, EXPRESSION_TYPE_NAMES } from "./utils";

export interface ExpressionTypeSelectorProps {
  value?: string;
  onSelect: (type: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /**
   * Which surface the expression targets. On "event", audience-only aggregate
   * operators are hidden. Fail-closed default is "event"; the expression
   * context's `mode` overrides it whenever a provider is present.
   */
  surface?: OperatorSurface;
  /**
   * Type keys to hide from every category (e.g. sentence mode hides
   * `and`/`or`/`not` from the "Add condition" list because group creation
   * goes through the dedicated "+ Add group" affordance instead, R10).
   */
  excludeTypes?: string[];
}

export function ExpressionTypeSelector({
  value,
  onSelect,
  disabled,
  placeholder = "Select expression type...",
  className,
  surface: surfaceProp = "event",
  excludeTypes,
}: ExpressionTypeSelectorProps): ReactNode {
  // The context mode is authoritative when present (the builder mounts a
  // provider at depth 0, so it is set at every nested depth); the prop is a
  // fail-closed fallback for standalone rendering with no provider.
  const surface = useExpressionContext().mode ?? surfaceProp;

  // Drop ops the surface doesn't allow (audience-only aggregates on events,
  // event-only metadata ops on customers) and any category left empty.
  const categories = useMemo(() => {
    const base = Object.entries(EXPRESSION_CATEGORIES)
      .map(
        ([category, types]) =>
          [category, types.filter((t) => isOperatorAllowed(surface, t))] as const
      )
      .filter(([, types]) => types.length > 0);
    if (!excludeTypes || excludeTypes.length === 0) return base;
    return base
      .map(
        ([category, types]) => [category, types.filter((t) => !excludeTypes.includes(t))] as const
      )
      .filter(([, types]) => types.length > 0);
  }, [surface, excludeTypes]);

  return (
    <Select value={value ?? ""} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {categories.map(([category, types]) => (
          <SelectGroup key={category}>
            <SelectLabel>{category}</SelectLabel>
            {types.map((type) => (
              <SelectItem key={type} value={type}>
                {EXPRESSION_TYPE_NAMES[type] ?? type}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface CompositeMatchToggleProps {
  /** Current composite type; only `and`/`or` are valid — `not` never reaches this control (KTD12). */
  value: "and" | "or";
  onSelect: (type: "and" | "or") => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Sentence-mode replacement for the composite type selector on `and`/`or`
 * composites (R10). Maps directly onto the existing `and`/`or` composite
 * types — no new AST shape. `not` composites never render this control
 * (see the distinct negation header in `CompositeExpressionBuilder`); this
 * keeps the "no control converts `not` into a match-count group" invariant
 * structural rather than conventional (KTD12, fix #10).
 */
export function CompositeMatchToggle({
  value,
  onSelect,
  disabled,
  className,
}: CompositeMatchToggleProps): ReactNode {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next: string) => {
        if (next === "and" || next === "or") onSelect(next);
      }}
      disabled={disabled}
      aria-label="Match condition"
      // White fill so the toggles stay distinct on the modal's sage working well.
      className={cn("bg-card", className)}
    >
      <ToggleGroupItem value="and" className="min-h-11 px-3 text-xs" aria-label="Match All">
        Match All
      </ToggleGroupItem>
      <ToggleGroupItem value="or" className="min-h-11 px-3 text-xs" aria-label="Match Any">
        Match Any
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export interface MatchModeToggleProps {
  /**
   * "single" — zero or one condition, not yet a match-count group.
   * "all"/"any" — a real `and`/`or` composite root.
   */
  value: "single" | "all" | "any";
  /** Selecting "all"/"any" from "single" promotes to a composite (KTD9-style, but at the root). */
  onSelect: (mode: "single" | "all" | "any") => void;
  disabled?: boolean;
  /** "single" is not a valid target once 2+ conditions exist — nothing to collapse to. */
  singleDisabled?: boolean;
  className?: string;
}

/**
 * Sentence-mode header for the ROOT of an expression tree (design reference:
 * "start the expression" framing) — shown even before any condition exists,
 * or while there's exactly one un-grouped leaf. Distinct from
 * `CompositeMatchToggle` (which only ever appears once a real `and`/`or`
 * composite exists and never offers "single", since collapsing 2+ conditions
 * back to one is out of scope, fix #9-style).
 */
export function MatchModeToggle({
  value,
  onSelect,
  disabled,
  singleDisabled,
  className,
}: MatchModeToggleProps): ReactNode {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next: string) => {
        if (next === "single" || next === "all" || next === "any") onSelect(next);
      }}
      disabled={disabled}
      aria-label="Match condition"
      className={cn("bg-card", className)}
    >
      <ToggleGroupItem
        value="single"
        disabled={singleDisabled}
        className="min-h-11 px-3 text-xs"
        aria-label="One condition"
      >
        One
      </ToggleGroupItem>
      <ToggleGroupItem value="all" className="min-h-11 px-3 text-xs" aria-label="Match All">
        All
      </ToggleGroupItem>
      <ToggleGroupItem value="any" className="min-h-11 px-3 text-xs" aria-label="Match Any">
        Any
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
