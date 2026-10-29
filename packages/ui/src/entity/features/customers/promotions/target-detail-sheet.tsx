/**
 * Target Detail Sheet
 *
 * Right-side Sheet showing full details for a promotion target.
 * Displays type-specific information: counter cycles, milestone steps,
 * X-of-Y items, or completion state. Stacks on top of the parent sheet.
 */

"use client";

import { formatDateTime } from "@loom-loyalty/core";
import { Check, ChevronDown, ChevronRight, Clock, ExternalLink, X } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "../../../../data-display/status-badge";
import { Badge } from "../../../../primitives/badge";
import { Card, CardContent } from "../../../../primitives/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../primitives/collapsible";
import { Progress } from "../../../../primitives/progress";
import { Separator } from "../../../../primitives/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../../primitives/sheet";
import { EntityLinkButton, truncateId } from "../entity-link-button.js";
import type {
  CustomerPromotionTarget,
  PromotionTargetCycle,
  PromotionTargetEventDetail,
  PromotionTargetItem,
} from "./types";
import { formatTargetStatus } from "./utils";

const EVENTS_INITIAL_LIMIT = 5;

// ─── Props ──────────────────────────────────────────────────────────────────

export interface TargetDetailSheetProps {
  target: CustomerPromotionTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback when user clicks an event link (registered/achieved/cancelled event ID) */
  onEventClick?: (eventId: string) => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TargetDetailSheet({
  target,
  open,
  onOpenChange,
  onEventClick,
}: TargetDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" hideCloseButton>
        <SheetHeader>
          <SheetTitle>{target?.targetName ?? "Target Details"}</SheetTitle>
          <SheetDescription>Promotion target details and progress</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {target && <TargetDetailContent target={target} onEventClick={onEventClick} />}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// ─── Detail Content ─────────────────────────────────────────────────────────

function TargetDetailContent({
  target,
  onEventClick,
}: {
  target: CustomerPromotionTarget;
  onEventClick?: (eventId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{target.targetType.replace(/_/g, " ")}</Badge>
        <StatusBadge status={formatTargetStatus(target.status)} />
      </div>

      {/* Overview */}
      <section aria-labelledby={`target-overview-${target.entityTargetId}`}>
        <h3
          id={`target-overview-${target.entityTargetId}`}
          className="text-foreground mb-3 text-sm font-semibold"
        >
          Overview
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Code</dt>
          <dd className="text-foreground font-mono text-xs">{target.targetCode}</dd>

          <dt className="text-muted-foreground">Status</dt>
          <dd className="text-foreground">{formatTargetStatus(target.status)}</dd>

          {target.startDateTime && (
            <>
              <dt className="text-muted-foreground">Start</dt>
              <dd className="text-foreground">
                <time dateTime={target.startDateTime}>{formatDateTime(target.startDateTime)}</time>
              </dd>
            </>
          )}

          {target.endDateTime && (
            <>
              <dt className="text-muted-foreground">End</dt>
              <dd className="text-foreground">
                <time dateTime={target.endDateTime}>{formatDateTime(target.endDateTime)}</time>
              </dd>
            </>
          )}

          {target.achievedDateTime && (
            <>
              <dt className="text-muted-foreground">Achieved</dt>
              <dd className="text-foreground">
                <time dateTime={target.achievedDateTime}>
                  {formatDateTime(target.achievedDateTime)}
                </time>
              </dd>
            </>
          )}
        </dl>
      </section>

      {/* Event Links */}
      {(target.registeredEventId || target.achievedEventId || target.cancelledEventId) && (
        <>
          <Separator />
          <section aria-labelledby={`event-links-${target.entityTargetId}`}>
            <h3
              id={`event-links-${target.entityTargetId}`}
              className="text-foreground mb-3 text-sm font-semibold"
            >
              Event Links
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {target.registeredEventId && (
                <>
                  <dt className="text-muted-foreground">Registered</dt>
                  <dd>
                    <EntityLinkButton
                      id={target.registeredEventId}
                      entityLabel="event"
                      onClick={onEventClick}
                    />
                  </dd>
                </>
              )}
              {target.achievedEventId && (
                <>
                  <dt className="text-muted-foreground">Achieved</dt>
                  <dd>
                    <EntityLinkButton
                      id={target.achievedEventId}
                      entityLabel="event"
                      onClick={onEventClick}
                    />
                  </dd>
                </>
              )}
              {target.cancelledEventId && (
                <>
                  <dt className="text-muted-foreground">Cancelled</dt>
                  <dd>
                    <EntityLinkButton
                      id={target.cancelledEventId}
                      entityLabel="event"
                      onClick={onEventClick}
                    />
                  </dd>
                </>
              )}
            </dl>
          </section>
        </>
      )}

      <Separator />

      {/* Type-specific details */}
      {target.targetType === "COUNTER" && (
        <CounterDetails target={target} onEventClick={onEventClick} />
      )}
      {target.targetType === "MILESTONE" && <MilestoneDetails target={target} />}
      {target.targetType === "X_OF_Y" && <XOfYDetails target={target} />}
      {target.targetType === "COMPLETION" && <CompletionDetails target={target} />}
    </div>
  );
}

// ─── Counter Details ────────────────────────────────────────────────────────

function CounterDetails({
  target,
  onEventClick,
}: {
  target: CustomerPromotionTarget;
  onEventClick?: (eventId: string) => void;
}) {
  const cycles = target.cycles;
  const hasCycles = cycles && cycles.length > 0;
  const cyclesCompleted = target.cyclesCompleted ?? 0;
  const totalCycles = target.numberOfCycles ?? target.totalCycles ?? 0;

  return (
    <section aria-labelledby={`counter-details-${target.entityTargetId}`}>
      <h3
        id={`counter-details-${target.entityTargetId}`}
        className="text-foreground mb-3 text-sm font-semibold"
      >
        Counter Details
      </h3>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {target.targetValue != null && (
          <StatCard label="Target Value" value={target.targetValue.toLocaleString()} />
        )}
        {totalCycles > 0 && (
          <StatCard label="Cycles" value={`${cyclesCompleted} / ${totalCycles}`} />
        )}
        {target.carryOverToNextCycle != null && (
          <StatCard label="Carry Over" value={target.carryOverToNextCycle ? "Yes" : "No"} />
        )}
        {target.cycleMustBeConsecutive != null && (
          <StatCard label="Consecutive" value={target.cycleMustBeConsecutive ? "Required" : "No"} />
        )}
      </div>

      {/* Current progress */}
      {target.currentValue != null && target.targetValue != null && target.targetValue > 0 && (
        <div className="mb-4">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
            <span>Current Cycle Progress</span>
            <span>
              {target.currentValue.toLocaleString()} / {target.targetValue.toLocaleString()} (
              {Math.round((target.currentValue / target.targetValue) * 100)}%)
            </span>
          </div>
          <Progress
            value={Math.min(100, Math.round((target.currentValue / target.targetValue) * 100))}
            className="h-2"
            variant="default"
            aria-label={`Current cycle progress: ${Math.round((target.currentValue / target.targetValue) * 100)}%`}
          />
        </div>
      )}

      {/* Cycle accordion */}
      {hasCycles && (
        <div className="space-y-2">
          <h4 className="text-foreground text-xs font-semibold tracking-wide uppercase">
            Cycle History
          </h4>
          {cycles.map((cycle) => (
            <CycleAccordion key={cycle.cycleId} cycle={cycle} onEventClick={onEventClick} />
          ))}
        </div>
      )}
    </section>
  );
}

function CycleAccordion({
  cycle,
  onEventClick,
}: {
  cycle: PromotionTargetCycle;
  onEventClick?: (eventId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pct =
    cycle.targetValue > 0 ? Math.round((cycle.currentValue / cycle.targetValue) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 p-3 text-left"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Cycle {cycle.cycleNumber}</span>
                {cycle.achieved ? (
                  <Badge variant="default" className="bg-success text-success-foreground text-xs">
                    Achieved
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {pct}%
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {cycle.currentValue.toLocaleString()} / {cycle.targetValue.toLocaleString()}
                {cycle.startDateTime && (
                  <>
                    {" "}
                    &middot;{" "}
                    <time dateTime={cycle.startDateTime}>
                      {formatDateTime(cycle.startDateTime)}
                    </time>
                  </>
                )}
                {cycle.endDateTime && (
                  <>
                    {" – "}
                    <time dateTime={cycle.endDateTime}>{formatDateTime(cycle.endDateTime)}</time>
                  </>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-border border-t px-3 pt-2 pb-3">
            <Progress
              value={Math.min(100, pct)}
              className="mb-3 h-1.5"
              variant="default"
              aria-label={`Cycle ${cycle.cycleNumber} progress: ${pct}%`}
            />
            {cycle.details && cycle.details.length > 0 ? (
              <ContributingEventsTable details={cycle.details} onEventClick={onEventClick} />
            ) : (
              <p className="text-muted-foreground text-xs italic">No contributing events</p>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Contributing Events Table ──────────────────────────────────────────────

function ContributingEventsTable({
  details,
  onEventClick,
}: {
  details: PromotionTargetEventDetail[];
  onEventClick?: (eventId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? details : details.slice(0, EVENTS_INITIAL_LIMIT);
  const hasMore = details.length > EVENTS_INITIAL_LIMIT;

  return (
    <div>
      <div className="text-muted-foreground mb-2 flex items-center justify-between text-xs font-medium">
        <span>Contributing Events</span>
        <span>{details.length} events</span>
      </div>
      <div className="border-border overflow-hidden rounded-md border">
        <table className="w-full text-xs">
          <caption className="sr-only">Contributing events for this cycle</caption>
          <thead>
            <tr className="border-chrome-border bg-muted/50 border-b">
              <th className="text-chrome-muted-foreground px-2.5 py-1.5 text-left font-medium">
                Event
              </th>
              <th className="text-chrome-muted-foreground px-2.5 py-1.5 text-left font-medium">
                Date
              </th>
              <th className="text-chrome-muted-foreground px-2.5 py-1.5 text-right font-medium">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((detail, i) => (
              <tr key={`${detail.eventId}-${i}`} className="border-border border-b last:border-b-0">
                <td className="px-2.5 py-1.5">
                  {onEventClick ? (
                    <button
                      type="button"
                      onClick={() => onEventClick(detail.eventId)}
                      className="text-primary hover:text-primary/80 inline-flex cursor-pointer items-center gap-1 font-mono transition-colors"
                      title={detail.eventId}
                      aria-label={`View event ${detail.eventId}`}
                    >
                      {detail.description || truncateId(detail.eventId)}
                      <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="text-foreground font-mono" title={detail.eventId}>
                      {detail.description || truncateId(detail.eventId)}
                    </span>
                  )}
                </td>
                <td className="text-muted-foreground px-2.5 py-1.5 whitespace-nowrap">
                  <time dateTime={detail.eventDateTime}>
                    {formatDateTime(detail.eventDateTime)}
                  </time>
                </td>
                <td className="text-foreground px-2.5 py-1.5 text-right font-medium whitespace-nowrap">
                  {detail.value != null ? `+${detail.value.toLocaleString()}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="text-primary hover:text-primary/80 mt-2 cursor-pointer text-xs font-medium transition-colors"
        >
          {showAll ? "Show fewer" : `Show all ${details.length} events`}
        </button>
      )}
    </div>
  );
}

// ─── Milestone Details ──────────────────────────────────────────────────────

function MilestoneDetails({ target }: { target: CustomerPromotionTarget }) {
  const items = target.items;
  const completed = target.milestoneIndex ?? 0;
  const total = target.totalMilestones ?? items?.length ?? 0;

  return (
    <section aria-labelledby={`milestone-details-${target.entityTargetId}`}>
      <h3
        id={`milestone-details-${target.entityTargetId}`}
        className="text-foreground mb-3 text-sm font-semibold"
      >
        Milestone Steps
      </h3>
      <p className="text-muted-foreground mb-3 text-sm">
        {completed} of {total} milestones complete
      </p>
      {items && items.length > 0 ? (
        <ItemsList items={items} />
      ) : (
        <p className="text-muted-foreground text-sm italic">No milestone data available</p>
      )}
    </section>
  );
}

// ─── X of Y Details ─────────────────────────────────────────────────────────

function XOfYDetails({ target }: { target: CustomerPromotionTarget }) {
  const items = target.items;
  const completed = target.completedItemIds?.length ?? target.currentValue ?? 0;
  const needed = target.itemsNeeded ?? target.targetValue ?? 0;

  return (
    <section aria-labelledby={`xofy-details-${target.entityTargetId}`}>
      <h3
        id={`xofy-details-${target.entityTargetId}`}
        className="text-foreground mb-3 text-sm font-semibold"
      >
        Items
      </h3>
      <p className="text-muted-foreground mb-3 text-sm">
        {completed} of {needed} items complete
      </p>
      {items && items.length > 0 ? (
        <ItemsList items={items} />
      ) : (
        <p className="text-muted-foreground text-sm italic">No item data available</p>
      )}
    </section>
  );
}

// ─── Completion Details ─────────────────────────────────────────────────────

function CompletionDetails({ target }: { target: CustomerPromotionTarget }) {
  return (
    <section aria-labelledby={`completion-details-${target.entityTargetId}`}>
      <h3
        id={`completion-details-${target.entityTargetId}`}
        className="text-foreground mb-3 text-sm font-semibold"
      >
        Completion Status
      </h3>
      <div className="flex items-center gap-2">
        {target.achieved || target.status === "ACHIEVED" ? (
          <>
            <Check className="text-success-dark h-5 w-5" aria-hidden="true" />
            <span className="text-foreground text-sm font-medium">Completed</span>
            {target.achievedDateTime && (
              <span className="text-muted-foreground text-xs">
                on{" "}
                <time dateTime={target.achievedDateTime}>
                  {formatDateTime(target.achievedDateTime)}
                </time>
              </span>
            )}
          </>
        ) : (
          <>
            <Clock className="text-muted-foreground h-5 w-5" aria-hidden="true" />
            <span className="text-foreground text-sm font-medium">Not Complete</span>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ItemsList({ items }: { items: PromotionTargetItem[] }) {
  return (
    <ul className="space-y-2" role="list">
      {items.map((item) => (
        <li key={item.itemId}>
          <Card className="p-0">
            <CardContent className="flex items-center gap-3 p-3">
              {item.achieved ? (
                <div
                  className="bg-success/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  aria-label="Achieved"
                >
                  <Check className="text-success-dark h-3.5 w-3.5" aria-hidden="true" />
                </div>
              ) : (
                <div
                  className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  aria-label="Pending"
                >
                  <X className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {item.targetName || item.targetCode || item.itemId || "Unnamed Item"}
                </p>
                {item.achievedDateTime && (
                  <p className="text-muted-foreground text-xs">
                    Achieved{" "}
                    <time dateTime={item.achievedDateTime}>
                      {formatDateTime(item.achievedDateTime)}
                    </time>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
