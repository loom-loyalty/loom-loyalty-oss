/**
 * Classification utilities for DataModelTypes
 *
 * DataModelType classifications:
 * - primitive: Built-in types (STRING, INTEGER, BOOLEAN, etc.) — read-only
 * - system: Platform-defined types (CUSTOMER, PROGRAM, BADGE, etc.) — editable but not deletable
 * - custom: User-defined types — editable
 *
 * Classification is derived from the type's `primitive` and `system` flags.
 * A type that is neither primitive nor system is custom.
 */

import type { DataModel, DataModelType } from "@loom-loyalty/sdk";
import { AlertTriangle, Box, Cpu, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";

export type DataModelClassification = "primitive" | "system" | "custom";

/**
 * Derive the classification of a DataModelType from its flags.
 */
export function getTypeClassification(
  type: DataModelType | undefined | null
): DataModelClassification {
  if (!type) return "custom";
  if (type.primitive) return "primitive";
  if (type.system) return "system";
  return "custom";
}

/**
 * Whether a data model can be edited.
 * Primitive models are read-only; system and custom models can be edited.
 */
export function canEditDataModel(dataModel: DataModel): boolean {
  return getTypeClassification(dataModel.type) !== "primitive";
}

/**
 * Whether a data model can be deleted.
 * Only models with custom types can be deleted.
 */
export function canDeleteDataModel(dataModel: DataModel): boolean {
  return getTypeClassification(dataModel.type) === "custom";
}

/**
 * Visual configuration for each classification.
 * Uses semantic design tokens — never hardcoded colors.
 */
const CLASSIFICATION_CONFIG: Record<
  DataModelClassification,
  {
    label: string;
    icon: typeof Box;
    colorClasses: string;
    description: string;
  }
> = {
  primitive: {
    label: "Primitive",
    icon: Box,
    colorClasses: "bg-muted text-muted-foreground border-border",
    description: "Built-in types like STRING, INTEGER, BOOLEAN, DATE, UUID.",
  },
  system: {
    label: "System",
    icon: Cpu,
    colorClasses: "bg-primary/10 text-primary border-primary/20",
    description: "Platform-defined types for standard entities (CUSTOMER, PROGRAM, BADGE, etc.).",
  },
  custom: {
    label: "Custom",
    icon: Sparkles,
    colorClasses: "bg-accent/10 text-accent-dark border-accent/20",
    description: "User-defined custom data model types.",
  },
};

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
} as const;

const ICON_SIZES = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
} as const;

export interface ClassificationBadgeProps {
  /** The classification to display */
  classification: DataModelClassification;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show the text label */
  showLabel?: boolean;
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ClassificationBadge - Displays a colored badge for data model type classification.
 *
 * Uses semantic design tokens (muted, primary, accent) to align with DESIGN.md.
 *
 * @example
 * <ClassificationBadge classification="custom" />
 * <ClassificationBadge classification={getTypeClassification(model.type)} size="sm" />
 */
export function ClassificationBadge({
  classification,
  size = "md",
  showLabel = true,
  showIcon = true,
  className,
}: ClassificationBadgeProps): ReactNode {
  const config = CLASSIFICATION_CONFIG[classification];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      role="img"
      aria-label={`Classification: ${config.label}`}
      title={`${config.label}: ${config.description}`}
      className={cn(
        "inline-flex items-center font-medium",
        config.colorClasses,
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <Icon className={ICON_SIZES[size]} aria-hidden="true" />}
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}

export interface ClassificationStatsBarProps {
  /** Count of primitive types */
  primitive: number;
  /** Count of system types */
  system: number;
  /** Count of custom types */
  custom: number;
  /**
   * Whether the upstream query hit its pagination cap. When true, the counts
   * displayed here may undercount reality; the bar renders a visible note so
   * admins realize the stats are incomplete.
   */
  truncated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ClassificationStatsBar - Compact stats strip showing classification counts.
 *
 * Renders inline with format: [9 Primitive · 95 System · 3 Custom]
 *
 * @example
 * <ClassificationStatsBar primitive={9} system={95} custom={3} />
 */
export function ClassificationStatsBar({
  primitive,
  system,
  custom,
  truncated,
  className,
}: ClassificationStatsBarProps): ReactNode {
  return (
    <div
      className={cn(
        "border-border bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5",
        className
      )}
      role="status"
      aria-label={
        truncated
          ? `${primitive}+ primitive, ${system}+ system, ${custom}+ custom data model types (counts may be incomplete)`
          : `${primitive} primitive, ${system} system, ${custom} custom data model types`
      }
    >
      <StatItem classification="primitive" count={primitive} label="Primitive" />
      <Separator />
      <StatItem classification="system" count={system} label="System" />
      <Separator />
      <StatItem classification="custom" count={custom} label="Custom" />
      {truncated && (
        <>
          <Separator />
          <span className="text-warning inline-flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Counts may be incomplete (pagination cap reached)
          </span>
        </>
      )}
    </div>
  );
}

interface StatItemProps {
  classification: DataModelClassification;
  count: number;
  label: string;
}

function StatItem({ classification, count, label }: StatItemProps): ReactNode {
  const config = CLASSIFICATION_CONFIG[classification];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={cn(
          "h-4 w-4",
          classification === "primitive" && "text-muted-foreground",
          classification === "system" && "text-primary",
          classification === "custom" && "text-accent-dark"
        )}
        aria-hidden="true"
      />
      <span className="text-foreground font-mono text-sm font-medium tabular-nums">{count}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}

function Separator(): ReactNode {
  return (
    <span className="text-muted-foreground/40 text-sm" aria-hidden="true">
      ·
    </span>
  );
}
