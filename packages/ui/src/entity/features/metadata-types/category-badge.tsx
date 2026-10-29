/**
 * Category Badge
 *
 * Visual badge for metadata type categories.
 */

import { Database, MapPin, Package, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { METADATA_TYPE_CATEGORY_LABELS } from "./types.js";

export interface CategoryBadgeProps {
  /** Category value */
  category: string;
  /** Size variant */
  size?: "sm" | "md";
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: typeof Tag }> = {
  METADATA: { bg: "bg-primary/10", text: "text-primary", icon: Tag },
  LOCATION: { bg: "bg-success/10", text: "text-success-dark", icon: MapPin },
  ITEM: { bg: "bg-accent/10", text: "text-accent-dark", icon: Package },
  DATA_TYPE: { bg: "bg-info/10", text: "text-info", icon: Database },
};

/**
 * Badge showing metadata type category with icon and color
 */
export function CategoryBadge({ category, size = "sm" }: CategoryBadgeProps): ReactNode {
  const style = CATEGORY_STYLES[category] ?? {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: Tag,
  };
  const Icon = style.icon;
  const label = METADATA_TYPE_CATEGORY_LABELS[category] ?? category;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        style.bg,
        style.text,
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
      role="img"
      aria-label={`Category: ${label}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label}
    </span>
  );
}
