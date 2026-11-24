import { useId, type ReactNode } from "react";

import { cn } from "../../../lib/utils";
import { Badge, type BadgeProps } from "../../../primitives/badge";
import { Button } from "../../../primitives/button";

const STATUS_BADGES: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  OPEN: { label: "Open", variant: "warning" },
  CONFIRMED: { label: "Confirmed fraud", variant: "error" },
  CLEARED: { label: "Cleared", variant: "success" },
};

export interface FraudCaseReason {
  /** Stable machine code, e.g. `EMAIL_CHANGED` or `RULE_ATO_1`. */
  code: string;
  /** The sentence a reviewer reads. */
  text: string;
}

export interface FraudCaseCardProps {
  /** `OPEN`, `CONFIRMED` or `CLEARED`; an unknown status shows as an outline badge. */
  status?: string;
  /** The score as shown, e.g. "75%". */
  scoreLabel: string;
  reasons?: readonly FraudCaseReason[];
  /** Logging mode: the case would have refused the redemption in Blocking mode. */
  wouldHaveBlocked?: boolean;
  decisionCount?: number;
  /** Formatted last-seen time, e.g. "Nov 22, 2026 4:06 PM". */
  lastSeenLabel?: string;
  /** Each button shows only when its handler is given. */
  onViewDecisions?: () => void;
  onClear?: () => void;
  onConfirm?: () => void;
  /** Disables Clear it and Confirm fraud while a decision saves. */
  pending?: boolean;
  /** Extra content under the buttons, e.g. an error message or a dialog. */
  children?: ReactNode;
  className?: string;
}

/** One fraud case: status, score, plain-language reasons, and the reviewer's decisions. */
export function FraudCaseCard({
  status,
  scoreLabel,
  reasons = [],
  wouldHaveBlocked = false,
  decisionCount = 0,
  lastSeenLabel,
  onViewDecisions,
  onClear,
  onConfirm,
  pending = false,
  children,
  className,
}: FraudCaseCardProps) {
  const titleId = useId();
  const badge = status
    ? (STATUS_BADGES[status] ?? { label: status, variant: "outline" as const })
    : undefined;
  return (
    <article
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        "focus-visible:ring-ring bg-background border-border space-y-2 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={titleId} className="text-foreground font-medium">
          Fraud case
        </h3>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        <span className="text-muted-foreground">
          Score <span className="text-foreground font-medium">{scoreLabel}</span>
        </span>
        {wouldHaveBlocked && <Badge variant="outline">Would have blocked</Badge>}
      </div>
      {reasons.length > 0 && (
        <ul className="text-foreground list-disc space-y-1 pl-5">
          {reasons.map((reason) => (
            <li key={reason.code}>{reason.text}</li>
          ))}
        </ul>
      )}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          {decisionCount} {decisionCount === 1 ? "decision" : "decisions"}
        </span>
        {lastSeenLabel && <span>Last seen {lastSeenLabel}</span>}
      </div>
      {(onViewDecisions || onClear || onConfirm) && (
        <div className="flex flex-wrap gap-2">
          {onViewDecisions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={onViewDecisions}
            >
              View decisions
            </Button>
          )}
          {onClear && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={onClear}
            >
              Clear it
            </Button>
          )}
          {onConfirm && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={onConfirm}
            >
              Confirm fraud
            </Button>
          )}
        </div>
      )}
      {children}
    </article>
  );
}
