/**
 * Promotions Panel
 *
 * Main panel for the Promotions tab in the Customer 360 view.
 * Shows promotion-category event rules as rich cards with inline
 * target progress. Clicking a card opens a detail Sheet.
 */

"use client";

import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../../../../lib/utils";
import { Badge } from "../../../../primitives/badge";
import { Button } from "../../../../primitives/button";
import { Skeleton } from "../../../../primitives/skeleton";
import { AllTargetsSheet } from "./all-targets-sheet";
import { PromotionRuleCard } from "./promotion-rule-card";
import { PromotionRuleDetailSheet } from "./promotion-rule-detail-sheet";
import type { CustomerPromotionRule, PromotionStatusFilter } from "./types";

const PAGE_SIZE = 10;

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PromotionsPanelProps {
  /** Promotion rules with nested targets. undefined = loading, null = error */
  promotionRules?: CustomerPromotionRule[] | null;
  /** Callback when user clicks an event link in a target detail sheet */
  onEventClick?: (eventId: string) => void;
}

// ─── Status Filter Options ──────────────────────────────────────────────────

const STATUS_FILTERS: Array<{ id: PromotionStatusFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "NOT_REGISTERED", label: "Not Registered" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "ACHIEVED", label: "Achieved" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "EXPIRED", label: "Expired" },
];

/** Match a rule's promotion target status against the filter. */
function matchesFilter(rule: CustomerPromotionRule, filter: PromotionStatusFilter): boolean {
  if (filter === "ALL") return true;
  // Rules without a promotion target are implicitly NOT_REGISTERED
  if (!rule.promotionTarget) return filter === "NOT_REGISTERED";
  return rule.promotionTarget.status === filter;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PromotionsPanel({ promotionRules, onEventClick }: PromotionsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<PromotionStatusFilter>("ALL");
  const [selectedRule, setSelectedRule] = useState<CustomerPromotionRule | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [allTargetsOpen, setAllTargetsOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Filter rules by status
  const filteredRules = useMemo(() => {
    if (!promotionRules) return [];
    return promotionRules.filter((r) => matchesFilter(r, statusFilter));
  }, [promotionRules, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRules.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRules = filteredRules.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Count per status for filter badges
  const statusCounts = useMemo((): Record<PromotionStatusFilter, number> => {
    const counts: Record<string, number> = {
      ALL: 0,
      NOT_REGISTERED: 0,
      IN_PROGRESS: 0,
      ACHIEVED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
    };
    if (!promotionRules) return counts as Record<PromotionStatusFilter, number>;
    counts.ALL = promotionRules.length;
    for (const rule of promotionRules) {
      const status = rule.promotionTarget?.status ?? "NOT_REGISTERED";
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] = (counts[status] ?? 0) + 1;
      }
    }
    return counts as Record<PromotionStatusFilter, number>;
  }, [promotionRules]);

  const handleViewDetails = (rule: CustomerPromotionRule) => {
    setSelectedRule(rule);
    setSheetOpen(true);
  };

  // Loading state
  if (promotionRules === undefined) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (promotionRules === null) {
    return (
      <div role="alert" className="border-destructive/30 bg-destructive/5 rounded-lg border p-4">
        <p className="text-destructive text-sm font-medium">
          Failed to load promotions. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter bar */}
      <div
        role="group"
        aria-label="Filter promotions by status"
        className="flex flex-wrap items-center gap-2"
      >
        {STATUS_FILTERS.map((filter) => {
          const count = statusCounts[filter.id] ?? 0;
          const isActive = statusFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => {
                setStatusFilter(filter.id);
                setPage(0);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              aria-pressed={isActive}
              aria-label={`${filter.label}${count > 0 ? `, ${count} rules` : ""}`}
            >
              {filter.label}
              {count > 0 && (
                <Badge
                  variant={isActive ? "outline" : "secondary"}
                  className={cn(
                    "ml-0.5 px-1.5 py-0 text-[10px]",
                    isActive && "border-primary-foreground/30 text-primary-foreground"
                  )}
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAllTargetsOpen(true)}
          className="text-primary hover:text-primary/80 ml-auto inline-flex items-center gap-1 text-xs font-medium transition-colors"
          aria-label="View all promotion targets"
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
          View All Targets
        </button>
      </div>

      {/* Rule card list */}
      {pagedRules.length > 0 ? (
        <ul className="space-y-3" role="list" aria-label="Promotion rules">
          {pagedRules.map((rule) => (
            <li key={rule.eventRuleId}>
              <PromotionRuleCard rule={rule} onViewDetails={() => handleViewDetails(rule)} />
            </li>
          ))}
        </ul>
      ) : promotionRules.length === 0 ? (
        <EmptyState message="No promotions found for this customer." />
      ) : (
        <EmptyState message="No promotions match the selected filter." />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="Promotion rules pagination"
          className="flex items-center justify-between pt-2"
        >
          <span className="text-muted-foreground text-xs">
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredRules.length)}{" "}
            of {filteredRules.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground px-2 text-xs">
              Page {safePage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}

      {/* Detail Sheet */}
      <PromotionRuleDetailSheet
        rule={selectedRule}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEventClick={onEventClick}
      />

      {/* All Targets Sheet */}
      <AllTargetsSheet
        rules={promotionRules}
        open={allTargetsOpen}
        onOpenChange={setAllTargetsOpen}
        onEventClick={onEventClick}
      />
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading promotions">
      {/* Filter bar skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      {/* Card skeletons */}
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}
