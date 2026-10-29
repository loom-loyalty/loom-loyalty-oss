/**
 * Promotion Rule Detail Sheet
 *
 * Right-side slide-in Sheet showing full details for a promotion event rule:
 * rule overview, primary promotion target with metrics, and collapsible
 * sections for occurrence and currency targets.
 *
 * Clicking a target card opens a stacked TargetDetailSheet.
 */

"use client";

import { formatDateTime } from "@loom-loyalty/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "../../../../data-display/status-badge";
import { Badge } from "../../../../primitives/badge";
import { Card, CardContent } from "../../../../primitives/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../primitives/collapsible";
import { Separator } from "../../../../primitives/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../../primitives/sheet";
import { EventRuleCategoryBadge } from "../../event-rules/event-rule-category-badge";
import { PromotionTargetMetrics } from "./promotion-target-metrics";
import { TargetDetailSheet } from "./target-detail-sheet";
import type { CustomerPromotionRule, CustomerPromotionTarget } from "./types";
import { formatTargetStatus } from "./utils";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PromotionRuleDetailSheetProps {
  rule: CustomerPromotionRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback when user clicks an event link in a target detail sheet */
  onEventClick?: (eventId: string) => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PromotionRuleDetailSheet({
  rule,
  open,
  onOpenChange,
  onEventClick,
}: PromotionRuleDetailSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<CustomerPromotionTarget | null>(null);
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);

  const handleTargetClick = (target: CustomerPromotionTarget) => {
    setSelectedTarget(target);
    setTargetSheetOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" hideCloseButton>
          <SheetHeader>
            <SheetTitle>{rule?.eventRuleName ?? "Promotion Rule"}</SheetTitle>
            <SheetDescription>Promotion rule details and target progress</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {rule && <DetailContent rule={rule} onTargetClick={handleTargetClick} />}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* Stacked target detail */}
      <TargetDetailSheet
        target={selectedTarget}
        open={targetSheetOpen}
        onOpenChange={setTargetSheetOpen}
        onEventClick={onEventClick}
      />
    </>
  );
}

// ─── Detail Content ─────────────────────────────────────────────────────────

function DetailContent({
  rule,
  onTargetClick,
}: {
  rule: CustomerPromotionRule;
  onTargetClick: (target: CustomerPromotionTarget) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Rule Overview */}
      <section aria-labelledby="rule-overview-heading">
        <h3 id="rule-overview-heading" className="text-foreground mb-3 text-sm font-semibold">
          Rule Overview
        </h3>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <EventRuleCategoryBadge category={rule.category} size="sm" />
          {rule.promotionTarget && (
            <StatusBadge status={formatTargetStatus(rule.promotionTarget.status)} />
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Code</dt>
          <dd className="text-foreground font-mono text-xs">{rule.eventRuleCode}</dd>

          {rule.description && (
            <>
              <dt className="text-muted-foreground">Description</dt>
              <dd className="text-foreground">
                {typeof rule.description === "string"
                  ? rule.description
                  : JSON.stringify(rule.description)}
              </dd>
            </>
          )}

          <dt className="text-muted-foreground">Event Type</dt>
          <dd className="text-foreground">{rule.eventTypeName ?? rule.eventTypeCode}</dd>

          <dt className="text-muted-foreground">Category</dt>
          <dd className="text-foreground capitalize">{rule.category.toLowerCase()}</dd>
        </dl>
      </section>

      <Separator />

      {/* Action Summaries */}
      {rule.actionSummaries.length > 0 && (
        <>
          <section aria-labelledby="actions-heading">
            <div className="mb-2 flex items-center gap-2">
              <h3 id="actions-heading" className="text-foreground text-sm font-semibold">
                Actions
              </h3>
              <Badge variant="secondary" className="text-xs">
                {rule.actionSummaries.length}
              </Badge>
            </div>
            <ul className="space-y-1">
              {rule.actionSummaries.map((summary) => (
                <li key={summary} className="text-foreground text-sm">
                  &bull; {summary}
                </li>
              ))}
            </ul>
          </section>
          <Separator />
        </>
      )}

      {/* Promotion Target */}
      <section aria-labelledby="promotion-target-heading">
        <h3 id="promotion-target-heading" className="text-foreground mb-3 text-sm font-semibold">
          Promotion Target
        </h3>
        {rule.promotionTarget ? (
          <TargetCard target={rule.promotionTarget} onClick={onTargetClick} />
        ) : (
          <p className="text-muted-foreground text-sm italic">
            Not yet registered for this customer
          </p>
        )}
      </section>

      {/* Occurrence Targets */}
      {rule.occurrenceTargets.length > 0 && (
        <>
          <Separator />
          <TargetSection
            id="occurrence-targets"
            title="Occurrence Targets"
            targets={rule.occurrenceTargets}
            onTargetClick={onTargetClick}
          />
        </>
      )}

      {/* Currency Targets */}
      {rule.currencyTargets.length > 0 && (
        <>
          <Separator />
          <TargetSection
            id="currency-targets"
            title="Currency Targets"
            targets={rule.currencyTargets}
            onTargetClick={onTargetClick}
          />
        </>
      )}
    </div>
  );
}

// ─── Target Card ────────────────────────────────────────────────────────────

function TargetCard({
  target,
  onClick,
}: {
  target: CustomerPromotionTarget;
  onClick: (target: CustomerPromotionTarget) => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => onClick(target)}
      aria-label={`View details for ${target.targetName}`}
    >
      <Card className="hover:border-primary/30 cursor-pointer p-0 transition-colors">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h4 className="truncate text-sm font-medium">{target.targetName}</h4>
              <Badge variant="outline" className="shrink-0 text-xs">
                {target.targetType.replace(/_/g, " ")}
              </Badge>
            </div>
            <StatusBadge status={formatTargetStatus(target.status)} />
          </div>

          <PromotionTargetMetrics target={target} />

          {/* Date info */}
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {target.startDateTime && (
              <span>
                Started:{" "}
                <time dateTime={target.startDateTime}>{formatDateTime(target.startDateTime)}</time>
              </span>
            )}
            {target.endDateTime && (
              <span>
                Ends:{" "}
                <time dateTime={target.endDateTime}>{formatDateTime(target.endDateTime)}</time>
              </span>
            )}
            {target.achievedDateTime && (
              <span>
                Achieved:{" "}
                <time dateTime={target.achievedDateTime}>
                  {formatDateTime(target.achievedDateTime)}
                </time>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

// ─── Collapsible Target Section ─────────────────────────────────────────────

function TargetSection({
  id,
  title,
  targets,
  onTargetClick,
}: {
  id: string;
  title: string;
  targets: CustomerPromotionTarget[];
  onTargetClick: (target: CustomerPromotionTarget) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section aria-labelledby={`${id}-heading`}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            )}
            <h3 id={`${id}-heading`} className="text-foreground text-sm font-semibold">
              {title}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {targets.length}
            </Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-3 space-y-3" role="list">
            {targets.map((target) => (
              <li key={target.entityTargetId}>
                <TargetCard target={target} onClick={onTargetClick} />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
