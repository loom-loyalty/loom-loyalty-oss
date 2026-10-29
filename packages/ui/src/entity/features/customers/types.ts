/**
 * Customer View — Type Definitions
 *
 * Shared types for Customer presentational components.
 * These mirror the Loom Loyalty Customer API data shapes.
 *
 * Note: The types below (Customer, CustomerIdentity, etc.) are local types
 * used by the Customer 360 view. The SDK types (from @loom-loyalty/sdk)
 * are used by the list, detail, and form components. Both coexist.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type {
  CreateCustomer as SDKCreateCustomer,
  Customer as SDKCustomer,
  UpdateCustomer as SDKUpdateCustomer,
} from "@loom-loyalty/sdk";
import type { ComponentType, SVGProps } from "react";

import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";
import type { CustomerPromotionRule } from "./promotions/types";

// ─── Core Identity ──────────────────────────────────────────────────────────

export interface Customer {
  customerId: string;
  externalId?: string;
  identity?: CustomerIdentity;
  corporateIdentity?: CorporateIdentity;
  statusCode: string;
  statusName: string;
  fraudStatusCode: string;
  enrollmentChannel: string;
  enrollmentDateTime: string;
  createdAt: string;
  lastActivityDateTime?: string;
}

export interface CustomerIdentity {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate?: string;
  genderCode?: string;
}

export interface CorporateIdentity {
  companyName: string;
  companyCode?: string;
}

// ─── Contact Information ────────────────────────────────────────────────────

export interface ContactEmail {
  id: string;
  emailAddress: string;
  typeCode: string;
  typeName: string;
  primary: boolean;
  status: "ACTIVE" | "INACTIVE";
  verified: boolean;
}

export interface ContactPhone {
  id: string;
  number: string;
  extension?: string;
  typeCode: string;
  typeName: string;
  primary: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface ContactAddress {
  id: string;
  addressLine1: string;
  addressLine2?: string;
  cityLocality: string;
  stateProvinceRegion: string;
  postalCode: string;
  countryCode: string;
  typeCode: string;
  typeName: string;
  primary: boolean;
  status: "ACTIVE" | "INACTIVE";
}

// ─── Loyalty Data ───────────────────────────────────────────────────────────

export interface CustomerProgram {
  /** The enrollment's own id: the path id for editing or removing it. */
  customerProgramId?: string;
  programId: string;
  programCode: string;
  programName: string;
  registrationDate: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  programAccountExternalId?: string;
  /** This membership's referral code, once one has been generated. */
  referralCode?: string;
  /** How many live customers enrolled with this membership's code. */
  referralCount?: number;
  /** The customer whose code this membership was enrolled with. */
  referredByCustomerId?: string;
  /** The membership whose code was used, on the referring customer. */
  referredByCustomerProgramId?: string;
}

export interface CustomerTierEntry {
  tierId: string;
  tierCode: string;
  tierName: string;
  tierRank: number;
  startDateTime: string;
  endDateTime?: string;
  active: boolean;
  lifetimeTier: boolean;
  trialTier: boolean;
  issuedDateTime: string;
  cancelled: boolean;
}

export interface CustomerBadgeEntry {
  badgeId: string;
  badgeCode: string;
  badgeName: string;
  badgeType: string;
  badgeRank: number;
  startDateTime: string;
  endDateTime?: string;
  active: boolean;
  issuedDateTime: string;
  issuedReason: string;
  cancelled: boolean;
}

export interface CurrencyBalance {
  currencyCode: string;
  currencyName: string;
  decimalPlaces: number;
  symbol?: string;
  earned: number;
  pending: number;
  posted: number;
  debited: number;
  available: number;
  expired: number;
  expiringByDate: Array<{ date: string; amount: number }>;
  pendingByDate: Array<{ date: string; amount: number; reason: string }>;
}

export interface LedgerEntry {
  entryId: string;
  currencyCode: string;
  currencyName: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  eventDateTime: string;
  postDateTime?: string;
  pendingDate?: string;
  expiryDate?: string;
  description: string;
  referenceId: string;
  status: "POSTED" | "PENDING" | "EXPIRED";
}

// ─── Coupons ────────────────────────────────────────────────────────────────

export interface CustomerCouponEntry {
  customerCouponId: string;
  couponId: string;
  couponCode: string;
  couponName: string;
  offerCode: string;
  offerName: string;
  status: CustomerCouponStatus;
  /** How many times the coupon can be used (the offer's maxOfferUses; defaults to 1) */
  maxUses?: number;
  issuedDateTime: string;
  startDateTime?: string;
  endDateTime?: string;
  cancelled: boolean;
  cancelledDateTime?: string;
  uses: CustomerCouponUseEntry[];
}

export interface CustomerCouponUseEntry {
  couponUseId: string;
  status: "HOLD" | "USE" | "RETURN";
  eventDateTime: string;
  couponUseValue?: number;
  referenceId?: string;
}

export type CustomerCouponStatus = "ACTIVE" | "HELD" | "USED" | "CANCELLED" | "EXPIRED";

/**
 * Holds and uses still in force. Mirrors the Platform's max-uses check: RETURN rows,
 * and holds or uses whose reference ID has been returned, no longer count.
 */
export function getOpenCouponUses(uses: CustomerCouponUseEntry[]): CustomerCouponUseEntry[] {
  const returnedReferenceIds = new Set(
    uses.filter((u) => u.status === "RETURN" && u.referenceId).map((u) => u.referenceId)
  );
  return uses.filter(
    (u) => u.status !== "RETURN" && !(u.referenceId && returnedReferenceIds.has(u.referenceId))
  );
}

/** Derive a customer coupon's display status from its cancellation, uses, and end date. */
export function deriveCouponStatus(
  coupon: Pick<CustomerCouponEntry, "cancelled" | "endDateTime" | "uses" | "maxUses">,
  now: Date = new Date()
): CustomerCouponStatus {
  if (coupon.cancelled) return "CANCELLED";
  const open = getOpenCouponUses(coupon.uses);
  const hasHold = open.some((u) => u.status === "HOLD");
  if (!hasHold && open.length > 0 && open.length >= (coupon.maxUses ?? 1)) return "USED";
  if (coupon.endDateTime && new Date(coupon.endDateTime) < now) return "EXPIRED";
  if (hasHold) return "HELD";
  return "ACTIVE";
}

export interface CouponUseActions {
  /** A new use can be recorded (a slot is free or a hold can be converted) */
  canUse: boolean;
  /** A new hold can be placed (a slot is free) */
  canHold: boolean;
  /** Open holds that a USE can convert, matched by reference ID */
  convertibleHolds: CustomerCouponUseEntry[];
  /** Open holds and uses that a RETURN can reverse, matched by reference ID */
  returnableUses: CustomerCouponUseEntry[];
}

/**
 * Which coupon use actions the Platform will accept for this coupon. HOLD/USE/RETURN
 * pair up by reference ID, so holds and uses without one can't be converted or returned.
 */
export function getCouponUseActions(coupon: CustomerCouponEntry): CouponUseActions {
  if (coupon.status === "CANCELLED" || coupon.status === "EXPIRED") {
    return { canUse: false, canHold: false, convertibleHolds: [], returnableUses: [] };
  }
  const open = getOpenCouponUses(coupon.uses);
  const hasFreeSlot = open.length < (coupon.maxUses ?? 1);
  const convertibleHolds = open.filter((u) => u.status === "HOLD" && u.referenceId);
  return {
    canUse: hasFreeSlot || convertibleHolds.length > 0,
    canHold: hasFreeSlot,
    convertibleHolds,
    returnableUses: open.filter((u) => u.referenceId),
  };
}

/** True when at least one coupon use action is available. */
export function hasCouponUseActions(coupon: CustomerCouponEntry): boolean {
  const actions = getCouponUseActions(coupon);
  return actions.canUse || actions.canHold || actions.returnableUses.length > 0;
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export interface CustomerTagEntry {
  customerTagId: string;
  metadataTypeCode: string;
  metadataTypeCategory: string;
  metadataCode: string;
  interactionCount: number;
  recencyScore: number;
  firstInteractionDateTime?: string;
  lastInteractionDateTime?: string;
  sourceEventType?: string;
}

// ─── Segments & Events ──────────────────────────────────────────────────────

export interface CustomerSegment {
  segmentId: string;
  segmentCode: string;
  segmentName: string;
  segmentType: "DYNAMIC" | "STATIC";
  memberCount: number;
  addedDateTime: string;
  criteria?: string;
}

export type CustomerEventStatus =
  | "PROCESSED"
  | "QUEUED"
  | "FAILED"
  | "NO_CUSTOMER_ENTITY"
  | "NO_EVENT_RULES"
  | "PROCESSING";

export interface CustomerEventAction {
  rank: number;
  eventRuleId: string;
  eventRuleName: string;
  actionType?: string;
  [key: string]: unknown;
}

/** Source that generated an event tag. */
export type EventTagSource = "DATA_MODEL" | "RULE";

/** A metadata tag extracted from event data. */
export interface CustomerEventTag {
  eventTagId: string;
  metadataTypeCode: string;
  metadataTypeCategory?: string;
  metadataCode?: string;
  value: string;
  inputAttribute?: string;
  jsonPath?: string;
  valid?: boolean;
  source?: EventTagSource;
  eventRuleId?: string;
  eventRuleName?: string;
}

export interface CustomerEvent {
  eventId: string;
  eventType: string;
  eventDateTime: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number>;
  eventRecordId?: string;
  status?: CustomerEventStatus;
  statusDescription?: string;
  parentEventId?: string;
  archivalDateTime?: string;
  eventData?: Record<string, unknown>;
  eventActions?: CustomerEventAction[];
  properties?: Record<string, unknown>;
  tags?: CustomerEventTag[];
}

// ─── Event Type Display ─────────────────────────────────────────────────────

/** Human-readable display names for known event / action type identifiers. */
const EVENT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  issueProgramCurrency: "Issue Currency",
  withdrawProgramCurrency: "Withdraw Currency",
  addCounterData: "Update Counter",
  registerTarget: "Register Target",
  completeTargetData: "Complete Target",
  issueCustomerCoupon: "Issue Coupon",
  useCustomerCoupon: "Use Coupon",
  holdCustomerCoupon: "Hold Coupon",
  returnCustomerCoupon: "Return Coupon",
  cancelCustomerCoupon: "Cancel Coupon",
  issueCustomerBadge: "Issue Badge",
  issueCustomerTier: "Issue Tier",
};

/**
 * Known polymorphic action type keys — derived from the display name map.
 * Used by EventDetailSheet to detect which action type is present on an event action object.
 */
export const KNOWN_ACTION_TYPE_KEYS = Object.keys(EVENT_TYPE_DISPLAY_NAMES);

/** Convert a camelCase or SCREAMING_SNAKE_CASE key to "Title Case" for display. */
export function formatEventTypeLabel(eventType: string): string {
  if (!eventType) return "";
  // Check known display names first
  if (EVENT_TYPE_DISPLAY_NAMES[eventType]) return EVENT_TYPE_DISPLAY_NAMES[eventType];

  // SCREAMING_SNAKE_CASE — lowercase then title-case first char
  if (/^[A-Z][A-Z0-9_]*$/.test(eventType)) {
    return eventType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  // camelCase → Title Case
  return eventType
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ─── Preferences & Identifiers ──────────────────────────────────────────────

export interface CustomerPreference {
  preferenceId: string;
  typeCode: string;
  typeName: string;
  category: string;
  value: string;
  valueName: string;
  status: "ACTIVE" | "INACTIVE";
  updatedDateTime: string;
}

export interface CustomerIdentifier {
  identifierId: string;
  typeCode: string;
  typeName: string;
  value: string;
  status: "ACTIVE" | "INACTIVE";
  createdDateTime: string;
}

// ─── Entity Name Resolution ──────────────────────────────────────────────────

/**
 * Map of entity IDs to display names, used to resolve raw UUIDs
 * in event action data to human-readable names.
 */
export interface EntityNameMap {
  programs: Map<string, string>; // programId → program name
  targets: Map<string, string>; // targetId → target name
  eventRules: Map<string, string>; // eventRuleId → event rule name
}

// ─── Composite Data Shape ───────────────────────────────────────────────────

export interface CustomerData {
  customer: Customer;
  emails: ContactEmail[];
  phones: ContactPhone[];
  addresses: ContactAddress[];
  programs: CustomerProgram[];
  tiers: CustomerTierEntry[];
  badges: CustomerBadgeEntry[];
  currencies: CurrencyBalance[];
  ledger: LedgerEntry[];
  segments: CustomerSegment[];
  events: CustomerEvent[];
  preferences: CustomerPreference[];
  identifiers: CustomerIdentifier[];
  coupons: CustomerCouponEntry[];
  tags: CustomerTagEntry[];
  /** Promotion-category event rules with nested targets. undefined=loading, null=error */
  promotionRules?: CustomerPromotionRule[] | null;
}

// ─── Event Action Utilities ──────────────────────────────────────────────────

/** Detect the polymorphic action type by checking which key is present. */
export function detectActionType(action: CustomerEventAction): string {
  for (const type of KNOWN_ACTION_TYPE_KEYS) {
    if (type in action && action[type] != null) return type;
  }
  return action.actionType ?? "unknown";
}

/**
 * Get the badge label for an event's actions.
 * Returns `"N Actions"` when multiple unique action types exist, `null` otherwise.
 */
export function getEventActionBadgeLabel(event: CustomerEvent): string | null {
  if (!event.eventActions || event.eventActions.length === 0) return null;
  const uniqueTypes = new Set(event.eventActions.map(detectActionType));
  if (uniqueTypes.size > 1) return `${event.eventActions.length} Actions`;
  return null;
}

// ─── Platform ID Generation ─────────────────────────────────────────────────

/**
 * Generate a platform-format event ID: `evt_` + 32 hex chars.
 * Matches the API pattern `^[a-zA-Z][a-zA-Z0-9]{1,3}_[a-fA-F0-9]{32}$`.
 */
export function generateEventId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "")}`;
}

// ─── Utility Functions ──────────────────────────────────────────────────────

export function getCustomerName(c: Customer): string {
  if (c.identity) {
    const parts = [c.identity.firstName, c.identity.middleName, c.identity.lastName].filter(
      Boolean
    );
    return parts.join(" ");
  }
  return c.corporateIdentity?.companyName ?? "Unknown";
}

export function getCustomerInitials(c: Customer): string {
  if (c.identity) {
    const first = c.identity.firstName?.[0] ?? "";
    const last = c.identity.lastName?.[0] ?? "";
    if (!first && !last) return "??";
    return `${first}${last}`.toUpperCase();
  }
  return c.corporateIdentity?.companyName?.slice(0, 2).toUpperCase() ?? "??";
}

export function getPrimaryEmail(emails: ContactEmail[]): ContactEmail | undefined {
  return emails.find((e) => e.primary) ?? emails[0];
}

export function getPrimaryPhone(phones: ContactPhone[]): ContactPhone | undefined {
  return phones.find((p) => p.primary) ?? phones[0];
}

export function getActiveTier(tiers: CustomerTierEntry[]): CustomerTierEntry | undefined {
  return tiers.find((t) => t.active && !t.cancelled);
}

/**
 * Index ledger entries by the event that produced them, for linking an event to
 * its ledger effect.
 *
 * Entries with no originating event ID are skipped, and the first entry wins
 * when two share one — that shouldn't happen, but if it does the link must
 * still resolve to the same entry on every render rather than flickering.
 */
export function indexLedgerByEventId(entries: LedgerEntry[]): Map<string, LedgerEntry> {
  const map = new Map<string, LedgerEntry>();
  for (const entry of entries) {
    if (entry.referenceId && !map.has(entry.referenceId)) map.set(entry.referenceId, entry);
  }
  return map;
}

export function formatCurrencyValue(amount: number, decimals: number, symbol?: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return symbol ? `${symbol}${formatted}` : formatted;
}

// ─── SDK-Based Types for List/Detail/Form Components ────────────────────────

/**
 * Standard fields that are handled by rich customer components.
 * ExtendedFieldsSection uses this to know which fields NOT to render.
 */
export const CUSTOMER_STANDARD_FIELDS = [
  "customerId",
  "externalId",
  "identity",
  "corporateIdentity",
  "statusCode",
  "status",
  "fraudStatusCode",
  "fraudStatus",
  "enrollmentCode",
  "enrollment",
  "enrollmentDateTime",
  "emailAddresses",
  "phoneNumbers",
  "postalAddresses",
  "identifiers",
  "preferences",
  "programs",
  "properties",
  "organizationId",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * Form data shape for customer create/edit forms.
 */
export interface CustomerFormData {
  identityType: "individual" | "corporate";
  firstName?: string;
  middleName?: string;
  lastName?: string;
  birthDate?: string;
  genderCode?: string;
  companyName?: string;
  companyCode?: string;
  email?: string;
  phone?: string;
  statusCode: string;
  fraudStatusCode?: string;
  enrollmentCode?: string;
  externalId?: string;
}

/**
 * Props for the CustomerFormSheet component.
 */
export interface CustomerFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: SDKCustomer;
  onSubmit: (data: SDKCreateCustomer | SDKUpdateCustomer) => Promise<void>;
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  schema?: UIEntitySchema;
  extendedFields?: string[];
}

/**
 * Props for the CustomerPreview component (sheet/quick-glance view).
 */
export interface CustomerPreviewProps {
  customer: SDKCustomer;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onViewFull?: () => void;
  schema?: UIEntitySchema;
  extendedFields?: string[];
}

/**
 * Search filter fields for the customer search bar.
 */
export type MatchMode = "CONTAINS" | "STARTS_WITH" | "EQUALS" | "ENDS_WITH";

export interface CustomerSearchFilters {
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  companyName: string;
  matchMode: MatchMode;
}

export const DEFAULT_CUSTOMER_SEARCH_FILTERS: CustomerSearchFilters = {
  firstName: "",
  lastName: "",
  emailAddress: "",
  phoneNumber: "",
  companyName: "",
  matchMode: "CONTAINS",
};

/** Minimum characters required for a text field to be included in search criteria. */
export const CUSTOMER_SEARCH_MIN_CHARS = 3;

/**
 * Field configuration for the CustomerSearchBar component.
 * Describes one labelled input — its key, label, placeholder, input type,
 * autocomplete hint, and the Lucide icon rendered inside the input.
 */
export interface SearchFieldConfig {
  key: keyof CustomerSearchFilters;
  label: string;
  placeholder: string;
  type: string;
  autoComplete: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Filter state for the customers list.
 * @deprecated Use CustomerSearchFilters instead.
 */
export interface CustomerListFilters {
  search: string;
  status: string | null;
  type: string | null;
}

/**
 * Get display name from SDK Customer's polymorphic identity.
 * Works with the SDK Customer type (not the local Customer type).
 */
export function getSDKCustomerName(customer: SDKCustomer): string {
  const c = customer as Record<string, unknown>;
  const identity = c.identity as
    | { firstName?: string; middleName?: string; lastName?: string }
    | undefined;
  const corpIdentity = c.corporateIdentity as { companyName?: string } | undefined;
  if (identity?.firstName) {
    const parts = [identity.firstName, identity.middleName, identity.lastName].filter(Boolean);
    return parts.join(" ");
  }
  return corpIdentity?.companyName ?? "Unknown";
}

/**
 * Get primary email from SDK Customer's emailAddresses array.
 */
export function getSDKPrimaryEmail(
  emailAddresses?: Array<{ emailAddress?: string; primary?: boolean }>
): { emailAddress?: string; primary?: boolean } | undefined {
  if (!emailAddresses?.length) return undefined;
  return emailAddresses.find((e) => e.primary) ?? emailAddresses[0];
}

/**
 * Get primary phone from SDK Customer's phoneNumbers array.
 */
export function getSDKPrimaryPhone(
  phoneNumbers?: Array<{ number?: string; formattedNumber?: string; primary?: boolean }>
): { number?: string; formattedNumber?: string; primary?: boolean } | undefined {
  if (!phoneNumbers?.length) return undefined;
  return phoneNumbers.find((p) => p.primary) ?? phoneNumbers[0];
}
