/**
 * SegmentVersionStatusBadge - Draft/Published lifecycle badge for CustomerSegment audiences
 *
 * Mirrors the Data Model feature's VersionStatusBadge (same DRAFT/PUBLISHED
 * semantic classes, same shape) but scoped to the two-value lifecycle a
 * CustomerSegment actually has. CUSTOMER_LIST audiences have no version
 * concept at all, so this badge only ever applies to CUSTOMER_SEGMENT rows.
 */

import { CheckCircle2, Circle } from "lucide-react";
import type { ReactNode } from "react";
import {
  StatusIndicatorBadge,
  type StatusIndicatorBadgeConfig,
} from "../../status-indicator-badge.js";
import type { SegmentVersionStatus } from "./types.js";

export const SEGMENT_VERSION_STATUS_CONFIG: Record<
  SegmentVersionStatus,
  StatusIndicatorBadgeConfig
> = {
  DRAFT: {
    label: "Draft",
    icon: Circle,
    classes: "bg-muted text-muted-foreground border-border",
  },
  PUBLISHED: {
    label: "Published",
    icon: CheckCircle2,
    classes: "bg-success/10 text-success-dark border-success/20",
  },
};

export function SegmentVersionStatusBadge({ status }: { status: SegmentVersionStatus }): ReactNode {
  const config = SEGMENT_VERSION_STATUS_CONFIG[status];
  if (!config) return null;
  return <StatusIndicatorBadge config={config} ariaLabelPrefix="Version status" />;
}
