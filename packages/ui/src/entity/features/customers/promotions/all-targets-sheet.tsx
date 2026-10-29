/**
 * All Targets Sheet
 *
 * Right-side Sheet showing a flat list of ALL targets across all promotion
 * rules. Each target is clickable and opens a TargetDetailSheet stacked on top.
 */

"use client";

import { useState } from "react";

import { StatusBadge } from "../../../../data-display/status-badge";
import { Badge } from "../../../../primitives/badge";
import { Card, CardContent } from "../../../../primitives/card";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../../primitives/sheet";
import { PromotionTargetMetrics } from "./promotion-target-metrics";
import { TargetDetailSheet } from "./target-detail-sheet";
import type { CustomerPromotionRule, CustomerPromotionTarget } from "./types";
import { formatTargetStatus } from "./utils";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface AllTargetsSheetProps {
  rules: CustomerPromotionRule[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback when user clicks an event link in a target detail sheet */
  onEventClick?: (eventId: string) => void;
}

// ─── Flattened Target ───────────────────────────────────────────────────────

interface FlatTarget {
  target: CustomerPromotionTarget;
  ruleName: string;
  category: "promotion" | "occurrence" | "currency";
}

function flattenTargets(rules: CustomerPromotionRule[]): FlatTarget[] {
  const flat: FlatTarget[] = [];
  for (const rule of rules) {
    if (rule.promotionTarget) {
      flat.push({
        target: rule.promotionTarget,
        ruleName: rule.eventRuleName,
        category: "promotion",
      });
    }
    for (const t of rule.occurrenceTargets) {
      flat.push({ target: t, ruleName: rule.eventRuleName, category: "occurrence" });
    }
    for (const t of rule.currencyTargets) {
      flat.push({ target: t, ruleName: rule.eventRuleName, category: "currency" });
    }
  }
  return flat;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AllTargetsSheet({ rules, open, onOpenChange, onEventClick }: AllTargetsSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<CustomerPromotionTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const flatTargets = flattenTargets(rules);

  const handleTargetClick = (target: CustomerPromotionTarget) => {
    setSelectedTarget(target);
    setDetailOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" hideCloseButton>
          <SheetHeader>
            <SheetTitle>
              All Promotion Targets
              <Badge variant="secondary" className="ml-2 text-xs">
                {flatTargets.length}
              </Badge>
            </SheetTitle>
            <SheetDescription>All targets across promotion rules</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {flatTargets.length > 0 ? (
              <ul className="space-y-3" role="list" aria-label="All promotion targets">
                {flatTargets.map((ft) => (
                  <li key={`${ft.ruleName}-${ft.target.entityTargetId}`}>
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => handleTargetClick(ft.target)}
                      aria-label={`View details for ${ft.target.targetName}`}
                    >
                      <Card className="hover:border-primary/30 cursor-pointer p-0 transition-colors">
                        <CardContent className="p-4">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <h4 className="truncate text-sm font-medium">
                                {ft.target.targetName}
                              </h4>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {ft.target.targetType.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <StatusBadge status={formatTargetStatus(ft.target.status)} />
                          </div>
                          <p className="text-muted-foreground mb-2 text-xs">{ft.ruleName}</p>
                          <PromotionTargetMetrics target={ft.target} />
                        </CardContent>
                      </Card>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <p className="text-muted-foreground text-sm">No promotion targets found.</p>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* Stacked target detail */}
      <TargetDetailSheet
        target={selectedTarget}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEventClick={onEventClick}
      />
    </>
  );
}
