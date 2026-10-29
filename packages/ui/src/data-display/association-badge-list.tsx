/**
 * AssociationBadgeList
 *
 * A reusable component for displaying entity association counts or individual badges.
 * When items are few (up to maxVisible), shows individual badges.
 * When items exceed maxVisible, shows a collapsed count badge.
 *
 * Used for displaying relationships between entities in tables and detail views,
 * e.g., showing which programs a currency is associated with.
 */

import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";

export interface AssociationBadgeListProps {
  /** Items to display */
  items: unknown[];
  /** Label for a single item (e.g., "program") */
  singularLabel: string;
  /** Label for multiple items (e.g., "programs") */
  pluralLabel: string;
  /** Extract a display label from each item. If not provided, uses index-based labels. */
  getLabel?: (item: unknown, index: number) => string;
  /** Extract a stable key from each item for React reconciliation. Falls back to getLabel result. */
  getKey?: (item: unknown, index: number) => string;
  /** Maximum number of individual badges to show before collapsing to a count. Defaults to 3. */
  maxVisible?: number;
  /** Badge variant for individual items. Defaults to "outline". */
  variant?: "default" | "secondary" | "outline" | "destructive";
  /** Additional className for the wrapper */
  className?: string;
  /** What to show when items is empty. Defaults to "—". */
  emptyContent?: ReactNode;
}

/**
 * Display entity associations as badges or a count.
 *
 * @example
 * ```tsx
 * // Shows "3 programs" badge
 * <AssociationBadgeList
 *   items={currency.programIds}
 *   singularLabel="program"
 *   pluralLabel="programs"
 * />
 *
 * // Shows individual badges up to 2, then collapses
 * <AssociationBadgeList
 *   items={environments}
 *   singularLabel="environment"
 *   pluralLabel="environments"
 *   getLabel={(env) => env.name}
 *   maxVisible={2}
 * />
 * ```
 */
export function AssociationBadgeList({
  items,
  singularLabel,
  pluralLabel,
  getLabel,
  getKey,
  maxVisible = 3,
  variant = "outline",
  className,
  emptyContent,
}: AssociationBadgeListProps): ReactNode {
  if (!items || items.length === 0) {
    return emptyContent ?? <span className="text-muted-foreground text-sm">—</span>;
  }

  const count = items.length;

  // If no getLabel or items exceed maxVisible, show count badge
  if (!getLabel || count > maxVisible) {
    return (
      <Badge variant={variant} className={cn("font-normal", className)}>
        {count} {count === 1 ? singularLabel : pluralLabel}
      </Badge>
    );
  }

  // Show individual badges
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {items.map((item, index) => {
        const key = getKey ? getKey(item, index) : getLabel(item, index);
        return (
          <Badge key={key} variant={variant} className="text-xs font-normal">
            {getLabel(item, index)}
          </Badge>
        );
      })}
    </div>
  );
}
