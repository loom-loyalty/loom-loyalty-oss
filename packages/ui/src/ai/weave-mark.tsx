import { Sparkles } from "lucide-react";

import { cn } from "../lib/utils";

export interface WeaveMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const TILE_SIZE = { sm: "size-7 rounded-md", md: "size-9 rounded-lg", lg: "size-12 rounded-xl" };
const ICON_SIZE = { sm: "size-4", md: "size-5", lg: "size-6" };

/**
 * Weave's mark: the sidebar's AI Assistant glyph (lucide Sparkles) on the
 * sidebar rail's deep-teal tile, so the chat reads as the thing the user opened.
 */
export function WeaveMark({ size = "md", className }: WeaveMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "from-sidebar-rail-from to-sidebar-rail-to text-sidebar-foreground inline-flex shrink-0 items-center justify-center bg-gradient-to-b",
        TILE_SIZE[size],
        className
      )}
    >
      <Sparkles className={ICON_SIZE[size]} />
    </span>
  );
}
