import { Sparkles } from "lucide-react";
import { cn } from "../../../../lib/utils.js";

export interface ConfidenceScoreGaugeProps {
  score: number; // 0.0-1.0
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showPercentage?: boolean;
  className?: string;
}

/**
 * Circular gauge visualization for AI confidence scores.
 * Displays a percentage with color gradient based on confidence level.
 */
export function ConfidenceScoreGauge({
  score,
  size = "md",
  showLabel = true,
  showPercentage = true,
  className,
}: ConfidenceScoreGaugeProps) {
  const percentage = Math.round(score * 100);

  // Determine color based on score using semantic tokens
  const getColor = () => {
    if (score >= 0.8)
      return { stroke: "stroke-success", text: "text-success-dark", bg: "bg-success" };
    if (score >= 0.6) return { stroke: "stroke-primary", text: "text-primary", bg: "bg-primary" };
    if (score >= 0.4) return { stroke: "stroke-accent", text: "text-accent", bg: "bg-accent" };
    return { stroke: "stroke-destructive", text: "text-destructive", bg: "bg-destructive" };
  };

  const colors = getColor();

  // Size configurations
  const sizeConfig = {
    sm: { size: 48, strokeWidth: 4, fontSize: "text-sm", iconSize: "h-3 w-3" },
    md: { size: 80, strokeWidth: 6, fontSize: "text-xl", iconSize: "h-4 w-4" },
    lg: { size: 120, strokeWidth: 8, fontSize: "text-3xl", iconSize: "h-5 w-5" },
  };

  const config = sizeConfig[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - score * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {showLabel && (
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className={cn(config.iconSize, "text-primary")} />
          <span className="text-muted-foreground">Confidence</span>
        </div>
      )}

      <div className="relative" style={{ width: config.size, height: config.size }}>
        {/* Background circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={config.size}
          height={config.size}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Confidence score: ${percentage}%`}
        >
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            className="stroke-muted"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress circle with gradient */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            className={cn(
              colors.stroke,
              "motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out"
            )}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>

        {/* Center percentage */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(config.fontSize, colors.text, "font-bold")}>{percentage}%</span>
          </div>
        )}
      </div>

      {/* Threshold markers */}
      {size !== "sm" && (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="bg-destructive h-2 w-2 rounded-full" />
            <span className="text-muted-foreground">&lt;40%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="bg-accent h-2 w-2 rounded-full" />
            <span className="text-muted-foreground">40-60%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="bg-primary h-2 w-2 rounded-full" />
            <span className="text-muted-foreground">60-80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="bg-success h-2 w-2 rounded-full" />
            <span className="text-muted-foreground">&gt;80%</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline confidence score display
 */
export function ConfidenceScoreBadge({ score, className }: { score: number; className?: string }) {
  const percentage = Math.round(score * 100);

  const getColorClasses = () => {
    if (score >= 0.8) return "bg-success/10 text-success-dark";
    if (score >= 0.6) return "bg-primary/10 text-primary";
    if (score >= 0.4) return "bg-accent/10 text-accent";
    return "bg-destructive/10 text-destructive";
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        getColorClasses(),
        className
      )}
    >
      <Sparkles className="h-3 w-3" />
      {percentage}%
    </span>
  );
}

/**
 * Mini progress bar for confidence scores (used in lists/tables)
 */
export function ConfidenceScoreBar({
  score,
  showPercentage = true,
  className,
}: {
  score: number;
  showPercentage?: boolean;
  className?: string;
}) {
  const percentage = Math.round(score * 100);

  const getBarColor = () => {
    if (score >= 0.8) return "bg-success";
    if (score >= 0.6) return "bg-primary";
    if (score >= 0.4) return "bg-accent";
    return "bg-destructive";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-all motion-safe:duration-300",
            getBarColor()
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-muted-foreground min-w-[3ch] text-xs">{percentage}%</span>
      )}
    </div>
  );
}
