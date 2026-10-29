/**
 * Customer View — Hybrid Dashboard + Timeline
 *
 * Two-column layout: dashboard summary (left) + activity timeline (right).
 * Pure presentational — zero data fetching. All data via CustomerData prop.
 * All 12 customer domains covered across header, quick-status cards,
 * tabbed detail panels, and timeline.
 */

"use client";

import {
  AlertCircle,
  Award,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  CreditCard,
  Hash,
  Info,
  Layers,
  Mail,
  Minus,
  Pencil,
  Play,
  Plus,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Target,
  Ticket,
  Trash2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { formatDate, formatShortDate } from "@loom-loyalty/core";
import type { UIFieldConfig } from "@loom-loyalty/schema";
import { cn } from "../../../lib/utils";
// Primitives
import { Badge } from "../../../primitives/badge";
import { Button } from "../../../primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../primitives/card";
import { Separator } from "../../../primitives/separator";
import { Skeleton } from "../../../primitives/skeleton";
// Data display
import { DataTable } from "../../../data-display/data-table";
import { EmptyState } from "../../../data-display/empty-state";
import { FilterBar } from "../../../data-display/filter-bar";
import { GradientTabs } from "../../../data-display/gradient-tabs";
import { StatCard } from "../../../data-display/stat-card";
import { StatusBadge } from "../../../data-display/status-badge";
import { TierBadge } from "../../../data-display/tier-badge";
// Local
import { AudienceMembershipList } from "./audience-membership-list";
import { ContactAddressList } from "./contact-address-list";
import { ContactEmailList } from "./contact-email-list";
import { ContactPhoneList } from "./contact-phone-list";
import { CustomerHeader, type CustomerHeaderProps } from "./customer-header";
import { CustomerTagList } from "./customer-tag-list";
import { EventDetailSheet } from "./event-detail-sheet";
import { IdentifierList } from "./identifier-list";
import { ledgerColumns } from "./ledger-columns";
import { LedgerHistorySheet } from "./ledger-history-sheet";
import { PreferenceList } from "./preference-list";
import { ProgramReferralRow } from "./program-referral-row";
import { PromotionsPanel } from "./promotions/promotions-panel";
import type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  CurrencyBalance,
  CustomerBadgeEntry,
  CustomerCouponEntry,
  CustomerData,
  CustomerEvent,
  CustomerEventTag,
  CustomerIdentifier,
  CustomerPreference,
  CustomerProgram,
  CustomerTagEntry,
  CustomerTierEntry,
  EntityNameMap,
  LedgerEntry,
} from "./types";
import {
  formatCurrencyValue,
  formatEventTypeLabel,
  getActiveTier,
  getEventActionBadgeLabel,
  getOpenCouponUses,
  hasCouponUseActions,
  indexLedgerByEventId,
} from "./types";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Left column tab IDs */
type LeftTabId = "overview" | "membership" | "status" | "promotions" | "preferences";

const LEFT_TABS: Array<{ id: LeftTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "membership", label: "Membership" },
  { id: "status", label: "Status" },
  { id: "promotions", label: "Promotions" },
  { id: "preferences", label: "Preferences" },
];

/** Stagger animation delay increment in milliseconds. */
const STAGGER_INCREMENT_MS = 80;

/** Visual style for an event/action type on the timeline. */
interface EventTypeStyle {
  /** Fill for the timeline node; the node's icon is white, so this must clear 3:1 against white. */
  dot: string;
  icon: typeof ShoppingCart;
  /** Soft-tint badge in the same hue as `dot`. */
  badge: "success" | "gold" | "secondary" | "error" | "info" | "outline";
}

const EVENT_TYPE_DEFAULTS: EventTypeStyle = {
  dot: "bg-muted-foreground",
  icon: Clock,
  badge: "outline",
};

/** Unified event/action type → visual style map. */
const EVENT_TYPE_STYLES: Record<string, Partial<EventTypeStyle>> = {
  // High-level event types
  PURCHASE: { dot: "bg-success-dark", icon: ShoppingCart, badge: "success" },
  REDEMPTION: { dot: "bg-accent-darker", icon: Star, badge: "gold" },
  BADGE_EARNED: { dot: "bg-primary", icon: Award, badge: "secondary" },
  TIER_UPGRADE: {
    dot: "bg-primary-dark",
    icon: TrendingUp,
    badge: "secondary",
  },
  REFERRAL: { dot: "bg-success-dark", icon: Users, badge: "success" },
  PROFILE_UPDATE: {
    dot: "bg-muted-foreground",
    icon: User,
    badge: "outline",
  },
  ENROLLMENT: { dot: "bg-primary", icon: ChevronUp, badge: "secondary" },
  REWARD_ISSUED: { dot: "bg-accent-darker", icon: Tag, badge: "gold" },
  // Action type keys
  issueProgramCurrency: {
    dot: "bg-success-dark",
    icon: Coins,
    badge: "success",
  },
  withdrawProgramCurrency: {
    dot: "bg-destructive",
    icon: Minus,
    badge: "error",
  },
  addCounterData: { dot: "bg-info", icon: Hash, badge: "info" },
  registerTarget: { dot: "bg-info", icon: Target, badge: "info" },
  completeTargetData: { dot: "bg-info", icon: Target, badge: "info" },
  issueCustomerCoupon: {
    dot: "bg-warning-dark",
    icon: Ticket,
    badge: "gold",
  },
  useCustomerCoupon: {
    dot: "bg-warning-dark",
    icon: Ticket,
    badge: "gold",
  },
  holdCustomerCoupon: {
    dot: "bg-warning-dark",
    icon: Ticket,
    badge: "gold",
  },
  returnCustomerCoupon: {
    dot: "bg-warning-dark",
    icon: Ticket,
    badge: "gold",
  },
  cancelCustomerCoupon: {
    dot: "bg-warning-dark",
    icon: Ticket,
    badge: "gold",
  },
  issueCustomerBadge: {
    dot: "bg-primary",
    icon: Award,
    badge: "secondary",
  },
  issueCustomerTier: {
    dot: "bg-primary",
    icon: TrendingUp,
    badge: "secondary",
  },
};

function getEventTypeStyle(eventType: string): EventTypeStyle {
  return { ...EVENT_TYPE_DEFAULTS, ...EVENT_TYPE_STYLES[eventType] };
}

// ─── Component Interface ────────────────────────────────────────────────────

export interface CustomerDetailProps {
  /** Full customer data across all domains */
  data: CustomerData;
  /** Show skeleton loading states */
  isLoading?: boolean;
  /** Callback when customer edit is requested */
  onEdit?: () => void;
  /** Callback to navigate back to the list */
  onBack?: () => void;
  /** Optional actions for the header dropdown menu */
  actions?: CustomerHeaderProps["actions"];
  /** Additional className for the root element */
  className?: string;
  /** Paginated ledger history data for the full-history sheet */
  ledgerHistory?: {
    entries: LedgerEntry[];
    totalEntries: number;
    page: number;
    pageSize: number;
    selectedCurrencyCode: string | null;
    isLoading: boolean;
  };
  /**
   * True only when `data.ledger` is provably the customer's complete set of
   * entries. Gates whether a failed event→ledger join may be presented as a
   * confirmed absence rather than an unsearched remainder.
   */
  ledgerComplete?: boolean;
  /** Callback for ledger history pagination */
  onLedgerPageChange?: (page: number) => void;
  /** Callback for ledger currency filter change */
  onLedgerCurrencyChange?: (currencyCode: string) => void;
  /** Optional entity name map for resolving UUIDs in event action data */
  entityNames?: EntityNameMap;
  // WP-7: Program enrollment
  onEnrollInProgram?: () => void;
  onUpdateProgram?: (program: CustomerProgram) => void;
  onUnenrollProgram?: (program: CustomerProgram) => void;
  /** Generates a membership's referral code; shows a Generate button when set. */
  onGenerateReferralCode?: (program: CustomerProgram) => Promise<void> | void;
  /** Opens another customer's Customer 360, e.g. the referring customer. */
  onViewCustomer?: (customerId: string) => void;
  // WP-9: Tier/Badge
  onAssignTier?: () => void;
  onUpdateTier?: (tier: CustomerTierEntry) => void;
  onRemoveTier?: (tier: CustomerTierEntry) => void;
  onAssignBadge?: () => void;
  onUpdateBadge?: (badge: CustomerBadgeEntry) => void;
  onRemoveBadge?: (badge: CustomerBadgeEntry) => void;
  // WP-11: Coupons
  onIssueCoupon?: () => void;
  onCancelCoupon?: (coupon: CustomerCouponEntry) => void;
  onRecordCouponUse?: (coupon: CustomerCouponEntry) => void;
  // WP-8: Tags
  onDeleteTag?: (tag: CustomerTagEntry) => void;
  // WP-6: Address editing
  onEditAddress?: (address: ContactAddress) => void;
  // Contact CRUD
  onAddEmail?: () => void;
  onEditEmail?: (email: ContactEmail) => void;
  onDeleteEmail?: (emailId: string) => void;
  onAddPhone?: () => void;
  onEditPhone?: (phone: ContactPhone) => void;
  onDeletePhone?: (phoneId: string) => void;
  onAddAddress?: () => void;
  onDeleteAddress?: (addressId: string) => void;
  // Identifiers CRUD
  onAddIdentifier?: () => void;
  onEditIdentifier?: (identifier: CustomerIdentifier) => void;
  onDeleteIdentifier?: (identifierId: string) => void;
  // Preferences CRUD
  onAddPreference?: () => void;
  onEditPreference?: (preference: CustomerPreference) => void;
  onDeletePreference?: (preferenceId: string) => void;
  // Audience memberships
  onAddToAudience?: () => void;
  onRemoveFromAudience?: (segmentId: string) => void;
  // Event tags (fetched on demand by the app layer)
  onSelectedEventChange?: (eventId: string | null) => void;
  /**
   * Controls offered for the currently-open recorded activity — correcting it,
   * or cancelling it. Receives the open event so the app can decide what to
   * offer for it; return null to offer nothing.
   */
  renderEventActions?: (event: CustomerEvent) => ReactNode;
  selectedEventTags?: CustomerEventTag[];
  eventTagsLoading?: boolean;
  eventTagsError?: boolean;
  /** Whether the selected event's full data payload is being fetched. */
  eventDataLoading?: boolean;
  /** Whether the selected event's full data payload fetch failed. */
  eventDataError?: boolean;
  /** Full payload fetched for the selected event (the timeline list omits it). */
  selectedEventData?: Record<string, unknown>;
  /** Declared data-model fields that match the selected event payload. */
  selectedEventDataFields?: UIFieldConfig[];
  /** True while the activity events query is still in flight (separate from base customer load) */
  eventsLoading?: boolean;
  /** True when the activity events query hard-failed (404s do not count) */
  eventsError?: boolean;
  /**
   * Current 1-indexed activity timeline page. `data.events` holds only this
   * page's items — real, server-backed pagination, not a client-side slice
   * of one large fetch.
   */
  eventsPage?: number;
  /**
   * True when the current page of `data.events` came back full, meaning
   * there MAY be a next page. The events endpoint returns no total count, so
   * this can never promise more exist — only a short page proves there isn't
   * one. Next is disabled when this is false.
   */
  eventsHasNextPage?: boolean;
  /** Requests a different (1-indexed) activity timeline page from the API. */
  onEventsPageChange?: (page: number) => void;
  /** Optional content shown at the top of the Overview tab, e.g. a member summary. */
  overviewSummary?: ReactNode;
}

// ─── Utility: Group events by date ──────────────────────────────────────────

interface DateGroup {
  dateLabel: string;
  events: CustomerEvent[];
}

function groupEventsByDate(events: CustomerEvent[]): DateGroup[] {
  const sorted = [...events].sort(
    (a, b) => new Date(b.eventDateTime).getTime() - new Date(a.eventDateTime).getTime()
  );

  const groups: DateGroup[] = [];
  let currentLabel = "";

  for (const event of sorted) {
    const label = formatDate(event.eventDateTime, "EEEE, MMMM d, yyyy");

    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ dateLabel: label, events: [event] });
    } else {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup) {
        lastGroup.events.push(event);
      }
    }
  }

  return groups;
}

function formatEventTime(dateString: string): string {
  return formatDate(dateString, "h:mm a");
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CustomerDetail({
  data,
  isLoading = false,
  onEdit,
  onBack,
  actions,
  className,
  ledgerHistory,
  ledgerComplete = false,
  onLedgerPageChange,
  onLedgerCurrencyChange,
  entityNames,
  onEnrollInProgram,
  onUpdateProgram,
  onUnenrollProgram,
  onGenerateReferralCode,
  onViewCustomer,
  onAssignTier,
  onUpdateTier,
  onRemoveTier,
  onAssignBadge,
  onUpdateBadge,
  onRemoveBadge,
  onIssueCoupon,
  onCancelCoupon,
  onRecordCouponUse,
  onDeleteTag,
  onEditAddress,
  onAddEmail,
  onEditEmail,
  onDeleteEmail,
  onAddPhone,
  onEditPhone,
  onDeletePhone,
  onAddAddress,
  onDeleteAddress,
  onAddIdentifier,
  onEditIdentifier,
  onDeleteIdentifier,
  onAddPreference,
  onEditPreference,
  onDeletePreference,
  onAddToAudience,
  onRemoveFromAudience,
  onSelectedEventChange,
  renderEventActions,
  overviewSummary,
  selectedEventTags,
  eventTagsLoading,
  eventTagsError,
  eventDataLoading,
  eventDataError,
  selectedEventData,
  selectedEventDataFields,
  eventsLoading = false,
  eventsError = false,
  eventsPage = 1,
  eventsHasNextPage = false,
  onEventsPageChange,
}: CustomerDetailProps) {
  // Left column state
  const [activeTab, setActiveTab] = useState<LeftTabId>("overview");

  // Right column state. Timeline PAGE is a controlled prop now (the app layer
  // owns it, since changing it triggers a real fetch) -- only the client-side
  // filter/selection state below stays local.
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventSheetOpen, setEventSheetOpen] = useState(false);

  // Reset timeline state when customer changes (derived state pattern)
  const [prevCustomerId, setPrevCustomerId] = useState(data.customer.customerId);
  if (data.customer.customerId !== prevCustomerId) {
    setPrevCustomerId(data.customer.customerId);
    setEventTypeFilter(null);
    setSelectedEventId(null);
    setEventSheetOpen(false);
    onSelectedEventChange?.(null);
  }

  // Ledger history sheet state
  const [ledgerSheetOpen, setLedgerSheetOpen] = useState(false);
  // Currency to select when the ledger sheet is opened via handleLedgerEntryClick,
  // so it shows the clicked entry's currency instead of whatever was last selected.
  const [ledgerTargetCurrency, setLedgerTargetCurrency] = useState<string | null>(null);

  // ─── Derived Data ──────────────────────────────────────────────────────

  const activeTier = useMemo(() => getActiveTier(data.tiers), [data.tiers]);

  const activeBadges = useMemo(
    () => data.badges.filter((b) => b.active && !b.cancelled),
    [data.badges]
  );

  const activePrograms = useMemo(
    () => data.programs.filter((p) => p.status === "ACTIVE"),
    [data.programs]
  );

  const tierProgress = useMemo(() => {
    if (!activeTier) return null;
    const sortedTiers = [...data.tiers]
      .filter((t) => !t.cancelled)
      .sort((a, b) => a.tierRank - b.tierRank);
    const currentIndex = sortedTiers.findIndex((t) => t.tierId === activeTier.tierId);
    const nextTier = sortedTiers[currentIndex + 1];
    return {
      current: activeTier,
      next: nextTier,
      percentage: nextTier ? undefined : 100,
    };
  }, [activeTier, data.tiers]);

  // Unique event types for filter pills (exclude empty strings — Radix Select requires non-empty values)
  const eventTypes = useMemo(() => {
    const types = new Set(data.events.map((e) => e.eventType).filter(Boolean));
    return Array.from(types).sort();
  }, [data.events]);

  // Filtered events
  const filteredEvents = useMemo(
    () =>
      eventTypeFilter ? data.events.filter((e) => e.eventType === eventTypeFilter) : data.events,
    [data.events, eventTypeFilter]
  );

  const totalFilteredCount = filteredEvents.length;

  // `data.events` is already just the current (real, server-fetched) page —
  // sort for display, no slicing needed.
  const sortedPageEvents = useMemo(
    () =>
      [...filteredEvents].sort(
        (a, b) => new Date(b.eventDateTime).getTime() - new Date(a.eventDateTime).getTime()
      ),
    [filteredEvents]
  );

  const dateGroups = useMemo(() => groupEventsByDate(sortedPageEvents), [sortedPageEvents]);

  const selectedEvent = useMemo(() => {
    const event = data.events.find((e) => e.eventId === selectedEventId) ?? null;
    if (!event) return null;
    // The timeline endpoint omits tags and eventData. Merge their on-demand
    // results only for the selected event, leaving the cached timeline light.
    if (selectedEventTags || selectedEventData !== undefined) {
      return {
        ...event,
        ...(selectedEventTags ? { tags: selectedEventTags } : {}),
        ...(selectedEventData !== undefined ? { eventData: selectedEventData } : {}),
      };
    }
    return event;
  }, [data.events, selectedEventData, selectedEventId, selectedEventTags]);

  const ledgerByEventId = useMemo(() => indexLedgerByEventId(data.ledger), [data.ledger]);

  const selectedEventLedgerEntry = useMemo(
    () => (selectedEventId ? (ledgerByEventId.get(selectedEventId) ?? null) : null),
    [ledgerByEventId, selectedEventId]
  );

  // Only these events can be opened from a ledger entry — the events query is
  // page-capped, and linking to an unloaded event would open an empty sheet.
  const loadedEventIds = useMemo(() => new Set(data.events.map((e) => e.eventId)), [data.events]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleEventClick = useCallback(
    (event: CustomerEvent) => {
      setSelectedEventId(event.eventId);
      setEventSheetOpen(true);
      onSelectedEventChange?.(event.eventId);
    },
    [onSelectedEventChange]
  );

  const handleEventIdClick = useCallback(
    (eventId: string) => {
      setSelectedEventId(eventId);
      setEventSheetOpen(true);
      // Closing the ledger sheet is what makes the event visible. Without it,
      // following an event link from the ledger (itself reached from an event)
      // would silently swap the content of a sheet stacked underneath.
      setLedgerSheetOpen(false);
      // Keeps the parent's selectedEventId (and anything it drives, e.g. tag
      // fetching) in sync with the event this sheet is actually showing —
      // handleEventClick already does this for the timeline entry point.
      onSelectedEventChange?.(eventId);
    },
    [onSelectedEventChange]
  );

  const handleLedgerEntryClick = useCallback(
    (entryId: string) => {
      // Resolve which currency the clicked entry belongs to so the ledger
      // sheet opens showing it, instead of whatever currency was last
      // selected — the id was previously discarded entirely.
      const entry = data.ledger.find((e) => e.entryId === entryId);
      if (entry) {
        setLedgerTargetCurrency(entry.currencyCode);
        onLedgerCurrencyChange?.(entry.currencyCode);
      }
      setLedgerSheetOpen(true);
      // Mirrors handleEventIdClick: without closing the Event sheet, opening the
      // Ledger sheet from within it can no-op if the Ledger sheet was already
      // open from an earlier navigation, silently leaving the user on the sheet
      // they clicked away from.
      setEventSheetOpen(false);
    },
    [data.ledger, onLedgerCurrencyChange]
  );

  // ─── Loading State ─────────────────────────────────────────────────────

  if (isLoading) {
    return <CustomerDetailSkeleton />;
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Edge-to-edge header */}
      <CustomerHeader data={data} onEdit={onEdit} onBack={onBack} actions={actions} />

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── LEFT COLUMN (~58%): Info Hub ── */}
        <div className="flex min-h-0 flex-1 flex-col lg:w-[58%] lg:flex-none">
          {/* Quick Status Section (fixed height) */}
          <QuickStatusSection
            tierProgress={tierProgress}
            activeBadges={activeBadges}
            activePrograms={activePrograms}
            currencies={data.currencies}
          />

          {/* Tab navigation */}
          <div className="px-4 py-2 lg:px-6">
            <GradientTabs
              tabs={LEFT_TABS.map((t) => ({ id: t.id, label: t.label }))}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as LeftTabId)}
              ariaLabel="Customer detail sections"
            />
          </div>

          {/* Scrollable tab content — all panels rendered to preserve aria-controls */}
          <div
            className="flex-1 overflow-y-auto px-4 pt-2 pb-4 lg:px-6 lg:pb-6"
            role="tabpanel"
            id="tabpanel-overview"
            aria-labelledby="tab-overview"
            hidden={activeTab !== "overview"}
          >
            {overviewSummary && <div className="mb-4">{overviewSummary}</div>}
            <OverviewPanel
              data={data}
              onEditAddress={onEditAddress}
              onViewAllTransactions={() => setLedgerSheetOpen(true)}
              onAddEmail={onAddEmail}
              onEditEmail={onEditEmail}
              onDeleteEmail={onDeleteEmail}
              onAddPhone={onAddPhone}
              onEditPhone={onEditPhone}
              onDeletePhone={onDeletePhone}
              onAddAddress={onAddAddress}
              onDeleteAddress={onDeleteAddress}
              onAddIdentifier={onAddIdentifier}
              onEditIdentifier={onEditIdentifier}
              onDeleteIdentifier={onDeleteIdentifier}
            />
          </div>
          <div
            className="flex-1 overflow-y-auto px-4 pt-2 pb-4 lg:px-6 lg:pb-6"
            role="tabpanel"
            id="tabpanel-membership"
            aria-labelledby="tab-membership"
            hidden={activeTab !== "membership"}
          >
            <MembershipPanel
              data={data}
              onEnrollInProgram={onEnrollInProgram}
              onUpdateProgram={onUpdateProgram}
              onUnenrollProgram={onUnenrollProgram}
              onGenerateReferralCode={onGenerateReferralCode}
              onViewCustomer={onViewCustomer}
              onAssignTier={onAssignTier}
              onUpdateTier={onUpdateTier}
              onRemoveTier={onRemoveTier}
            />
          </div>
          <div
            className="flex-1 overflow-y-auto px-4 pt-2 pb-4 lg:px-6 lg:pb-6"
            role="tabpanel"
            id="tabpanel-status"
            aria-labelledby="tab-status"
            hidden={activeTab !== "status"}
          >
            <StatusPanel
              data={data}
              activeBadges={activeBadges}
              onAssignBadge={onAssignBadge}
              onUpdateBadge={onUpdateBadge}
              onRemoveBadge={onRemoveBadge}
              onIssueCoupon={onIssueCoupon}
              onCancelCoupon={onCancelCoupon}
              onRecordCouponUse={onRecordCouponUse}
              onDeleteTag={onDeleteTag}
              onAddToAudience={onAddToAudience}
              onRemoveFromAudience={onRemoveFromAudience}
            />
          </div>
          <div
            className="flex-1 overflow-y-auto px-4 pt-2 pb-4 lg:px-6 lg:pb-6"
            role="tabpanel"
            id="tabpanel-promotions"
            aria-labelledby="tab-promotions"
            hidden={activeTab !== "promotions"}
          >
            <PromotionsPanel
              promotionRules={data.promotionRules}
              onEventClick={handleEventIdClick}
            />
          </div>
          <div
            className="flex-1 overflow-y-auto px-4 pt-2 pb-4 lg:px-6 lg:pb-6"
            role="tabpanel"
            id="tabpanel-preferences"
            aria-labelledby="tab-preferences"
            hidden={activeTab !== "preferences"}
          >
            <PreferencesPanel
              data={data}
              onAddPreference={onAddPreference}
              onEditPreference={onEditPreference}
              onDeletePreference={onDeletePreference}
            />
          </div>
        </div>

        {/* ── RIGHT COLUMN (~42%): Activity Timeline ── */}
        <aside
          className="flex min-h-0 flex-col border-t lg:w-[42%] lg:border-t-0"
          aria-label="Activity timeline"
        >
          {/* Timeline header + filters */}
          <div className="pt-4 pr-4 pl-0 lg:pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground text-sm font-semibold">Activity Timeline</h2>
              {eventsLoading ? (
                <Skeleton className="h-4 w-32" role="status" aria-label="Loading event count" />
              ) : (
                <span className="text-muted-foreground text-xs">
                  {eventTypeFilter
                    ? `${totalFilteredCount} of ${data.events.length} on this page`
                    : `${data.events.length} ${data.events.length === 1 ? "event" : "events"}`}
                  {` · Page ${eventsPage}`}
                </span>
              )}
            </div>
            {!eventsLoading && eventsHasNextPage && (
              <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                This page is full — there may be more events on the next page.
              </p>
            )}
            <FilterBar
              searchValue=""
              onSearchChange={() => {}}
              searchPlaceholder="Search events..."
              filters={[
                {
                  key: "eventType",
                  placeholder: "Event Type",
                  options: eventTypes.map((t) => ({
                    value: t,
                    label: formatEventTypeLabel(t),
                  })),
                  value: eventTypeFilter,
                  onChange: (val) => {
                    setEventTypeFilter(val);
                    onEventsPageChange?.(1);
                  },
                },
              ]}
              showClear={!!eventTypeFilter}
              onClearAll={() => {
                setEventTypeFilter(null);
                onEventsPageChange?.(1);
              }}
            />
          </div>

          {/* Selected event detail — rendered as a sheet at the end of the component */}

          {/* Scrollable timeline */}
          <div className="flex-1 overflow-y-auto py-4 pr-4 pl-0">
            {eventsLoading && data.events.length === 0 ? (
              <TimelineSkeleton />
            ) : eventsError && data.events.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="Couldn't load activity"
                description="The activity timeline failed to load. See the banner above for details, or try refreshing."
              />
            ) : totalFilteredCount === 0 ? (
              <EmptyState
                icon={Clock}
                title={eventTypeFilter ? "No matching events" : "No activity yet"}
                description={
                  eventTypeFilter
                    ? "Try removing the filter to see all events."
                    : "This customer's timeline will populate as events occur."
                }
              />
            ) : (
              <div role="feed" aria-label="Customer activity feed" className="relative">
                {/* Timeline spine */}
                <div
                  className="bg-border absolute top-0 bottom-0 left-4 w-0.5"
                  aria-hidden="true"
                />

                {dateGroups.map((group, groupIdx) => {
                  // posInSet/setSize describe this feed's own rendered set (the
                  // current real page) -- there's no virtual larger total an AT
                  // user could navigate to, so no page offset is added.
                  let runningIndex = 0;
                  for (let g = 0; g < groupIdx; g++) {
                    runningIndex += dateGroups[g]?.events.length ?? 0;
                  }

                  return (
                    <section key={group.dateLabel} className="relative mb-6">
                      {/* Date separator */}
                      <div className="relative z-[1] mb-3 flex items-center gap-3 pl-10">
                        <time
                          className="text-muted-foreground bg-background pr-2 text-xs font-medium"
                          dateTime={
                            group.events[0]
                              ? new Date(group.events[0].eventDateTime).toISOString()
                              : undefined
                          }
                        >
                          {group.dateLabel}
                        </time>
                        <Separator className="flex-1" />
                      </div>

                      {/* Events in this date group */}
                      {group.events.map((event, eventIdx) => {
                        const posInSet = runningIndex + eventIdx + 1;
                        return (
                          <TimelineEventCard
                            key={event.eventId}
                            event={event}
                            isSelected={selectedEventId === event.eventId}
                            posInSet={posInSet}
                            setSize={totalFilteredCount}
                            onClick={() => handleEventClick(event)}
                          />
                        );
                      })}
                    </section>
                  );
                })}
              </div>
            )}

            {/* Timeline pagination — real, server-backed: Previous/Next fetch an
                actual new page rather than re-slicing one large in-memory batch.
                No total-pages count is shown because the API returns a bare
                array with no total, so there's no honest "of N" to display. */}
            {(eventsPage > 1 || eventsHasNextPage) && (
              <nav
                aria-label="Activity timeline pagination"
                className="border-border mt-4 flex items-center justify-between border-t pt-3"
              >
                <p className="text-muted-foreground text-xs" aria-live="polite">
                  Page {eventsPage}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEventsPageChange?.(Math.max(1, eventsPage - 1))}
                    disabled={eventsPage <= 1}
                    aria-label="Previous page"
                    className="h-8 min-h-11 w-8 min-w-11 p-0"
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEventsPageChange?.(eventsPage + 1)}
                    disabled={!eventsHasNextPage}
                    aria-label="Next page"
                    className="h-8 min-h-11 w-8 min-w-11 p-0"
                  >
                    <ChevronRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            )}
          </div>
        </aside>
      </div>

      {/* CSS animation keyframes — respects prefers-reduced-motion */}
      <style>{`
        .animate-fade-slide-up {
          animation: fadeSlideUp 0.4s ease-out both;
          animation-delay: calc(var(--stagger-index, 0) * ${STAGGER_INCREMENT_MS}ms);
        }
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-slide-up {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Event Detail Sheet */}
      <EventDetailSheet
        event={selectedEvent}
        open={eventSheetOpen}
        onOpenChange={(open) => {
          setEventSheetOpen(open);
          if (!open) {
            setSelectedEventId(null);
            onSelectedEventChange?.(null);
          }
        }}
        entityNames={entityNames}
        tagsLoading={eventTagsLoading}
        tagsError={eventTagsError}
        eventDataLoading={eventDataLoading}
        eventDataError={eventDataError}
        eventDataFields={selectedEventDataFields}
        ledgerEntry={selectedEventLedgerEntry}
        ledgerComplete={ledgerComplete}
        onLedgerEntryClick={handleLedgerEntryClick}
        actions={
          selectedEvent && renderEventActions ? renderEventActions(selectedEvent) : undefined
        }
      />

      {/* Ledger History Sheet */}
      <LedgerHistorySheetWrapper
        open={ledgerSheetOpen}
        onOpenChange={setLedgerSheetOpen}
        currencies={data.currencies}
        ledger={data.ledger}
        ledgerHistory={ledgerHistory}
        onPageChange={onLedgerPageChange}
        onCurrencyChange={onLedgerCurrencyChange}
        onEventClick={handleEventIdClick}
        loadedEventIds={loadedEventIds}
        targetCurrencyCode={ledgerTargetCurrency}
      />
    </div>
  );
}

// ─── Ledger History Sheet Wrapper ────────────────────────────────────────────

const LEDGER_SHEET_PAGE_SIZE = 10;

/**
 * Wraps LedgerHistorySheet with fallback client-side pagination
 * when `ledgerHistory` (server-side) is not provided.
 */
function LedgerHistorySheetWrapper({
  open,
  onOpenChange,
  currencies,
  ledger,
  ledgerHistory,
  onPageChange,
  onCurrencyChange,
  onEventClick,
  loadedEventIds,
  targetCurrencyCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencies: CurrencyBalance[];
  ledger: LedgerEntry[];
  ledgerHistory: CustomerDetailProps["ledgerHistory"];
  onPageChange: CustomerDetailProps["onLedgerPageChange"];
  onCurrencyChange: CustomerDetailProps["onLedgerCurrencyChange"];
  onEventClick: (eventId: string) => void;
  loadedEventIds: ReadonlySet<string>;
  /** Currency to select on open, e.g. from a "View ledger entry" click. Server-side
   * mode is already handled by the caller invoking onCurrencyChange directly. */
  targetCurrencyCode?: string | null;
}) {
  // Client-side fallback state (used when ledgerHistory is not provided).
  // Currency defaults to null — the effective currency is derived below so it
  // auto-selects the highest-balance currency once data loads.
  const [fallbackPage, setFallbackPage] = useState(1);
  const [fallbackCurrency, setFallbackCurrency] = useState<string | null>(null);
  const [prevTargetCurrencyCode, setPrevTargetCurrencyCode] = useState(targetCurrencyCode);

  // Adopt a new navigation target during render (derived-state pattern,
  // matching prevEventId/prevCustomerId elsewhere in this package) rather
  // than calling setState from an effect.
  if (targetCurrencyCode && targetCurrencyCode !== prevTargetCurrencyCode) {
    setPrevTargetCurrencyCode(targetCurrencyCode);
    setFallbackCurrency(targetCurrencyCode);
    setFallbackPage(1);
  }

  if (ledgerHistory && onPageChange && onCurrencyChange) {
    // Server-side mode
    return (
      <LedgerHistorySheet
        open={open}
        onOpenChange={onOpenChange}
        currencies={currencies}
        entries={ledgerHistory.entries}
        totalEntries={ledgerHistory.totalEntries}
        page={ledgerHistory.page}
        pageSize={ledgerHistory.pageSize}
        onPageChange={onPageChange}
        selectedCurrencyCode={ledgerHistory.selectedCurrencyCode}
        onCurrencyChange={onCurrencyChange}
        isLoading={ledgerHistory.isLoading}
        onEventClick={onEventClick}
        loadedEventIds={loadedEventIds}
      />
    );
  }

  // Derive effective currency: user selection → highest-balance default
  const effectiveCurrency =
    fallbackCurrency ??
    (currencies.length > 0
      ? currencies.slice().sort((a, b) => b.available - a.available)[0]!.currencyCode
      : null);

  // Client-side fallback: filter + paginate from data.ledger
  const filtered = effectiveCurrency
    ? ledger.filter((e) => e.currencyCode === effectiveCurrency)
    : ledger;
  const start = (fallbackPage - 1) * LEDGER_SHEET_PAGE_SIZE;
  const paged = filtered.slice(start, start + LEDGER_SHEET_PAGE_SIZE);

  return (
    <LedgerHistorySheet
      open={open}
      onOpenChange={onOpenChange}
      currencies={currencies}
      entries={paged}
      totalEntries={filtered.length}
      page={fallbackPage}
      pageSize={LEDGER_SHEET_PAGE_SIZE}
      onPageChange={setFallbackPage}
      selectedCurrencyCode={effectiveCurrency}
      onCurrencyChange={(code) => {
        setFallbackCurrency(code);
        setFallbackPage(1);
      }}
      onEventClick={onEventClick}
      loadedEventIds={loadedEventIds}
    />
  );
}

// ─── Quick Status Section ───────────────────────────────────────────────────

interface QuickStatusSectionProps {
  tierProgress: {
    current: NonNullable<ReturnType<typeof getActiveTier>>;
    next: ReturnType<typeof getActiveTier>;
    percentage: number | undefined;
  } | null;
  activeBadges: CustomerData["badges"];
  activePrograms: CustomerData["programs"];
  currencies: CustomerData["currencies"];
}

function QuickStatusSection({
  tierProgress,
  activeBadges,
  activePrograms,
  currencies,
}: QuickStatusSectionProps) {
  const tierSubtitle = tierProgress
    ? `Since ${formatDate(tierProgress.current.startDateTime, "MMM yyyy")}${tierProgress.next ? ` · Next: ${tierProgress.next.tierName}` : " · Highest achieved"}`
    : undefined;

  const badgeSubtitle =
    activeBadges.length > 0
      ? activeBadges
          .slice(0, 3)
          .map((b) => b.badgeName)
          .join(", ") + (activeBadges.length > 3 ? ` +${activeBadges.length - 3} more` : "")
      : "No badges earned yet";

  const programSubtitle =
    activePrograms.length > 0
      ? activePrograms
          .slice(0, 2)
          .map((p) => p.programName)
          .join(", ") + (activePrograms.length > 2 ? ` +${activePrograms.length - 2} more` : "")
      : "No active programs";

  return (
    <div className="px-4 pt-4 pb-2 lg:px-6 lg:pt-6 lg:pb-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className="animate-fade-slide-up transition-transform hover:scale-[1.02]"
          style={{ "--stagger-index": 0 } as CSSProperties}
        >
          <StatCard
            icon={Shield}
            title="Tier Status"
            value={tierProgress?.current.tierName ?? "No Tier"}
            subtitle={tierSubtitle}
            variant="primary"
            size="lg"
          />
        </div>

        <div
          className="animate-fade-slide-up transition-transform hover:scale-[1.02]"
          style={{ "--stagger-index": 1 } as CSSProperties}
        >
          <StatCard
            icon={Award}
            title="Badges"
            value={activeBadges.length > 0 ? `${activeBadges.length} Active` : "0"}
            subtitle={badgeSubtitle}
            variant="accent"
            size="lg"
          />
        </div>

        <div
          className="animate-fade-slide-up transition-transform hover:scale-[1.02]"
          style={{ "--stagger-index": 2 } as CSSProperties}
        >
          {currencies.length > 0 ? (
            <CurrencyBalanceCard currency={currencies[0]!} currencyCount={currencies.length} />
          ) : (
            <StatCard
              icon={Users}
              title="Programs"
              value={activePrograms.length > 0 ? `${activePrograms.length} Active` : "0"}
              subtitle={programSubtitle}
              variant="success"
              size="lg"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Panel ─────────────────────────────────────────────────────────

interface OverviewPanelProps {
  data: CustomerData;
  onEditAddress?: (address: ContactAddress) => void;
  onViewAllTransactions: () => void;
  // Contact CRUD
  onAddEmail?: () => void;
  onEditEmail?: (email: ContactEmail) => void;
  onDeleteEmail?: (emailId: string) => void;
  onAddPhone?: () => void;
  onEditPhone?: (phone: ContactPhone) => void;
  onDeletePhone?: (phoneId: string) => void;
  onAddAddress?: () => void;
  onDeleteAddress?: (addressId: string) => void;
  // Identifiers CRUD
  onAddIdentifier?: () => void;
  onEditIdentifier?: (identifier: CustomerIdentifier) => void;
  onDeleteIdentifier?: (identifierId: string) => void;
}

function OverviewPanel({
  data,
  onEditAddress,
  onViewAllTransactions,
  onAddEmail,
  onEditEmail,
  onDeleteEmail,
  onAddPhone,
  onEditPhone,
  onDeletePhone,
  onAddAddress,
  onDeleteAddress,
  onAddIdentifier,
  onEditIdentifier,
  onDeleteIdentifier,
}: OverviewPanelProps) {
  let sectionIndex = 0;

  return (
    <div className="space-y-6">
      {/* Contact Info */}
      <section
        aria-label="Contact information"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="text-primary h-5 w-5" aria-hidden="true" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ContactEmailList
                emails={data.emails}
                onAdd={onAddEmail}
                onEdit={onEditEmail}
                onDelete={onDeleteEmail}
                canEdit={!!onAddEmail}
              />
              <ContactPhoneList
                phones={data.phones}
                onAdd={onAddPhone}
                onEdit={onEditPhone}
                onDelete={onDeletePhone}
                canEdit={!!onAddPhone}
              />
              <ContactAddressList
                addresses={data.addresses}
                onAdd={onAddAddress}
                onEdit={onEditAddress}
                onDelete={onDeleteAddress}
                canEdit={!!onAddAddress}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Transactions */}
      <section
        aria-label="Recent transactions"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="text-primary h-5 w-5" aria-hidden="true" />
                Recent Transactions
              </CardTitle>
              {data.ledger.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={onViewAllTransactions}
                >
                  View All &rarr;
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.ledger.length > 0 ? (
              <DataTable
                columns={ledgerColumns}
                data={data.ledger.slice(0, 5)}
                getRowKey={(entry) => entry.entryId}
                emptyMessage="No transactions found."
              />
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No Transactions"
                description="No ledger entries have been recorded."
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Identifiers */}
      <section
        aria-label="Identifiers"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="text-primary h-5 w-5" aria-hidden="true" />
              Identifiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IdentifierList
              identifiers={data.identifiers}
              onAdd={onAddIdentifier}
              onEdit={onEditIdentifier}
              onDelete={onDeleteIdentifier}
              canEdit={!!onAddIdentifier}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ─── Membership Panel ────────────────────────────────────────────────────────

interface MembershipPanelProps {
  data: CustomerData;
  // WP-7: Program enrollment
  onEnrollInProgram?: () => void;
  onUpdateProgram?: (program: CustomerProgram) => void;
  onUnenrollProgram?: (program: CustomerProgram) => void;
  onGenerateReferralCode?: (program: CustomerProgram) => Promise<void> | void;
  onViewCustomer?: (customerId: string) => void;
  // WP-9: Tier
  onAssignTier?: () => void;
  onUpdateTier?: (tier: CustomerTierEntry) => void;
  onRemoveTier?: (tier: CustomerTierEntry) => void;
}

function MembershipPanel({
  data,
  onEnrollInProgram,
  onUpdateProgram,
  onUnenrollProgram,
  onGenerateReferralCode,
  onViewCustomer,
  onAssignTier,
  onUpdateTier,
  onRemoveTier,
}: MembershipPanelProps) {
  let sectionIndex = 0;

  return (
    <div className="space-y-6">
      {/* Programs */}
      <section
        aria-label="Programs"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="text-primary h-5 w-5" aria-hidden="true" />
              Programs
              {onEnrollInProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={onEnrollInProgram}
                  aria-label="Enroll in program"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Enroll
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.programs.length > 0 ? (
              <div className="space-y-2">
                {data.programs.map((program) => (
                  <div
                    key={program.customerProgramId ?? program.programId}
                    className="border-border rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-lg">
                          <Layers className="text-primary h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {program.programName}
                          </p>
                          <p className="text-muted-foreground font-mono text-xs">
                            {program.programCode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <time
                          dateTime={program.registrationDate}
                          className="text-muted-foreground hidden text-xs sm:block"
                        >
                          {formatShortDate(program.registrationDate)}
                        </time>
                        <StatusBadge status={program.status} />
                        {(onUpdateProgram || onUnenrollProgram) && (
                          <div className="flex gap-1">
                            {onUpdateProgram && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onUpdateProgram(program)}
                                aria-label={`Edit program ${program.programName}`}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            )}
                            {onUnenrollProgram && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-7 w-7"
                                onClick={() => onUnenrollProgram(program)}
                                aria-label={`Unenroll from program ${program.programName}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <ProgramReferralRow
                      program={program}
                      onGenerateReferralCode={onGenerateReferralCode}
                      onViewCustomer={onViewCustomer}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Layers}
                title="No Programs"
                description="This customer is not enrolled in any programs."
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Tier History */}
      <section
        aria-label="Tier history"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="text-primary h-5 w-5" aria-hidden="true" />
              Tier History
              {onAssignTier && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={onAssignTier}
                  aria-label="Assign tier"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Assign
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.tiers.length > 0 ? (
              <div className="space-y-2">
                {[...data.tiers]
                  .sort(
                    (a, b) =>
                      new Date(b.issuedDateTime).getTime() - new Date(a.issuedDateTime).getTime()
                  )
                  .map((tier) => (
                    <div
                      key={tier.tierId}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3",
                        tier.active && !tier.cancelled
                          ? "border-l-primary border-border bg-primary/5 border-l-4"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <TierBadge tier={tier.tierName} />
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            Rank {tier.tierRank}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {tier.lifetimeTier && "Lifetime "}
                            {tier.trialTier && "Trial "}
                            {tier.cancelled && "Cancelled"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-foreground text-sm">
                            <time dateTime={tier.startDateTime}>
                              {formatShortDate(tier.startDateTime)}
                            </time>
                            {tier.endDateTime && (
                              <>
                                {" \u2014 "}
                                <time dateTime={tier.endDateTime}>
                                  {formatShortDate(tier.endDateTime)}
                                </time>
                              </>
                            )}
                          </p>
                          {tier.active && !tier.cancelled && (
                            <Badge variant="success" className="mt-1 text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        {(onUpdateTier || onRemoveTier) && (
                          <div className="flex gap-1">
                            {onUpdateTier && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onUpdateTier(tier)}
                                aria-label={`Edit tier ${tier.tierName}`}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            )}
                            {onRemoveTier && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-7 w-7"
                                onClick={() => onRemoveTier(tier)}
                                aria-label={`Remove tier ${tier.tierName}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No Tier History"
                description="No tier entries found for this customer."
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ─── Status Panel ────────────────────────────────────────────────────────────

interface StatusPanelProps {
  data: CustomerData;
  activeBadges: CustomerData["badges"];
  // WP-9: Badge
  onAssignBadge?: () => void;
  onUpdateBadge?: (badge: CustomerBadgeEntry) => void;
  onRemoveBadge?: (badge: CustomerBadgeEntry) => void;
  // WP-11: Coupons
  onIssueCoupon?: () => void;
  onCancelCoupon?: (coupon: CustomerCouponEntry) => void;
  onRecordCouponUse?: (coupon: CustomerCouponEntry) => void;
  // WP-8: Tags
  onDeleteTag?: (tag: CustomerTagEntry) => void;
  // Audience memberships
  onAddToAudience?: () => void;
  onRemoveFromAudience?: (segmentId: string) => void;
}

function StatusPanel({
  data,
  activeBadges,
  onAssignBadge,
  onUpdateBadge,
  onRemoveBadge,
  onIssueCoupon,
  onCancelCoupon,
  onRecordCouponUse,
  onDeleteTag,
  onAddToAudience,
  onRemoveFromAudience,
}: StatusPanelProps) {
  let sectionIndex = 0;

  return (
    <div className="space-y-6">
      {/* Segments */}
      <section
        aria-label="Segments"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="text-primary h-5 w-5" aria-hidden="true" />
              Segments
              {data.segments.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {data.segments.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AudienceMembershipList
              segments={data.segments}
              onAdd={onAddToAudience}
              onRemove={onRemoveFromAudience}
              canEdit={!!onAddToAudience}
            />
          </CardContent>
        </Card>
      </section>

      {/* Badges */}
      <section
        aria-label="All badges"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="text-primary h-5 w-5" aria-hidden="true" />
              All Badges
              {data.badges.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {activeBadges.length} active / {data.badges.length} total
                </Badge>
              )}
              {onAssignBadge && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={onAssignBadge}
                  aria-label="Award badge"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Award
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.badges.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.badges.map((badge) => (
                  <div
                    key={badge.badgeId}
                    className={cn(
                      "border-border rounded-lg border p-3",
                      badge.active && !badge.cancelled ? "bg-accent/5" : "opacity-60"
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="bg-accent/10 flex h-7 w-7 items-center justify-center rounded-full">
                        <Award className="text-accent-dark h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                      {badge.active && !badge.cancelled ? (
                        <Badge variant="success" className="text-xs">
                          Active
                        </Badge>
                      ) : badge.cancelled ? (
                        <Badge variant="outline" className="text-xs">
                          Cancelled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-foreground text-sm font-medium">{badge.badgeName}</p>
                        <p className="text-muted-foreground text-xs">
                          {badge.badgeType} &middot; Rank {badge.badgeRank}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">{badge.issuedReason}</p>
                      </div>
                      {(onUpdateBadge || onRemoveBadge) && (
                        <div className="flex gap-1">
                          {onUpdateBadge && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onUpdateBadge(badge)}
                              aria-label={`Edit badge ${badge.badgeName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {onRemoveBadge && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-7 w-7"
                              onClick={() => onRemoveBadge(badge)}
                              aria-label={`Remove badge ${badge.badgeName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Award}
                title="No Badges"
                description="This customer has not earned any badges."
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Coupons */}
      <section
        aria-label="Offers"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="text-primary h-5 w-5" aria-hidden="true" />
              Offers
              {data.coupons.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {data.coupons.filter((c) => c.status === "ACTIVE").length} active /{" "}
                  {data.coupons.length} total
                </Badge>
              )}
              {onIssueCoupon && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={onIssueCoupon}
                  aria-label="Issue coupon"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Issue
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.coupons.length > 0 ? (
              <div className="space-y-2">
                {data.coupons.map((coupon) => (
                  <div
                    key={coupon.customerCouponId}
                    className={cn(
                      "border-border flex items-center justify-between rounded-lg border p-3",
                      coupon.status === "ACTIVE" && "bg-warning/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-warning/10 flex h-9 w-9 items-center justify-center rounded-lg">
                        <Ticket className="text-warning h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {coupon.couponName || coupon.couponCode}
                        </p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {coupon.couponCode}
                        </p>
                        {coupon.offerName && (
                          <p className="text-muted-foreground text-xs">{coupon.offerName}</p>
                        )}
                        {(coupon.maxUses ?? 1) > 1 && (
                          <p className="text-muted-foreground text-xs">
                            {getOpenCouponUses(coupon.uses).length} of {coupon.maxUses} uses
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <time
                        dateTime={coupon.issuedDateTime}
                        className="text-muted-foreground hidden text-xs sm:block"
                      >
                        {formatShortDate(coupon.issuedDateTime)}
                      </time>
                      <CouponStatusIndicator status={coupon.status} />
                      {((onRecordCouponUse && hasCouponUseActions(coupon)) ||
                        (onCancelCoupon && isCancellableCoupon(coupon))) && (
                        <div className="flex gap-1">
                          {onRecordCouponUse && hasCouponUseActions(coupon) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onRecordCouponUse(coupon)}
                              aria-label={`Record use for coupon ${coupon.couponCode}`}
                            >
                              <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {onCancelCoupon && isCancellableCoupon(coupon) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-7 w-7"
                              onClick={() => onCancelCoupon(coupon)}
                              aria-label={`Cancel coupon ${coupon.couponCode}`}
                            >
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Ticket}
                title="No Offers"
                description="No offers have been issued to this customer."
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Tags */}
      <section
        aria-label="Tags"
        className="animate-fade-slide-up"
        style={{ "--stagger-index": sectionIndex++ } as CSSProperties}
      >
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="text-primary h-5 w-5" aria-hidden="true" />
              Tags
              {data.tags.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {data.tags.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerTagList tags={data.tags} onDeleteTag={onDeleteTag} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/** Coupons that have not been used up, cancelled, or expired can still be cancelled. */
function isCancellableCoupon(coupon: CustomerCouponEntry): boolean {
  return coupon.status === "ACTIVE" || coupon.status === "HELD";
}

/** Simple status indicator for coupons inline in the status panel. */
function CouponStatusIndicator({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "success" | "warning" | "outline" | "destructive" }
  > = {
    ACTIVE: { label: "Active", variant: "success" },
    HELD: { label: "Held", variant: "warning" },
    USED: { label: "Used", variant: "outline" },
    CANCELLED: { label: "Cancelled", variant: "destructive" },
    EXPIRED: { label: "Expired", variant: "outline" },
  };
  const c = config[status] ?? { label: status, variant: "outline" as const };
  return (
    <Badge variant={c.variant} role="status" aria-label={`Status: ${c.label}`} className="text-xs">
      {c.label}
    </Badge>
  );
}

// ─── Preferences Panel ──────────────────────────────────────────────────────

interface PreferencesPanelProps {
  data: CustomerData;
  onAddPreference?: () => void;
  onEditPreference?: (preference: CustomerPreference) => void;
  onDeletePreference?: (preferenceId: string) => void;
}

function PreferencesPanel({
  data,
  onAddPreference,
  onEditPreference,
  onDeletePreference,
}: PreferencesPanelProps) {
  return (
    <PreferenceList
      preferences={data.preferences}
      onAdd={onAddPreference}
      onEdit={onEditPreference}
      onDelete={onDeletePreference}
      canEdit={!!onAddPreference}
    />
  );
}

// ─── Timeline Event Card ────────────────────────────────────────────────────

interface TimelineEventCardProps {
  event: CustomerEvent;
  isSelected: boolean;
  posInSet: number;
  setSize: number;
  onClick: () => void;
}

function TimelineEventCard({
  event,
  isSelected,
  posInSet,
  setSize,
  onClick,
}: TimelineEventCardProps) {
  const { dot: dotColor, icon: Icon, badge: badgeVariant } = getEventTypeStyle(event.eventType);

  return (
    <article
      role="article"
      aria-posinset={posInSet}
      aria-setsize={setSize}
      aria-current={isSelected ? "true" : undefined}
      aria-label={`${event.title} — ${formatEventTime(event.eventDateTime)}`}
      className="relative mb-3 pl-10"
    >
      {/* Timeline node: carries the event type's colour and icon on the rail */}
      <div
        className={cn(
          "border-background absolute top-3 left-[5px] z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2",
          dotColor
        )}
        aria-hidden="true"
      >
        <Icon className="h-3 w-3 text-white" />
      </div>

      {/* Event card */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "bg-card border-border w-full rounded-lg border p-3 text-left shadow-sm transition-all",
          "focus-visible:ring-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isSelected && "ring-primary shadow-md ring-2"
        )}
        aria-pressed={isSelected}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {(() => {
                const actionLabel = getEventActionBadgeLabel(event);
                return actionLabel ? (
                  <Badge variant={badgeVariant} className="text-xs">
                    <Layers className="mr-1 h-3 w-3" aria-hidden="true" />
                    {actionLabel}
                  </Badge>
                ) : (
                  <Badge variant={badgeVariant} className="text-xs">
                    <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
                    {formatEventTypeLabel(event.eventType)}
                  </Badge>
                );
              })()}
            </div>

            <h3 className="text-foreground text-sm font-medium">{event.title}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">{event.description}</p>

            {/* Metadata chips */}
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(event.metadata)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span
                      key={key}
                      className="bg-muted text-muted-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs"
                    >
                      <span className="font-medium">{key}:</span>
                      <span className="ml-1">{String(value)}</span>
                    </span>
                  ))}
              </div>
            )}
          </div>

          <time
            dateTime={new Date(event.eventDateTime).toISOString()}
            className="text-muted-foreground shrink-0 text-xs"
          >
            {formatEventTime(event.eventDateTime)}
          </time>
        </div>
      </button>
    </article>
  );
}

// ─── Currency Balance Card ───────────────────────────────────────────────────

function CurrencyBalanceCard({
  currency,
  currencyCount = 1,
}: {
  currency: CurrencyBalance;
  currencyCount?: number;
}) {
  const subtitle =
    `Earned ${formatCurrencyValue(currency.earned, currency.decimalPlaces, currency.symbol)} · Pending ${formatCurrencyValue(currency.pending, currency.decimalPlaces, currency.symbol)}` +
    (currencyCount > 1 ? ` · 1 of ${currencyCount} currencies` : "");

  return (
    <StatCard
      icon={CreditCard}
      title={currency.currencyName}
      value={formatCurrencyValue(currency.available, currency.decimalPlaces, currency.symbol)}
      subtitle={subtitle}
      variant="success"
      size="lg"
    />
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading activity timeline">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3 pl-10">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerDetailSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <header className="border-border border-b p-4 lg:p-6">
        <div className="flex items-start gap-6">
          <div className="flex flex-1 items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="hidden gap-3 lg:flex">
            <Skeleton className="h-16 w-28 rounded-lg" />
            <Skeleton className="h-16 w-28 rounded-lg" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left column skeleton */}
        <div className="flex w-[58%] flex-col">
          {/* Quick status — gradient StatCard placeholders */}
          <div className="grid grid-cols-3 gap-4 p-4 lg:p-6">
            <Skeleton className="from-primary/20 to-primary-dark/20 h-32 rounded-lg bg-gradient-to-r" />
            <Skeleton className="from-accent/20 to-accent-dark/20 h-32 rounded-lg bg-gradient-to-r" />
            <Skeleton className="from-success/20 to-success-dark/20 h-32 rounded-lg bg-gradient-to-r" />
          </div>

          {/* Tab bar — pill-style placeholder */}
          <div className="px-4 py-2 lg:px-6">
            <div className="bg-muted inline-flex gap-1 rounded-xl p-1">
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>

          {/* Tab content */}
          <div className="space-y-4 px-4 pt-2 pb-4 lg:px-6 lg:pb-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>

        {/* Right column skeleton */}
        <div className="flex w-[42%] flex-col">
          {/* Timeline header + filter bar */}
          <div className="space-y-3 pt-4 pr-4 pl-0 lg:pt-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-9 w-48 rounded-md" />
          </div>

          {/* Timeline */}
          <div className="py-4 pr-4 pl-0">
            <TimelineSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
