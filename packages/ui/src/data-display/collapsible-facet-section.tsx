import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../primitives/collapsible";

export interface CollapsibleFacetSectionBadge {
  text: string;
  tone?: "warn" | "neutral";
}
export interface CollapsibleFacetSectionProps {
  label: string;
  contentId: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  dirty?: boolean;
  error?: string;
  badge?: CollapsibleFacetSectionBadge;
  children: ReactNode;
}

export function CollapsibleFacetSection({
  label,
  contentId,
  expanded,
  onExpandedChange,
  dirty = false,
  error,
  badge,
  children,
}: CollapsibleFacetSectionProps): ReactNode {
  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange} className="border-border border-t">
      <CollapsibleTrigger
        className="flex min-h-11 w-full items-center gap-2 py-3 text-left"
        aria-controls={contentId}
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")} />
        <span className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">
          {label}
        </span>
        {dirty ? (
          <span
            role="img"
            aria-label={`${label} has unsaved changes`}
            className="bg-warning h-2 w-2 rounded-full"
          />
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {badge && !expanded ? (
            <Badge variant={badge.tone === "warn" ? "secondary" : "outline"}>{badge.text}</Badge>
          ) : null}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent id={contentId} className="space-y-3 pb-4">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
