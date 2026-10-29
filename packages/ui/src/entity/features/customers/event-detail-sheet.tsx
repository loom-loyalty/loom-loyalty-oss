/**
 * Event Detail Sheet
 *
 * Right-side sheet showing full event details with tabbed content:
 * Overview, Event Data, Actions, Properties.
 */

"use client";

import { Check, ChevronDown, ChevronRight, Copy, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { formatDateTime } from "@loom-loyalty/core";
import type { UIFieldConfig } from "@loom-loyalty/schema";
import { GradientTabs, type TabItem } from "../../../data-display/gradient-tabs";
import { StatusBadge } from "../../../data-display/status-badge";
import { pathToBreadcrumbs } from "../../../expressions/inputs/json-path-input";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import { Button } from "../../../primitives/button";
import { Card, CardContent } from "../../../primitives/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../primitives/collapsible";
import { Separator } from "../../../primitives/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../primitives/sheet";
import { Skeleton } from "../../../primitives/skeleton";
import { EntityDetailFields } from "../../entity-detail";
import { EntityLinkButton } from "./entity-link-button";
import { EventStatusBadge } from "./event-status-badge";
import type {
  CustomerEvent,
  CustomerEventAction,
  CustomerEventTag,
  EntityNameMap,
  LedgerEntry,
} from "./types";
import { detectActionType, formatEventTypeLabel, getEventActionBadgeLabel } from "./types";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface EventDetailSheetProps {
  event: CustomerEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional entity name map for resolving UUIDs to display names */
  entityNames?: EntityNameMap;
  /**
   * Whether the event's actions are still being fetched. While true, the
   * Actions tab shows a loading skeleton instead of the "No effect recorded"
   * badge — an empty `eventActions` array must never be mistaken for a
   * confirmed absence before the query has actually resolved.
   */
  actionsLoading?: boolean;
  /** Whether event tags are currently being fetched */
  tagsLoading?: boolean;
  /** Whether the event tags fetch failed */
  tagsError?: boolean;
  /** Whether the selected event's full data payload is being fetched */
  eventDataLoading?: boolean;
  /** Whether the selected event's full data payload fetch failed */
  eventDataError?: boolean;
  /** The ledger entry this event produced, when one was found in the loaded ledger. */
  ledgerEntry?: LedgerEntry | null;
  /**
   * Whether the loaded ledger provably covers every entry the customer has.
   * A miss is only reported as a confirmed absence when this is true —
   * otherwise the entry may simply lie beyond the fetched pages.
   */
  ledgerComplete?: boolean;
  /** Opens the ledger view for the linked entry. Omit to render the ID as plain text. */
  onLedgerEntryClick?: (entryId: string) => void;
  /**
   * Controls offered for the recorded activity itself — correcting it, or
   * cancelling it. Supplied by the app so this sheet stays presentational and
   * has no opinion on which operator may do either.
   */
  actions?: ReactNode;
  /**
   * Declared data-model fields matching this event's payload. `undefined`
   * retains the raw JSON fallback when model resolution is unavailable; an
   * empty array means resolution completed with no fields worth showing.
   */
  eventDataFields?: UIFieldConfig[];
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EventDetailSheet({
  event,
  open,
  onOpenChange,
  entityNames,
  actionsLoading,
  tagsLoading,
  tagsError,
  eventDataLoading,
  eventDataError,
  ledgerEntry,
  ledgerComplete,
  onLedgerEntryClick,
  actions,
  eventDataFields,
}: EventDetailSheetProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [prevEventId, setPrevEventId] = useState(event?.eventId);

  // Reset to overview when the event changes (derived state pattern)
  if (event?.eventId !== prevEventId) {
    setPrevEventId(event?.eventId);
    setActiveTab("overview");
  }

  // Build tabs dynamically based on available data
  const hasEventData = !!event?.eventData && Object.keys(event.eventData).length > 0;
  const hasEventDataTab =
    eventDataLoading || eventDataError || (hasEventData && eventDataFields?.length !== 0);
  const tabs = useMemo<TabItem[]>(() => {
    if (!event) return [{ id: "overview", label: "Overview" }];
    const result: TabItem[] = [{ id: "overview", label: "Overview" }];
    if (hasEventDataTab) {
      result.push({ id: "eventData", label: "Event Data" });
    }
    // The Actions tab always renders, even when there are no actions to show.
    // An event that triggered nothing still needs a place to say so
    // explicitly ("No effect recorded") rather than the tab silently
    // disappearing, which would look identical to "not checked yet".
    result.push({
      id: "actions",
      label: "Actions",
      count: !actionsLoading && event.eventActions?.length ? event.eventActions.length : undefined,
    });
    if (event.properties && Object.keys(event.properties).length > 0) {
      result.push({ id: "properties", label: "Properties" });
    }
    // Show the Tags tab when loading, on error, or when tags exist.
    // If the fetch completes with an empty array the tab disappears,
    // and the effectiveTab fallback resets to "overview" gracefully.
    if (tagsLoading || tagsError || (event.tags && event.tags.length > 0)) {
      result.push({
        id: "tags",
        label: "Tags",
        count: !tagsLoading && !tagsError ? event.tags?.length : undefined,
      });
    }
    return result;
  }, [event, actionsLoading, hasEventDataTab, tagsLoading, tagsError]);

  // If the active tab is no longer in the list (e.g., Tags tab disappears
  // after fetch completes with empty results), fall back to "overview".
  const effectiveTab = useMemo(
    () => (tabs.some((t) => t.id === activeTab) ? activeTab : "overview"),
    [tabs, activeTab]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        {event && (
          <>
            <SheetHeader>
              <SheetTitle>{event.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2">
                  <time dateTime={event.eventDateTime} className="text-muted-foreground text-sm">
                    {formatDateTime(event.eventDateTime)}
                  </time>
                  {(() => {
                    const actionLabel = getEventActionBadgeLabel(event);
                    return actionLabel ? (
                      <Badge variant="secondary" className="text-xs">
                        {actionLabel}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {formatEventTypeLabel(event.eventType)}
                      </Badge>
                    );
                  })()}
                  {event.status && <EventStatusBadge status={event.status} />}
                </div>
              </SheetDescription>
              {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
            </SheetHeader>

            <SheetBody className="flex flex-1 flex-col gap-4 overflow-y-auto">
              <GradientTabs
                tabs={tabs}
                activeTab={effectiveTab}
                onTabChange={setActiveTab}
                ariaLabel="Event detail tabs"
              />

              {/* Overview tab */}
              <div
                role="tabpanel"
                id="tabpanel-overview"
                aria-labelledby="tab-overview"
                hidden={effectiveTab !== "overview"}
              >
                {effectiveTab === "overview" && (
                  <OverviewPanel
                    event={event}
                    ledgerEntry={ledgerEntry}
                    ledgerComplete={ledgerComplete}
                    onLedgerEntryClick={onLedgerEntryClick}
                  />
                )}
              </div>

              {/* Event Data tab */}
              {hasEventDataTab && (
                <div
                  role="tabpanel"
                  id="tabpanel-eventData"
                  aria-labelledby="tab-eventData"
                  hidden={effectiveTab !== "eventData"}
                >
                  {effectiveTab === "eventData" &&
                    (eventDataLoading ? (
                      <EventDataLoadingSkeleton />
                    ) : eventDataError ? (
                      <div
                        className="border-destructive/30 bg-destructive/5 rounded-lg border p-4"
                        role="alert"
                      >
                        <p className="text-destructive text-sm">Failed to load event data.</p>
                      </div>
                    ) : event.eventData ? (
                      eventDataFields ? (
                        <EntityDetailFields fields={eventDataFields} data={event.eventData} />
                      ) : (
                        <JsonPanel data={event.eventData} label="Event data" />
                      )
                    ) : null)}
                </div>
              )}

              {/* Actions tab — always rendered (see tabs builder above). Shows
                  a loading skeleton while the actions query is pending, the
                  actions list once populated, or an explicit "No effect
                  recorded" badge once resolved to an empty array. */}
              <div
                role="tabpanel"
                id="tabpanel-actions"
                aria-labelledby="tab-actions"
                hidden={effectiveTab !== "actions"}
              >
                {effectiveTab === "actions" &&
                  (actionsLoading ? (
                    <ActionsLoadingSkeleton />
                  ) : event.eventActions && event.eventActions.length > 0 ? (
                    <ActionsPanel actions={event.eventActions} entityNames={entityNames} />
                  ) : (
                    <NoEffectRecordedPanel />
                  ))}
              </div>

              {/* Properties tab */}
              {event.properties && Object.keys(event.properties).length > 0 && (
                <div
                  role="tabpanel"
                  id="tabpanel-properties"
                  aria-labelledby="tab-properties"
                  hidden={effectiveTab !== "properties"}
                >
                  {effectiveTab === "properties" && (
                    <JsonPanel data={event.properties} label="Properties" />
                  )}
                </div>
              )}

              {/* Tags tab */}
              {(tagsLoading || tagsError || (event.tags && event.tags.length > 0)) && (
                <div
                  role="tabpanel"
                  id="tabpanel-tags"
                  aria-labelledby="tab-tags"
                  hidden={effectiveTab !== "tags"}
                >
                  {effectiveTab === "tags" &&
                    (tagsLoading ? (
                      <TagsLoadingSkeleton />
                    ) : tagsError ? (
                      <div
                        className="border-destructive/30 bg-destructive/5 rounded-lg border p-4"
                        role="alert"
                      >
                        <p className="text-destructive text-sm">Failed to load event tags.</p>
                      </div>
                    ) : (
                      event.tags && <TagsPanel tags={event.tags} />
                    ))}
                </div>
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Overview Panel ─────────────────────────────────────────────────────────

function OverviewPanel({
  event,
  ledgerEntry,
  ledgerComplete,
  onLedgerEntryClick,
}: {
  event: CustomerEvent;
  ledgerEntry?: LedgerEntry | null;
  ledgerComplete?: boolean;
  onLedgerEntryClick?: (entryId: string) => void;
}) {
  const rows: Array<{ label: string; value: string | undefined }> = [
    { label: "Event Record ID", value: event.eventRecordId },
    { label: "Event ID", value: event.eventId },
    { label: "Type", value: event.eventType ? formatEventTypeLabel(event.eventType) : undefined },
    {
      label: "Date & Time",
      value: event.eventDateTime ? formatDateTime(event.eventDateTime) : undefined,
    },
    { label: "Status", value: event.status },
    { label: "Status Description", value: event.statusDescription },
    { label: "Description", value: event.description },
    { label: "Parent Event ID", value: event.parentEventId },
    {
      label: "Archival Date",
      value: event.archivalDateTime ? formatDateTime(event.archivalDateTime) : undefined,
    },
  ];

  const visibleRows = rows.filter((r) => r.value);

  return (
    <dl className="space-y-3">
      {visibleRows.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
          <dd className="text-foreground mt-0.5 text-sm">{value}</dd>
        </div>
      ))}

      <div>
        <dt className="text-muted-foreground text-xs font-medium">Ledger Entry</dt>
        <dd className="mt-0.5">
          <LedgerEntryLink
            ledgerEntry={ledgerEntry}
            ledgerComplete={ledgerComplete}
            onLedgerEntryClick={onLedgerEntryClick}
          />
        </dd>
      </div>

      {/* Metadata key-value pairs */}
      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <>
          <Separator />
          <div>
            <dt className="text-muted-foreground mb-2 text-xs font-medium">Metadata</dt>
            <dd>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground text-xs capitalize">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-foreground text-sm font-medium">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}

// ─── Ledger Entry Link ──────────────────────────────────────────────────────

/**
 * Renders the event's effect on the ledger, in one of three deliberately
 * distinct states.
 *
 * The middle state is the reason this component exists: a join miss against a
 * page-capped ledger is NOT evidence of absence, so "no ledger entry" is only
 * claimed once `ledgerComplete` proves the whole ledger was searched. Otherwise
 * the copy says exactly what is true — nothing was found in what has loaded.
 */
function LedgerEntryLink({
  ledgerEntry,
  ledgerComplete,
  onLedgerEntryClick,
}: {
  ledgerEntry?: LedgerEntry | null;
  ledgerComplete?: boolean;
  onLedgerEntryClick?: (entryId: string) => void;
}) {
  if (ledgerEntry?.entryId) {
    return (
      <EntityLinkButton
        id={ledgerEntry.entryId}
        entityLabel="ledger entry"
        onClick={onLedgerEntryClick}
      />
    );
  }

  if (ledgerComplete) {
    return (
      <>
        <StatusBadge status="no effect recorded" />
        <p className="text-muted-foreground mt-1 text-sm">
          This event didn&apos;t produce a ledger entry.
        </p>
      </>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Not found in loaded history — the full ledger hasn&apos;t been searched.
    </p>
  );
}

// ─── Tags Loading Skeleton ───────────────────────────────────────────────

function TagsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Event Data Loading Skeleton ──────────────────────────────────────────

function EventDataLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Tags Panel ─────────────────────────────────────────────────────────

/** Source badge variant + label mapping. */
const TAG_SOURCE_STYLES: Record<
  string,
  { variant: "default" | "secondary" | "outline"; label: string }
> = {
  DATA_MODEL: { variant: "outline", label: "Data Model" },
  RULE: { variant: "secondary", label: "Rule" },
};

function TagsPanel({ tags }: { tags: CustomerEventTag[] }) {
  // Group tags by metadataTypeCategory (or "Uncategorized")
  const grouped = useMemo(() => {
    const groups = new Map<string, CustomerEventTag[]>();
    for (const tag of tags) {
      const category = tag.metadataTypeCategory || "Uncategorized";
      const existing = groups.get(category);
      if (existing) {
        existing.push(tag);
      } else {
        groups.set(category, [tag]);
      }
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tags]);

  return (
    <div className="space-y-4">
      {grouped.map(([category, categoryTags]) => (
        <section key={category} aria-label={`${category} tags`}>
          <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
            <Tag size={12} aria-hidden="true" className="shrink-0" />
            {category}
            <Badge variant="outline" className="ml-1 text-[10px]">
              {categoryTags.length}
            </Badge>
          </h3>
          <div className="space-y-2">
            {categoryTags.map((tag, idx) => {
              const sourceStyle = tag.source ? TAG_SOURCE_STYLES[tag.source] : undefined;
              return (
                <Card
                  key={tag.eventTagId || `${tag.metadataTypeCode}-${tag.value}-${idx}`}
                  className="overflow-hidden"
                >
                  <CardContent className="p-3">
                    {/* Tag header: type code + value */}
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-foreground text-sm font-medium">
                          {formatTagTypeCode(tag.metadataTypeCode)}
                        </span>
                        {tag.metadataCode && (
                          <span className="text-muted-foreground ml-1 font-mono text-xs">
                            {tag.metadataCode}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {tag.valid != null && (
                          <Badge
                            variant={tag.valid ? "success" : "destructive"}
                            className="text-[10px]"
                          >
                            {tag.valid ? "Valid" : "Invalid"}
                          </Badge>
                        )}
                        {sourceStyle && (
                          <Badge variant={sourceStyle.variant} className="text-[10px]">
                            {sourceStyle.label}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Tag value — prominent display */}
                    <div className="bg-muted/50 rounded-md border px-3 py-2">
                      <span className="text-foreground text-sm font-medium break-words">
                        {tag.value}
                      </span>
                    </div>

                    {/* Tag metadata grid */}
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {tag.inputAttribute && (
                        <div className="min-w-0">
                          <dt className="text-muted-foreground text-xs">Input Attribute</dt>
                          <dd className="text-foreground mt-0.5 text-sm">{tag.inputAttribute}</dd>
                        </div>
                      )}
                      {tag.jsonPath && (
                        <div className="col-span-2 min-w-0">
                          <dt className="text-muted-foreground text-xs">JSON Path</dt>
                          <dd className="mt-0.5">
                            <JsonPathBreadcrumb value={tag.jsonPath} />
                          </dd>
                        </div>
                      )}
                      {tag.eventRuleName && (
                        <div className="col-span-2 min-w-0">
                          <dt className="text-muted-foreground text-xs">Event Rule</dt>
                          <dd className="text-foreground mt-0.5 text-sm">{tag.eventRuleName}</dd>
                        </div>
                      )}
                    </dl>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Format a SCREAMING_SNAKE metadata type code to Title Case. */
function formatTagTypeCode(code: string): string {
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── JSON Panel ─────────────────────────────────────────────────────────────

function JsonPanel({ data, label }: { data: Record<string, unknown>; label: string }) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clean up copy timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [json]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : `Copy ${label}`}
        className="absolute top-2 right-2 z-10 h-7 w-7 p-0"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </Button>
      <pre
        className="bg-muted text-foreground overflow-x-auto rounded-md border p-4 text-xs leading-relaxed"
        aria-label={label}
      >
        <code>{json}</code>
      </pre>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a camelCase key to "Title Case" for display. */
function camelToTitle(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ─── Entity ID Resolution ────────────────────────────────────────────────────

/** Map field keys to their EntityNameMap bucket for ID→name resolution. */
const ID_FIELD_MAP: Record<string, keyof EntityNameMap> = {
  programId: "programs",
  targetId: "targets",
  entityCounterTargetId: "targets",
  eventRuleId: "eventRules",
};

/** Render a JSON path as breadcrumb pills (e.g. $.eventData.field → [Event Data] > [Field]). */
function JsonPathBreadcrumb({ value }: { value: string }) {
  const crumbs = pathToBreadcrumbs(value);
  if (!crumbs) return <span className="text-foreground text-sm break-words">{value}</span>;

  return (
    <span className="inline-flex flex-wrap items-center gap-0.5" title={value}>
      {crumbs.map((crumb, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && (
            <ChevronRight size={12} aria-hidden="true" className="text-muted-foreground shrink-0" />
          )}
          <span className="bg-muted text-foreground rounded px-1.5 py-0.5 text-xs font-medium">
            {crumb.label}
            {crumb.isArray && <span className="text-muted-foreground ml-0.5">[]</span>}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Wraps StructuredValue with entity ID resolution and JSON path breadcrumbs. */
function ResolvedValue({
  fieldKey,
  value,
  entityNames,
}: {
  fieldKey: string;
  value: unknown;
  entityNames?: EntityNameMap;
}) {
  // Entity ID resolution
  if (entityNames && typeof value === "string" && value.length > 0) {
    const bucket = ID_FIELD_MAP[fieldKey];
    if (bucket) {
      const name = entityNames[bucket].get(value);
      if (name) {
        return (
          <span className="text-foreground text-sm break-words">
            {name}{" "}
            <span className="text-muted-foreground font-mono text-xs">
              {value.length > 12 ? `${value.slice(0, 12)}…` : value}
            </span>
          </span>
        );
      }
    }

    // JSON path breadcrumbs
    if (value.startsWith("$.")) {
      return <JsonPathBreadcrumb value={value} />;
    }
  }

  return <StructuredValue value={value} />;
}

// ─── Actions Loading Skeleton ────────────────────────────────────────────────

function ActionsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── No Effect Recorded Panel ────────────────────────────────────────────────

/**
 * Shown in the Actions tab once the actions query has resolved to an empty
 * array — the event triggered no recorded action. Only ever rendered after
 * loading is definitively finished (see `actionsLoading` gating above); it
 * must never appear while data is still in flight.
 */
function NoEffectRecordedPanel() {
  return (
    <div className="border-border bg-muted/20 rounded-lg border p-4">
      <StatusBadge status="no effect recorded" />
      <p className="text-muted-foreground mt-2 text-sm">
        This event didn&apos;t trigger any actions.
      </p>
    </div>
  );
}

// ─── Actions Panel ──────────────────────────────────────────────────────────

/** Keys rendered in the card header — excluded from the detail grid. */
const ACTION_HEADER_KEYS = new Set(["rank", "eventRuleId", "eventRuleName", "actionType"]);

/**
 * Ordered field definitions for the action detail grid.
 * Fields present in the action data are shown in this order;
 * any remaining unknown fields are appended at the end.
 */
const ACTION_FIELD_ORDER: Array<{ key: string; label: string }> = [
  { key: "eventActionId", label: "Event Action Id" },
  { key: "eventRecordId", label: "Event Record Id" },
  { key: "actionData", label: "Action Data" },
  { key: "status", label: "Status" },
  { key: "executedDateTime", label: "Executed Date Time" },
  { key: "executionResult", label: "Execution Result" },
  { key: "actionOrder", label: "Action Order" },
  { key: "reversalAction", label: "Reversal Action" },
];

/** Map action type keys to semantic border colors. */
function getActionTypeBorderColor(actionType: string): string {
  switch (actionType) {
    // Currency: issue = success (green), withdraw = destructive (red)
    case "issueProgramCurrency":
      return "border-l-success";
    case "withdrawProgramCurrency":
      return "border-l-destructive";
    // Counters & targets: info (purple)
    case "addCounterData":
    case "registerTarget":
    case "completeTargetData":
      return "border-l-info";
    // Coupons: accent/warning (gold)
    case "issueCustomerCoupon":
    case "useCustomerCoupon":
    case "holdCustomerCoupon":
    case "returnCustomerCoupon":
    case "cancelCustomerCoupon":
      return "border-l-warning";
    // Badges & tiers: primary (teal)
    case "issueCustomerBadge":
    case "issueCustomerTier":
      return "border-l-primary";
    default:
      return "border-l-muted-foreground";
  }
}

function ActionsPanel({
  actions,
  entityNames,
}: {
  actions: CustomerEventAction[];
  entityNames?: EntityNameMap;
}) {
  // Group actions by detected polymorphic type
  const grouped = useMemo(() => {
    const groups = new Map<string, CustomerEventAction[]>();
    for (const action of actions) {
      const key = detectActionType(action);
      const existing = groups.get(key);
      if (existing) {
        existing.push(action);
      } else {
        groups.set(key, [action]);
      }
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [actions]);

  return (
    <div className="space-y-4">
      {grouped.map(([actionType, groupActions]) => (
        <Collapsible key={actionType}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "border-border bg-card hover:bg-muted/50 focus-visible:ring-ring/50 flex h-auto w-full items-center justify-between rounded-lg border border-l-[5px] px-4 py-2.5 text-left focus-visible:ring-[3px] focus-visible:outline-none",
                getActionTypeBorderColor(actionType)
              )}
            >
              <span className="text-foreground text-sm font-semibold">
                {formatEventTypeLabel(actionType)}{" "}
                <span className="text-muted-foreground font-normal">({groupActions.length})</span>
              </span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180"
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {[...groupActions]
              .sort((a, b) => a.rank - b.rank)
              .map((action, idx) => (
                <ActionCard
                  key={`${action.eventRuleId}-${action.rank}-${idx}`}
                  action={action}
                  entityNames={entityNames}
                />
              ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

// ─── Action Card ────────────────────────────────────────────────────────────

/** Check if a value is a non-null object (for collapsible structured rendering). */
function isObjectValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ─── Structured Data Display ─────────────────────────────────────────────────

/** Render a single primitive value with type-appropriate formatting. */
function StructuredValue({ value }: { value: unknown }) {
  if (value == null) {
    return <span className="text-muted-foreground text-sm">&mdash;</span>;
  }
  if (typeof value === "boolean") {
    return (
      <Badge
        variant="outline"
        role="img"
        aria-label={value ? "true" : "false"}
        className={cn(
          "text-xs",
          value ? "border-success/30 text-success-dark" : "text-muted-foreground"
        )}
      >
        {String(value)}
      </Badge>
    );
  }
  if (typeof value === "number") {
    return <span className="text-foreground text-sm tabular-nums">{value.toLocaleString()}</span>;
  }
  return <span className="text-foreground text-sm break-words">{String(value)}</span>;
}

/**
 * If label is "Action Data" and the object has exactly one key whose value
 * is an object, unwrap the inner object to avoid a redundant nesting level.
 */
function unwrapActionData(label: string, value: Record<string, unknown>): Record<string, unknown> {
  if (label !== "Action Data") return value;
  const keys = Object.keys(value);
  const firstKey = keys[0];
  if (keys.length === 1 && firstKey != null && isObjectValue(value[firstKey])) {
    return value[firstKey] as Record<string, unknown>;
  }
  return value;
}

/** Classify entries into flat (primitives/arrays-of-primitives) vs nested (objects/arrays-of-objects). */
function partitionEntries(data: Record<string, unknown>) {
  const flat: Array<{ key: string; value: unknown }> = [];
  const nested: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    if (isObjectValue(value) || (Array.isArray(value) && value.some(isObjectValue))) {
      nested.push({ key, value });
    } else {
      flat.push({ key, value });
    }
  }
  return { flat, nested };
}

/** Recursively render an object as a compact key-value grid. */
function StructuredDataGrid({
  data,
  nested = false,
  entityNames,
}: {
  data: Record<string, unknown>;
  nested?: boolean;
  entityNames?: EntityNameMap;
}) {
  const { flat, nested: nestedEntries } = partitionEntries(data);

  return (
    <div
      className={cn(
        nested ? "border-border mt-1.5 border-l-2 pl-3" : "bg-muted/50 rounded-md border p-3"
      )}
    >
      {/* Flat fields in a 2-column grid */}
      {flat.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {flat.map(({ key, value }) => (
            <div key={key} className="min-w-0">
              <dt className="text-muted-foreground text-xs font-medium">{camelToTitle(key)}</dt>
              <dd className="mt-0.5">
                {Array.isArray(value) ? (
                  <span className="text-foreground text-sm break-words">
                    {value.map(String).join(", ") || "\u2014"}
                  </span>
                ) : (
                  <ResolvedValue fieldKey={key} value={value} entityNames={entityNames} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Nested objects below the grid */}
      {nestedEntries.length > 0 && (
        <dl className={cn("space-y-2", flat.length > 0 && "mt-3")}>
          {nestedEntries.map(({ key, value }) => {
            if (isObjectValue(value)) {
              return (
                <div key={key}>
                  <dt className="text-muted-foreground text-xs font-medium">{camelToTitle(key)}</dt>
                  <dd>
                    <StructuredDataGrid data={value} nested entityNames={entityNames} />
                  </dd>
                </div>
              );
            }
            // Array of objects
            if (Array.isArray(value)) {
              return (
                <div key={key}>
                  <dt className="text-muted-foreground text-xs font-medium">{camelToTitle(key)}</dt>
                  <dd className="mt-1 space-y-2">
                    {value.map((item, i) =>
                      isObjectValue(item) ? (
                        <div key={i}>
                          <span className="text-muted-foreground text-xs">[{i}]</span>
                          <StructuredDataGrid data={item} nested entityNames={entityNames} />
                        </div>
                      ) : (
                        <div key={i} className="border-border border-l-2 pl-3">
                          <span className="text-muted-foreground text-xs">[{i}]</span>{" "}
                          <StructuredValue value={item} />
                        </div>
                      )
                    )}
                  </dd>
                </div>
              );
            }
            return null;
          })}
        </dl>
      )}
    </div>
  );
}

/** Collapsible block for structured object field values. */
function CollapsibleStructuredField({
  label,
  value,
  entityNames,
}: {
  label: string;
  value: unknown;
  entityNames?: EntityNameMap;
}) {
  const displayData = useMemo(() => {
    if (isObjectValue(value)) return unwrapActionData(label, value);
    return null;
  }, [label, value]);

  return (
    <Collapsible>
      <div>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted/50 focus-visible:ring-ring/50 flex h-auto w-full items-center gap-1.5 rounded px-0 py-1 text-left focus-visible:ring-[3px] focus-visible:outline-none"
          >
            <ChevronDown
              size={14}
              aria-hidden="true"
              className="text-muted-foreground shrink-0 transition-transform [[data-state=open]>&]:rotate-180"
            />
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-1 pl-5">
          {displayData ? (
            <StructuredDataGrid data={displayData} entityNames={entityNames} />
          ) : (
            <StructuredValue value={value} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ActionCard({
  action,
  entityNames,
}: {
  action: CustomerEventAction;
  entityNames?: EntityNameMap;
}) {
  // Split into scalar fields (2-column grid) and object fields (collapsible JSON)
  const { scalarFields, objectFields } = useMemo(() => {
    const scalars: Array<{ key: string; label: string; value: unknown }> = [];
    const objects: Array<{ label: string; value: unknown }> = [];
    const seen = new Set<string>(ACTION_HEADER_KEYS);

    // Add known fields in order
    for (const { key, label } of ACTION_FIELD_ORDER) {
      if (key in action && action[key] != null) {
        const val = action[key];
        if (isObjectValue(val) || Array.isArray(val)) {
          objects.push({ label, value: val });
        } else {
          scalars.push({ key, label, value: val });
        }
        seen.add(key);
      }
    }

    // Add any remaining unknown fields
    for (const [key, value] of Object.entries(action)) {
      if (!seen.has(key) && value != null) {
        if (isObjectValue(value) || Array.isArray(value)) {
          objects.push({ label: camelToTitle(key), value });
        } else {
          scalars.push({ key, label: camelToTitle(key), value });
        }
      }
    }

    return { scalarFields: scalars, objectFields: objects };
  }, [action]);

  const hasContent = scalarFields.length > 0 || objectFields.length > 0;

  return (
    <Card className="overflow-hidden">
      {/* Header: rule name + rank */}
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm font-semibold">{action.eventRuleName}</h3>
          <p className="text-muted-foreground mt-0.5 truncate text-xs" title={action.eventRuleId}>
            Rule: {entityNames?.eventRules.get(action.eventRuleId) ?? action.eventRuleId}
          </p>
        </div>
        {action.rank != null && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Rank {action.rank}
          </Badge>
        )}
      </div>

      {hasContent && (
        <CardContent className="px-4 pt-2 pb-4">
          <Separator className="mb-3" />

          {/* Scalar fields — 2-column grid */}
          {scalarFields.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {scalarFields.map(({ key, label, value }) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
                  <dd className="mt-0.5">
                    <ResolvedValue fieldKey={key} value={value} entityNames={entityNames} />
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* Object fields — collapsible JSON blocks */}
          {objectFields.length > 0 && (
            <div className={scalarFields.length > 0 ? "mt-3 space-y-1" : "space-y-1"}>
              {objectFields.map(({ label, value }) => (
                <CollapsibleStructuredField
                  key={label}
                  label={label}
                  value={value}
                  entityNames={entityNames}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
