/**
 * Event Rule Feature Types (Display Only)
 *
 * Display types and constants for event rule components.
 * Wizard types (EventRuleWizardData, INITIAL_WIZARD_DATA, etc.) remain in the Hub app.
 */

import { CheckCircle2, Circle, HelpCircle, Pause, type LucideIcon } from "lucide-react";

/**
 * Event rule categories - determines processing execution order.
 */
export type EventRuleCategory =
  | "BASE"
  | "ORGANIZATION_DEFINED"
  | "PARTNER"
  | "ADJUSTMENT"
  | "TIER"
  | "PROMOTION"
  | "TIER_AFTER_PROMOTION"
  | "REDEMPTION"
  | "COMMUNICATION";

/**
 * Category metadata for display, filtering, and badge rendering.
 */
export interface CategoryInfo {
  label: string;
  shortCode: string;
  order: number;
  description: string;
  icon: LucideIcon;
}

/**
 * Occurrence target configuration.
 */
export interface OccurrenceTarget {
  targetType: string;
  targetId: string;
  registerTarget?: boolean;
}

/**
 * Currency target configuration.
 */
export interface CurrencyTarget {
  targetType: string;
  programId: string;
  programCurrencyCode: string;
  targetId: string;
  registerTarget?: boolean;
}

/**
 * Props for the DetailRow component used in event rule detail views.
 */
export interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

/**
 * Props for the PageHeader component used in event rule list page.
 */
export interface PageHeaderProps {
  title: string;
  canCreate: boolean;
  singularName: string;
}

/**
 * Event-rule version status as inferred client-side (U3 / KTD3). The
 * `EventRule` API schema (`openapi.yaml`, `additionalProperties: false`)
 * carries no status/version field of any kind, so a cold read (page load,
 * or any record the current session hasn't just acted on) can only derive a
 * binary PUBLISHED-vs-not signal — by diffing a row's `eventRuleId` against
 * `GET /event-rules/by-code/{code}/latest-published`. DRAFT and PAUSED both
 * read as "not the latest published version" and are structurally
 * indistinguishable from that signal alone, so a cold, unconfirmed read
 * collapses into "unknown" rather than a false-confident guess.
 *
 * "draft" and "paused" are therefore never derived from a cold read — they
 * are only ever session-scoped hints supplied by the caller immediately
 * after its own createVersion/pause mutation resolves (see
 * `EventRuleDetailProps.recentVersionStatusHint`), where the outcome is
 * certain firsthand rather than inferred. That hint does not survive a
 * reload or apply to a version the current session didn't just act on.
 */
export type EventRuleVersionIndicator = "draft" | "published" | "paused" | "unknown";

export interface EventRuleVersionIndicatorInfo {
  label: string;
  icon: LucideIcon;
  classes: string;
}

export const EVENT_RULE_VERSION_INDICATOR_INFO: Record<
  EventRuleVersionIndicator,
  EventRuleVersionIndicatorInfo
> = {
  draft: {
    label: "Draft",
    icon: Circle,
    classes: "bg-muted text-muted-foreground border-border",
  },
  published: {
    label: "Published",
    icon: CheckCircle2,
    classes: "bg-success/10 text-success-dark border-success/20",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    classes: "bg-warning/10 text-warning border-warning/20",
  },
  unknown: {
    label: "Status unknown",
    icon: HelpCircle,
    classes: "bg-muted text-muted-foreground border-border",
  },
};

/**
 * Category information map with label, shortCode, order, description, and icon reference.
 */
import {
  Building2,
  Gift,
  Handshake,
  Layers,
  MessageSquare,
  Settings,
  ShoppingCart,
  TrendingUp,
  Trophy,
} from "lucide-react";

export const CATEGORY_INFO: Record<EventRuleCategory, CategoryInfo> = {
  BASE: {
    label: "Base",
    shortCode: "BA",
    order: 1,
    description: "Foundational rules applied first",
    icon: Layers,
  },
  ORGANIZATION_DEFINED: {
    label: "Organization Defined",
    shortCode: "CD",
    order: 2,
    description: "Client-specific custom rules",
    icon: Building2,
  },
  PARTNER: {
    label: "Partner",
    shortCode: "PA",
    order: 3,
    description: "Partner program rules",
    icon: Handshake,
  },
  ADJUSTMENT: {
    label: "Adjustment",
    shortCode: "AD",
    order: 4,
    description: "Manual adjustment rules",
    icon: Settings,
  },
  TIER: {
    label: "Tier",
    shortCode: "TR",
    order: 5,
    description: "Tier calculation rules",
    icon: Trophy,
  },
  PROMOTION: {
    label: "Promotion",
    shortCode: "PR",
    order: 6,
    description: "Promotional offer rules",
    icon: Gift,
  },
  TIER_AFTER_PROMOTION: {
    label: "Tier After Promotion",
    shortCode: "TAP",
    order: 7,
    description: "Post-promotion tier recalculation",
    icon: TrendingUp,
  },
  REDEMPTION: {
    label: "Redemption",
    shortCode: "R",
    order: 8,
    description: "Redemption processing rules",
    icon: ShoppingCart,
  },
  COMMUNICATION: {
    label: "Communication",
    shortCode: "CO",
    order: 9,
    description: "Customer communication and notification rules",
    icon: MessageSquare,
  },
};

/**
 * Category options for Select dropdowns.
 */
export const CATEGORY_OPTIONS = Object.entries(CATEGORY_INFO)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([value, info]) => ({
    value,
    label: `${info.label} (Order ${info.order})`,
  }));

/**
 * Human-readable labels for categories.
 */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_INFO).map(([key, info]) => [key, info.label])
);

/**
 * Standard fields for the event-rule entity in the rich component registry.
 */
export const EVENT_RULE_STANDARD_FIELDS = [
  "name",
  "code",
  "category",
  "description",
  "eventRuleId",
  "eventType",
  "eventTypeCode",
  "programIds",
  "promotionTarget",
  "promotionTargetId",
  "occurrenceTargets",
  "currencyTargets",
  "eventExpression",
  "eventActionsExpression",
  "processItemsIndividually",
  "rollUpEventRuleResults",
  "properties",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;
