/**
 * AudienceStatusIndicator - Status badge and dot for customer audiences
 *
 * Supports active, inactive, archived, and scheduled states.
 * Ported from existing dashboard with semantic color tokens.
 */

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";
import type { AudienceStatus, CustomerAudience } from "./types.js";
import { getAudienceStatus } from "./utils.js";

interface AudienceStatusIndicatorProps {
  /** The audience object - status will be derived */
  audience?: CustomerAudience;
  /** Explicit status override */
  status?: AudienceStatus;
  /** Custom label */
  label?: string;
  /** Show the label text */
  showLabel?: boolean;
  /** Additional class name */
  className?: string;
}

const statusConfig: Record<
  AudienceStatus,
  { dotClass: string; badgeClass: string; label: string }
> = {
  active: {
    dotClass: "bg-success",
    badgeClass: "bg-success/10 text-success-dark border-success/20",
    label: "Active",
  },
  inactive: {
    dotClass: "bg-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
    label: "Inactive",
  },
  archived: {
    dotClass: "bg-accent",
    badgeClass: "bg-accent/10 text-accent border-accent/20",
    label: "Archived",
  },
  scheduled: {
    dotClass: "bg-primary",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    label: "Scheduled",
  },
};

/**
 * Status indicator component for customer audiences
 * Supports active, inactive, archived, and scheduled states
 */
export function AudienceStatusIndicator({
  audience,
  status: statusProp,
  label,
  showLabel = true,
  className,
}: AudienceStatusIndicatorProps): ReactNode {
  // Derive status from audience or use prop
  const status = statusProp ?? (audience ? getAudienceStatus(audience) : "active");
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  if (showLabel) {
    return (
      <Badge variant="outline" className={cn(config.badgeClass, className)}>
        <div className={cn("mr-1.5 h-2 w-2 rounded-full", config.dotClass)} role="presentation" />
        {displayLabel}
      </Badge>
    );
  }

  return (
    <div role="img" aria-label={displayLabel} className={cn("flex items-center gap-2", className)}>
      <div className={cn("h-2 w-2 rounded-full", config.dotClass)} role="presentation" />
    </div>
  );
}

/**
 * Simple dot indicator for compact displays
 */
export function AudienceStatusDot({
  status,
  className,
}: {
  status: AudienceStatus;
  className?: string;
}): ReactNode {
  const config = statusConfig[status];
  return (
    <div
      className={cn("h-2 w-2 rounded-full", config.dotClass, className)}
      role="img"
      aria-label={config.label}
      title={config.label}
    />
  );
}
