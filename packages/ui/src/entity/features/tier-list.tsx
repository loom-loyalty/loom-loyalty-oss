"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tier } from "@loom-loyalty/sdk";
import { GripVertical, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useCallback } from "react";

import { TierBadge } from "../../data-display/tier-badge";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { Skeleton } from "../../primitives/skeleton";
import { TierRankBadge } from "./tier-rank-badge";

export interface TierListProps {
  /** Array of tiers to display */
  tiers: Tier[];
  /** Callback when tiers are reordered */
  onReorder?: (tiers: Tier[]) => void;
  /** Callback when a tier is clicked */
  onTierClick?: (tier: Tier) => void;
  /** Callback when create button is clicked */
  onCreateClick?: () => void;
  /** Callback when edit action is clicked */
  onEditClick?: (tier: Tier) => void;
  /** Callback when delete action is clicked */
  onDeleteClick?: (tier: Tier) => void;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Whether tiers can be edited */
  canEdit?: boolean;
  /** Whether tiers can be deleted */
  canDelete?: boolean;
  /** Whether tiers can be reordered via drag-and-drop */
  canReorder?: boolean;
  /** Custom render function for tier cards */
  renderTierCard?: (tier: Tier, defaultRender: ReactNode) => ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * TierList component displays tiers with visual ranking and optional drag-to-reorder.
 *
 * Features:
 * - Visual ranking badges (gold/silver/bronze for top 3)
 * - Drag-and-drop reordering (optional)
 * - Tier gradient styling
 * - Action menu for edit/delete
 * - Extension point via renderTierCard
 * - WCAG 2.1 AA accessible
 */
export function TierList({
  tiers,
  onReorder,
  onTierClick,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  isLoading = false,
  canEdit = true,
  canDelete = true,
  canReorder = true,
  renderTierCard,
  className,
}: TierListProps): ReactNode {
  // Sort tiers by rank (lowest rank first = highest priority)
  const sortedTiers = [...tiers].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedTiers.findIndex((t) => t.code === active.id);
      const newIndex = sortedTiers.findIndex((t) => t.code === over.id);

      const reorderedTiers = arrayMove(sortedTiers, oldIndex, newIndex).map((tier, index) => ({
        ...tier,
        rank: index + 1,
      }));

      onReorder?.(reorderedTiers);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div role="list" aria-label="Loading tiers" className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-border bg-card flex items-center gap-4 rounded-lg border p-4"
            >
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-8 w-16" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sortedTiers.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tiers</h2>
          {onCreateClick && (
            <Button variant="primary-gradient" onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tier
            </Button>
          )}
        </div>
        <div className="border-border bg-muted flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-muted-foreground mb-4 text-sm">No tiers configured yet</p>
          {onCreateClick && (
            <Button variant="outline" onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first tier
            </Button>
          )}
        </div>
      </div>
    );
  }

  const listContent = (
    <div role="list" aria-label="Tiers" className="space-y-3">
      {sortedTiers.map((tier, index) => {
        const defaultRender = (
          <TierCard
            key={tier.code}
            tier={tier}
            rank={index + 1}
            onTierClick={onTierClick}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
            canEdit={canEdit}
            canDelete={canDelete}
            canReorder={canReorder && !!onReorder}
          />
        );

        if (renderTierCard) {
          const customRender = renderTierCard(tier, defaultRender);
          // Wrap in fragment with key if custom render doesn't have one
          return <div key={tier.code}>{customRender}</div>;
        }
        return defaultRender;
      })}
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tiers</h2>
        {onCreateClick && (
          <Button variant="primary-gradient" onClick={onCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tier
          </Button>
        )}
      </div>

      {canReorder && onReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedTiers.map((t) => t.code)}
            strategy={verticalListSortingStrategy}
          >
            {listContent}
          </SortableContext>
        </DndContext>
      ) : (
        listContent
      )}
    </div>
  );
}

interface TierCardProps {
  tier: Tier;
  rank: number;
  onTierClick?: (tier: Tier) => void;
  onEditClick?: (tier: Tier) => void;
  onDeleteClick?: (tier: Tier) => void;
  canEdit: boolean;
  canDelete: boolean;
  canReorder: boolean;
}

function TierCard({
  tier,
  rank,
  onTierClick,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete,
  canReorder,
}: TierCardProps): ReactNode {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tier.code,
    disabled: !canReorder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Format duration period for display
  const formatDuration = (tier: Tier): string | null => {
    const dp = tier.durationPeriod;
    if (!dp || !dp.durationPeriodValue || !dp.durationPeriod) return null;
    const value = dp.durationPeriodValue;
    const unit = dp.durationPeriod.toLowerCase();
    return `${value} ${unit}`;
  };

  const duration = formatDuration(tier);
  const getDescription = (): string | null => {
    if (!tier.description || typeof tier.description !== "object") {
      return null;
    }
    const descObj = tier.description as Record<string, unknown>;
    if (typeof descObj.en === "string") {
      return descObj.en;
    }
    const firstValue = Object.values(descObj)[0];
    return typeof firstValue === "string" ? firstValue : null;
  };
  const description = getDescription();

  // Handle keyboard activation for clickable tier cards
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (onTierClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onTierClick(tier);
      }
    },
    [onTierClick, tier]
  );

  const isInteractive = !!onTierClick;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role={isInteractive ? "button" : "listitem"}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={`${tier.name} tier, ranked ${rank}`}
      className={cn(
        "group bg-card flex items-center gap-4 rounded-lg border p-4 transition-all",
        "hover:border-primary/50 border-border hover:shadow-sm",
        isDragging && "ring-primary opacity-50 shadow-lg ring-2",
        isInteractive && "focus:ring-primary cursor-pointer focus:ring-2 focus:outline-none"
      )}
      onClick={() => onTierClick?.(tier)}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
    >
      {/* Drag handle */}
      {canReorder && (
        <button
          type="button"
          className={cn(
            "text-muted-foreground flex h-8 w-8 cursor-grab items-center justify-center rounded",
            "focus:ring-primary hover:bg-muted hover:text-foreground focus:ring-2 focus:outline-none",
            isDragging && "cursor-grabbing"
          )}
          aria-label={`Reorder ${tier.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}

      {/* Rank badge */}
      <TierRankBadge rank={rank} tierName={tier.name} />

      {/* Tier info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TierBadge tier={tier.name} />
          <span className="text-muted-foreground font-mono text-xs">{tier.code}</span>
          {tier.subscription && (
            <span className="bg-info-light text-info-foreground rounded px-1.5 py-0.5 text-xs font-medium">
              Subscription
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
          {description && <span className="truncate">{description}</span>}
          {duration && (
            <span className="text-muted-foreground whitespace-nowrap">Duration: {duration}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {(canEdit || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100"
              aria-label={`Actions for ${tier.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && onEditClick && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick(tier);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {canEdit && canDelete && onEditClick && onDeleteClick && <DropdownMenuSeparator />}
            {canDelete && onDeleteClick && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(tier);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
