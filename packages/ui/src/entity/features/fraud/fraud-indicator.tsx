import { ShieldAlert } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../../primitives/button";

export interface FraudIndicatorProps {
  /** `blocked`: redemptions are refused. `warning`: an unenforced block or an undecided case. */
  tone: "blocked" | "warning";
  /** One line, e.g. "Redemptions blocked by a rule · 1 open case · score 75%". */
  label: string;
  /** Opens the fraud review; the Review button is left out without it. */
  onReview?: () => void;
  className?: string;
}

/** The one bold fraud line under a member's header, with a Review button that opens the details. */
export function FraudIndicator({ tone, label, onReview, className }: FraudIndicatorProps) {
  return (
    <div
      className={cn(
        "bg-card mx-4 mt-4 flex items-center gap-3 rounded-lg border py-1.5 pr-2 pl-3 shadow-xs lg:mx-6",
        tone === "blocked" ? "border-destructive" : "border-warning",
        className
      )}
    >
      <ShieldAlert
        className={cn(
          "h-4 w-4 shrink-0",
          tone === "blocked" ? "text-destructive" : "text-status-pending-fg"
        )}
        aria-hidden="true"
      />
      <p role="status" className="text-foreground min-w-0 flex-1 text-sm font-semibold">
        {label}
      </p>
      {onReview && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0"
          aria-label="Review fraud"
          onClick={onReview}
        >
          Review
        </Button>
      )}
    </div>
  );
}
