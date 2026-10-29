import { Check, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "../../../../lib/utils.js";
import { Badge } from "../../../../primitives/badge.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../primitives/tooltip.js";
import type { BanditStatus } from "../types.js";

export interface BanditStatusIndicatorProps {
  status: BanditStatus;
  explorationInteractions?: number;
  optimizationThreshold?: number;
  showProgress?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Default threshold for optimization (can be configured)
const DEFAULT_OPTIMIZATION_THRESHOLD = 1000;

/**
 * Displays the multi-armed bandit learning status for a THREADS segment.
 * Shows whether the AI is still exploring offers or has optimized.
 */
export function BanditStatusIndicator({
  status,
  explorationInteractions = 0,
  optimizationThreshold = DEFAULT_OPTIMIZATION_THRESHOLD,
  showProgress = true,
  showTooltip = true,
  size = "md",
  className,
}: BanditStatusIndicatorProps) {
  const isExploring = status === "exploring";
  const progressPercentage = Math.min((explorationInteractions / optimizationThreshold) * 100, 100);

  const sizeClasses = {
    sm: "gap-1.5 text-xs",
    md: "gap-2 text-sm",
    lg: "gap-2.5 text-base",
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const content = (
    <div className={cn("inline-flex items-center", sizeClasses[size], className)}>
      {isExploring ? (
        <>
          {/* Exploring state with animated pulse */}
          <div className="relative">
            <Loader2 className={cn(iconSize[size], "text-accent motion-safe:animate-spin")} />
            {/* Pulse ring */}
            <span className="bg-accent/30 absolute inset-0 rounded-full motion-safe:animate-ping" />
          </div>
          <span className="text-accent font-medium">Exploring</span>
        </>
      ) : (
        <>
          {/* Optimized state with checkmark */}
          <div className="bg-success/10 flex h-5 w-5 items-center justify-center rounded-full">
            <Check className={cn(iconSize[size], "text-success-dark")} />
          </div>
          <span className="text-success-dark font-medium">Optimized</span>
        </>
      )}

      {/* Progress bar for exploring state */}
      {showProgress && isExploring && (
        <div className="ml-2 flex items-center gap-2">
          <div
            className="bg-muted h-1.5 w-16 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={Math.round(progressPercentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="AI learning progress"
          >
            <div
              className="bg-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-muted-foreground text-xs">{Math.round(progressPercentage)}%</span>
        </div>
      )}
    </div>
  );

  if (!showTooltip) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {isExploring ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="text-accent h-4 w-4" />
                Learning Phase
              </div>
              <p className="text-muted-foreground text-sm">
                The AI is still exploring different offers to find the best recommendations for this
                segment. It needs more interactions to optimize.
              </p>
              <p className="text-sm">
                <span className="font-medium">{explorationInteractions.toLocaleString()}</span>
                <span className="text-muted-foreground">
                  {" "}
                  / {optimizationThreshold.toLocaleString()} interactions
                </span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <TrendingUp className="text-success-dark h-4 w-4" />
                Optimization Complete
              </div>
              <p className="text-muted-foreground text-sm">
                The AI has gathered enough data to confidently recommend the best offers for this
                segment.
              </p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Badge variant for compact display
 */
export function BanditStatusBadge({
  status,
  className,
}: {
  status: BanditStatus;
  className?: string;
}) {
  const isExploring = status === "exploring";

  return (
    <Badge
      variant="outline"
      className={cn(
        isExploring
          ? "border-accent/30 bg-accent/5 text-accent"
          : "border-success/30 bg-success/5 text-success-dark",
        className
      )}
    >
      {isExploring ? (
        <>
          <Loader2 className="mr-1 h-3 w-3 motion-safe:animate-spin" />
          Exploring
        </>
      ) : (
        <>
          <Check className="mr-1 h-3 w-3" />
          Optimized
        </>
      )}
    </Badge>
  );
}

/**
 * Full status card with detailed information
 */
export function BanditStatusCard({
  status,
  explorationInteractions = 0,
  optimizationThreshold = DEFAULT_OPTIMIZATION_THRESHOLD,
  className,
}: {
  status: BanditStatus;
  explorationInteractions?: number;
  optimizationThreshold?: number;
  className?: string;
}) {
  const isExploring = status === "exploring";
  const progressPercentage = Math.min((explorationInteractions / optimizationThreshold) * 100, 100);

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isExploring ? "border-accent/30 bg-accent/5" : "border-success/30 bg-success/5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={cn("rounded-full p-2", isExploring ? "bg-accent/10" : "bg-success/10")}>
          {isExploring ? (
            <Loader2 className="text-accent h-5 w-5 motion-safe:animate-spin" />
          ) : (
            <TrendingUp className="text-success-dark h-5 w-5" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <h4 className={cn("font-medium", isExploring ? "text-accent" : "text-success-dark")}>
              {isExploring ? "Exploring Offers" : "Optimization Complete"}
            </h4>
            <p className="text-muted-foreground text-sm">
              {isExploring
                ? "AI is learning which offers work best for this segment"
                : "AI has identified the optimal offers for this segment"}
            </p>
          </div>

          {/* Progress section */}
          {isExploring && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Learning progress</span>
                <span className="font-medium">
                  {explorationInteractions.toLocaleString()} /{" "}
                  {optimizationThreshold.toLocaleString()}
                </span>
              </div>
              <div
                className="bg-accent/20 h-2 overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={Math.round(progressPercentage)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="AI learning progress"
              >
                <div
                  className="bg-accent h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
