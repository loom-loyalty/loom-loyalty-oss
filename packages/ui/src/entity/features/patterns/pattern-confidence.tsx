import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";

export type PatternConfidenceLevel = "high" | "low";

export interface PatternConfidenceProps {
  level: PatternConfidenceLevel;
  /** What the level rests on, e.g. "4.1× better than random" */
  detail?: string;
  className?: string;
}

/**
 * The confidence every Patterns result carries. Low confidence keeps the result
 * usable but says so.
 */
export function PatternConfidence({ level, detail, className }: PatternConfidenceProps) {
  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Badge variant={level === "high" ? "success" : "warning"}>
        {level === "high" ? "High confidence" : "Low confidence"}
      </Badge>
      {detail && <span className="text-muted-foreground text-xs">{detail}</span>}
    </div>
  );
}
