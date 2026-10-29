import { Archive, CheckCircle2, Circle, Pause } from "lucide-react";
import type { ReactNode } from "react";
import {
  StatusIndicatorBadge,
  type StatusIndicatorBadgeConfig,
} from "../../../status-indicator-badge.js";
import type { DataModelVersionStatus } from "../types.js";

export const VERSION_STATUS_CONFIG: Record<DataModelVersionStatus, StatusIndicatorBadgeConfig> = {
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
  PAUSED: {
    label: "Paused",
    icon: Pause,
    classes: "bg-warning/10 text-warning border-warning/20",
  },
  ARCHIVED: {
    label: "Archived",
    icon: Archive,
    classes: "bg-muted/50 text-muted-foreground border-border",
  },
};

export function VersionStatusBadge({ status }: { status: DataModelVersionStatus }): ReactNode {
  const config = VERSION_STATUS_CONFIG[status];
  if (!config) return null;
  return <StatusIndicatorBadge config={config} ariaLabelPrefix="Version status" />;
}
