/**
 * TypedAudienceBadge - Badge component for audience type and engine display
 *
 * Shows icon (Users, Database, Sparkles), badge classes, optional AI indicator
 * and confidence score. Ported from existing dashboard with semantic token imports.
 */

import { Database, ListTree, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";
import type { CustomerAudience, CustomerAudienceType, SegmentEngine } from "./types.js";
import {
  audienceTypeBadgeClasses,
  audienceTypeLabels,
  engineBadgeClasses,
  engineLabels,
  formatConfidenceScore,
} from "./utils.js";

/** Render the appropriate icon for an audience type/engine */
function AudienceIcon({
  type,
  engine,
  className,
}: {
  type: CustomerAudienceType;
  engine?: SegmentEngine;
  className?: string;
}): ReactNode {
  if (type === "CUSTOMER_LIST") return <Users className={className} />;
  if (engine === "CLICKHOUSE") return <Database className={className} />;
  if (engine === "THREADS") return <Sparkles className={className} />;
  return <ListTree className={className} />;
}

interface TypedAudienceBadgeProps {
  /** The audience object or just the type/engine */
  audience?: CustomerAudience;
  /** Audience type when not passing full audience */
  type?: CustomerAudienceType;
  /** Segment engine when type is CUSTOMER_SEGMENT */
  engine?: SegmentEngine;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show the type/engine label text */
  showLabel?: boolean;
  /** Show AI sparkle indicator for THREADS */
  showAIIndicator?: boolean;
  /** Show confidence score for THREADS */
  confidenceScore?: number;
  /** Additional class name */
  className?: string;
}

/**
 * Badge component that displays the type and engine of a customer audience
 * with appropriate icons, colors, and optional confidence score
 */
export function TypedAudienceBadge({
  audience,
  type: typeProp,
  engine: engineProp,
  size = "md",
  showLabel = true,
  showAIIndicator = true,
  confidenceScore: confidenceScoreProp,
  className,
}: TypedAudienceBadgeProps): ReactNode {
  // Derive type and engine from audience or props
  const type = audience?.type ?? typeProp ?? "CUSTOMER_LIST";
  const engine =
    audience?.type === "CUSTOMER_SEGMENT"
      ? audience.engine
      : type === "CUSTOMER_SEGMENT"
        ? engineProp
        : undefined;

  // Get confidence score from THREADS config
  const confidenceScore =
    confidenceScoreProp ??
    (audience?.type === "CUSTOMER_SEGMENT" &&
    audience.engine === "THREADS" &&
    audience.engineConfig &&
    "confidenceScore" in audience.engineConfig
      ? audience.engineConfig.confidenceScore
      : undefined);

  // Size classes
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  // Color classes based on type and engine
  const colorClasses =
    type === "CUSTOMER_LIST"
      ? audienceTypeBadgeClasses.CUSTOMER_LIST
      : engine
        ? engineBadgeClasses[engine]
        : audienceTypeBadgeClasses.CUSTOMER_SEGMENT;

  // Label text
  const label =
    type === "CUSTOMER_LIST"
      ? audienceTypeLabels.CUSTOMER_LIST
      : engine
        ? engineLabels[engine]
        : audienceTypeLabels.CUSTOMER_SEGMENT;

  return (
    <div className="inline-flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn(sizeClasses[size], colorClasses, "font-medium", className)}
        {...(!showLabel ? { role: "img" as const, "aria-label": label } : {})}
      >
        <AudienceIcon
          type={type}
          engine={engine}
          className={cn(iconSizes[size], showLabel && "mr-1")}
        />
        {showLabel && label}
      </Badge>

      {/* AI indicator for THREADS */}
      {engine === "THREADS" && showAIIndicator && (
        <Badge
          variant="outline"
          className={cn("border-accent/30 bg-accent/10 text-accent", sizeClasses.sm, "px-1.5")}
        >
          AI
        </Badge>
      )}

      {/* Confidence score indicator */}
      {engine === "THREADS" && confidenceScore !== undefined && (
        <span
          className={cn("text-muted-foreground font-medium", size === "sm" ? "text-xs" : "text-sm")}
          aria-label={`AI Confidence Score: ${formatConfidenceScore(confidenceScore)}`}
        >
          {formatConfidenceScore(confidenceScore)}
        </span>
      )}
    </div>
  );
}

/**
 * Compact badge showing just the audience type icon
 */
export function TypedAudienceIcon({
  type,
  engine,
  className,
}: {
  type: CustomerAudienceType;
  engine?: SegmentEngine;
  className?: string;
}): ReactNode {
  const colorClass =
    type === "CUSTOMER_LIST"
      ? "text-primary"
      : engine === "CLICKHOUSE"
        ? "text-success-dark"
        : engine === "THREADS"
          ? "text-accent"
          : "text-primary";

  return (
    <AudienceIcon type={type} engine={engine} className={cn("h-4 w-4", colorClass, className)} />
  );
}
