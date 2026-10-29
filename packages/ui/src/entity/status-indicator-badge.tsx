/**
 * StatusIndicatorBadge
 *
 * Generic small pill for displaying a record's lifecycle/status state (e.g.
 * a data model's DRAFT/PUBLISHED/PAUSED/ARCHIVED version status, a customer
 * segment's DRAFT/PUBLISHED status, or an event rule's published-vs-not
 * indicator). This component owns only the shared Badge/icon/aria-label
 * rendering shape — each feature keeps its own status enum and label/icon/
 * color mapping, and maps that to a `StatusIndicatorBadgeConfig` before
 * rendering this component.
 *
 * See the per-feature thin call sites that map their status enum to this
 * shape: `entity/features/data-models/detail/version-status-badge.tsx`
 * (`VersionStatusBadge`), `entity/features/audiences/segment-version-status-badge.tsx`
 * (`SegmentVersionStatusBadge`), and the event-rules feature's internal
 * `EventRuleVersionStatusBadge` in `entity/features/event-rules/event-rule-detail.tsx`.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";
import { Badge } from "../primitives/badge.js";

/**
 * Per-status visual mapping a feature produces from its own status enum.
 * `classes` must be composed of semantic Tailwind tokens (e.g. `bg-success/10
 * text-success-dark border-success/20`) — never raw palette classes or hex values.
 */
export interface StatusIndicatorBadgeConfig {
  /** Visible badge text. */
  label: string;
  /** Icon rendered before the label. */
  icon: LucideIcon;
  /** Semantic Tailwind token classes for background/text/border. */
  classes: string;
}

export interface StatusIndicatorBadgeProps {
  /** Status-to-visuals mapping, produced by the call site from its own status enum. */
  config: StatusIndicatorBadgeConfig;
  /** Prefix for the accessible name, e.g. `"Version status"` renders as `"Version status: Draft"`. */
  ariaLabelPrefix: string;
}

export function StatusIndicatorBadge({
  config,
  ariaLabelPrefix,
}: StatusIndicatorBadgeProps): ReactNode {
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={`${ariaLabelPrefix}: ${config.label}`}
      className={cn("inline-flex items-center gap-1 text-xs", config.classes)}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
