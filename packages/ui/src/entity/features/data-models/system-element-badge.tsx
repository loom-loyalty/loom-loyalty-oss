import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "../../../primitives/badge.js";

/** Marks a platform-managed data model element, which can't be edited or removed. */
export function SystemElementBadge(): ReactNode {
  return (
    <Badge
      variant="outline"
      title="Managed by the platform. Read-only."
      className="text-muted-foreground gap-1 text-[10px]"
    >
      <Lock className="h-3 w-3" aria-hidden="true" />
      System
    </Badge>
  );
}
