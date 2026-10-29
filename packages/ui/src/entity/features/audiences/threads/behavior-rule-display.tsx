import {
  ChevronDown,
  Hash,
  Layers,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import * as React from "react";
import { cn } from "../../../../lib/utils.js";
import { Badge } from "../../../../primitives/badge.js";
import { Button } from "../../../../primitives/button.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../primitives/collapsible.js";
import type { ContributingBehavior } from "../types.js";

export interface BehaviorRuleDisplayProps {
  behavior: ContributingBehavior;
  rank?: number;
  showDescription?: boolean;
  showExamples?: boolean;
  className?: string;
}

// Category icons mapping
const categoryIcons: Record<string, React.ElementType> = {
  purchase: ShoppingCart,
  engagement: Zap,
  loyalty: Target,
  demographics: Users,
  behavior: TrendingUp,
  segment: Layers,
  default: Hash,
};

// Category colors mapping using semantic tokens
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  purchase: {
    bg: "bg-success/5",
    text: "text-success-dark",
    border: "border-success/30",
  },
  engagement: {
    bg: "bg-accent/5",
    text: "text-accent",
    border: "border-accent/30",
  },
  loyalty: {
    bg: "bg-primary/5",
    text: "text-primary",
    border: "border-primary/30",
  },
  demographics: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
  },
  behavior: {
    bg: "bg-destructive/5",
    text: "text-destructive",
    border: "border-destructive/30",
  },
  segment: {
    bg: "bg-primary/5",
    text: "text-primary",
    border: "border-primary/30",
  },
  default: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

/**
 * Displays a single contributing behavior with weight visualization and details.
 */
export function BehaviorRuleDisplay({
  behavior,
  rank,
  showDescription = true,
  showExamples = true,
  className,
}: BehaviorRuleDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const category = behavior.behaviorCategory?.toLowerCase() || "default";
  const Icon = categoryIcons[category] ?? categoryIcons.default!;
  const colors = categoryColors[category] ?? categoryColors.default!;
  const percentage = Math.round(behavior.contributionWeight * 100);

  // Color for the weight bar based on contribution level
  const getBarColor = () => {
    if (behavior.contributionWeight >= 0.3) return "bg-primary/80";
    if (behavior.contributionWeight >= 0.2) return "bg-primary/60";
    if (behavior.contributionWeight >= 0.1) return "bg-primary/50";
    return "bg-primary/40";
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          "rounded-lg border transition-all duration-200",
          colors.border,
          isExpanded && "ring-primary/30 ring-1",
          className
        )}
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-start p-0 hover:bg-transparent">
            <div className="flex w-full items-center gap-3 p-3">
              {/* Rank indicator */}
              {rank !== undefined && (
                <div className="text-muted-foreground bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                  {rank}
                </div>
              )}

              {/* Category icon */}
              <div className={cn("shrink-0 rounded-lg p-2", colors.bg)}>
                <Icon className={cn("h-4 w-4", colors.text)} />
              </div>

              {/* Behavior info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{behavior.behaviorTag}</span>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {behavior.behaviorCategory}
                  </Badge>
                </div>

                {/* Weight bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div
                    className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${behavior.behaviorTag} contribution weight`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        getBarColor()
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground min-w-[4ch] text-right text-xs font-medium">
                    {percentage}%
                  </span>
                </div>
              </div>

              {/* Sample count */}
              <div className="text-muted-foreground shrink-0 text-right text-xs">
                <div className="font-medium">{formatSampleCount(behavior.sampleCount)}</div>
                <div>samples</div>
              </div>

              {/* Expand icon */}
              <ChevronDown
                className={cn(
                  "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t px-3 py-3">
            {/* Description */}
            {showDescription && behavior.description && (
              <div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {behavior.description}
                </p>
              </div>
            )}

            {/* Example values */}
            {showExamples && behavior.exampleValues && behavior.exampleValues.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Example Values
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {behavior.exampleValues.map((example, i) => (
                    <Badge key={i} variant="secondary" className="bg-muted/50 font-mono text-xs">
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * List of contributing behaviors with ranking
 */
export function BehaviorRuleList({
  behaviors,
  maxItems,
  showDescription = true,
  showExamples = true,
  className,
}: {
  behaviors: ContributingBehavior[];
  maxItems?: number;
  showDescription?: boolean;
  showExamples?: boolean;
  className?: string;
}) {
  const displayedBehaviors = maxItems ? behaviors.slice(0, maxItems) : behaviors;
  const hasMore = maxItems ? behaviors.length > maxItems : false;

  return (
    <div className={cn("space-y-2", className)}>
      {displayedBehaviors.map((behavior, index) => (
        <BehaviorRuleDisplay
          key={behavior.behaviorTag}
          behavior={behavior}
          rank={index + 1}
          showDescription={showDescription}
          showExamples={showExamples}
        />
      ))}
      {hasMore && (
        <p className="text-muted-foreground py-2 text-center text-sm">
          + {behaviors.length - (maxItems || 0)} more behaviors
        </p>
      )}
    </div>
  );
}

/**
 * Compact behavior tag display (for inline use)
 */
export function BehaviorTag({
  tag,
  category,
  weight,
  className,
}: {
  tag: string;
  category?: string;
  weight?: number;
  className?: string;
}) {
  const categoryKey = category?.toLowerCase() || "default";
  const colors = categoryColors[categoryKey] ?? categoryColors.default!;
  const Icon = categoryIcons[categoryKey] ?? categoryIcons.default!;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        colors.bg,
        colors.border,
        className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", colors.text)} />
      <span className="text-sm font-medium">{tag}</span>
      {weight !== undefined && (
        <span className="text-muted-foreground text-xs">({Math.round(weight * 100)}%)</span>
      )}
    </span>
  );
}

/**
 * Formats sample count for display
 */
function formatSampleCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
