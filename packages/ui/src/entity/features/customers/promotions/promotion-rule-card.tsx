/**
 * Promotion Rule Card
 *
 * Displays a single promotion-category event rule with inline target
 * progress metrics, status badge, and action summaries.
 */

"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "../../../../data-display/status-badge";
import { cn } from "../../../../lib/utils";
import { Badge } from "../../../../primitives/badge";
import { Button } from "../../../../primitives/button";
import { Card } from "../../../../primitives/card";
import { EventRuleCategoryBadge } from "../../event-rules/event-rule-category-badge";
import { PromotionTargetMetrics } from "./promotion-target-metrics";
import type { CustomerPromotionRule } from "./types";

export interface PromotionRuleCardProps {
  /** The promotion rule to display */
  rule: CustomerPromotionRule;
  /** Callback when the card is clicked to view details */
  onViewDetails: () => void;
}

/** Derive a display status from the promotion target (or the rule itself). */
function getPromotionStatus(rule: CustomerPromotionRule): string {
  if (!rule.promotionTarget) return "Not Registered";
  const s = rule.promotionTarget.status;
  switch (s) {
    case "NOT_REGISTERED":
      return "Not Registered";
    case "IN_PROGRESS":
      return "In Progress";
    case "ACHIEVED":
      return "Achieved";
    case "EXPIRED":
      return "Expired";
    case "CANCELLED":
      return "Cancelled";
    default:
      return s;
  }
}

/**
 * Card component for a single promotion event rule.
 *
 * Layout:
 * - Row 1: Rule name + category badge + status badge + chevron
 * - Row 2: Inline target metrics (progress bar)
 * - Row 3 (collapsible): Action summaries
 */
export function PromotionRuleCard({ rule, onViewDetails }: PromotionRuleCardProps) {
  const [showActions, setShowActions] = useState(false);
  const statusLabel = getPromotionStatus(rule);

  return (
    <Card
      className={cn(
        "p-0 transition-shadow hover:shadow-md",
        "focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2"
      )}
    >
      <div className="p-4">
        {/* Clickable area: Title + Metrics */}
        <button
          type="button"
          className="w-full cursor-pointer text-left focus-visible:outline-none"
          onClick={onViewDetails}
          aria-label={`View details for ${rule.eventRuleName}`}
        >
          {/* Row 1: Title + Badges + Chevron */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{rule.eventRuleName}</h3>
              <EventRuleCategoryBadge category={rule.category} size="sm" />
              <StatusBadge status={statusLabel} />
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
          </div>

          {/* Row 2: Promotion Target Metrics */}
          <div>
            <PromotionTargetMetrics
              target={rule.promotionTarget}
              emptyMessage="Not yet registered for this customer"
            />
          </div>
        </button>

        {/* Row 3: Actions (sibling to button, not nested) */}
        {rule.actionSummaries.length > 0 && (
          <div className="border-border mt-3 border-t pt-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Actions</span>
              <Badge variant="secondary" className="text-xs">
                {rule.actionSummaries.length}
              </Badge>
            </div>
            <ul className="space-y-0.5">
              {rule.actionSummaries.slice(0, showActions ? undefined : 2).map((summary) => (
                <li key={summary} className="text-foreground text-xs">
                  &bull; {summary}
                </li>
              ))}
            </ul>
            {rule.actionSummaries.length > 2 && (
              <Button
                variant="link"
                size="sm"
                className="text-muted-foreground mt-1 h-auto p-0 text-xs"
                onClick={() => setShowActions((v) => !v)}
              >
                {showActions ? "Show less" : `+${rule.actionSummaries.length - 2} more`}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
