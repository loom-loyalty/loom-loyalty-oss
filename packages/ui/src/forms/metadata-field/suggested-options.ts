/**
 * Centralized suggested options for metadata types.
 *
 * These are shown as options in MetadataField even if they don't exist
 * in the platform yet. When selected, they can be created on demand.
 */

import type { SuggestedOption } from "../metadata-select-box";

/**
 * Suggested program types for the wizard.
 * These are shown as options even if they don't exist in the platform yet.
 */
export const SUGGESTED_PROGRAM_TYPES: SuggestedOption[] = [
  {
    code: "standard",
    name: "Standard Points Program",
    description: "Classic earn and redeem points model",
    isSuggested: true,
  },
  {
    code: "tiered",
    name: "Tiered Loyalty Program",
    description: "Multiple tiers with increasing benefits",
    isSuggested: true,
  },
  {
    code: "subscription",
    name: "Subscription Program",
    description: "Recurring subscription with perks",
    isSuggested: true,
  },
  {
    code: "coalition",
    name: "Coalition Program",
    description: "Multi-partner shared currency",
    isSuggested: true,
  },
];

/**
 * Suggested partner types for travel/hospitality/rewards/retail.
 */
export const SUGGESTED_PARTNER_TYPES: SuggestedOption[] = [
  {
    code: "airline",
    name: "Airline",
    description: "Airline and aviation loyalty partner",
    isSuggested: true,
  },
  {
    code: "hotel",
    name: "Hotel & Hospitality",
    description: "Hotel chains and hospitality brands",
    isSuggested: true,
  },
  {
    code: "retail",
    name: "Retail",
    description: "Retail and e-commerce partner",
    isSuggested: true,
  },
  {
    code: "financial",
    name: "Financial Services",
    description: "Banks, credit cards, and financial institutions",
    isSuggested: true,
  },
  {
    code: "travel",
    name: "Travel & Leisure",
    description: "Travel agencies, car rental, and leisure brands",
    isSuggested: true,
  },
];

/**
 * Suggested currency types for the wizard.
 */
export const SUGGESTED_CURRENCY_TYPES: SuggestedOption[] = [
  { code: "points", name: "Points", description: "Standard point currency", isSuggested: true },
  { code: "miles", name: "Miles", description: "Travel-style miles", isSuggested: true },
  { code: "credits", name: "Credits", description: "Store credits", isSuggested: true },
  { code: "tokens", name: "Tokens", description: "Digital tokens", isSuggested: true },
  // Punch-card / coffee-shop style currency. Mirrors
  // `STANDARD_CURRENCY_TYPE_CODES` in @loom-loyalty/program-builder so the
  // executor finds a canonical display name when this option is picked.
  { code: "stamps", name: "Stamps", description: "Punch-card style stamps", isSuggested: true },
];

/**
 * Suggested tier types for loyalty program tiers.
 */
export const SUGGESTED_TIER_TYPES: SuggestedOption[] = [
  {
    code: "standard",
    name: "Standard Tier",
    description: "Classic tier level based on points or activity",
    isSuggested: true,
  },
  {
    code: "subscription",
    name: "Subscription Tier",
    description: "Tier unlocked via recurring subscription",
    isSuggested: true,
  },
  {
    code: "vip",
    name: "VIP Tier",
    description: "Exclusive tier for top-tier members",
    isSuggested: true,
  },
];

/**
 * Suggested badge types for loyalty program badges.
 */
export const SUGGESTED_BADGE_TYPES: SuggestedOption[] = [
  {
    code: "participation",
    name: "Participation",
    description: "Awarded for participating in activities or events",
    isSuggested: true,
    dataModelCode: "BADGE",
  },
  {
    code: "achievement",
    name: "Achievement",
    description: "Earned by completing specific goals or challenges",
    isSuggested: true,
    dataModelCode: "BADGE",
  },
  {
    code: "loyalty",
    name: "Loyalty",
    description: "Recognizes long-term membership and engagement",
    isSuggested: true,
    dataModelCode: "BADGE",
  },
  {
    code: "milestone",
    name: "Milestone",
    description: "Awarded when reaching key milestones",
    isSuggested: true,
    dataModelCode: "BADGE",
  },
  {
    code: "special-event",
    name: "Special Event",
    description: "Limited-edition badge for special promotions or events",
    isSuggested: true,
    dataModelCode: "BADGE",
  },
];

/**
 * Suggested event types for event type configurations.
 */
export const SUGGESTED_EVENT_TYPES: SuggestedOption[] = [
  {
    code: "purchase",
    name: "Purchase",
    description: "Customer purchase or transaction event",
    isSuggested: true,
  },
  {
    code: "engagement",
    name: "Engagement",
    description: "Customer engagement or interaction event",
    isSuggested: true,
  },
  {
    code: "referral",
    name: "Referral",
    description: "Customer referral event",
    isSuggested: true,
  },
  {
    code: "status-change",
    name: "Status Change",
    description: "Customer status or tier change event",
    isSuggested: true,
  },
];

/**
 * Suggested completion target types.
 */
export const SUGGESTED_COMPLETION_TARGET_TYPES: SuggestedOption[] = [
  {
    code: "activity-completion",
    name: "Activity Completion",
    description: "Complete a specific activity or action",
    isSuggested: true,
  },
  {
    code: "profile-completion",
    name: "Profile Completion",
    description: "Complete member profile information",
    isSuggested: true,
  },
  {
    code: "registration",
    name: "Registration",
    description: "Complete registration or enrollment",
    isSuggested: true,
  },
];

/**
 * Suggested counter target types.
 */
export const SUGGESTED_COUNTER_TARGET_TYPES: SuggestedOption[] = [
  {
    code: "spend-target",
    name: "Spend Target",
    description: "Accumulate a spending threshold",
    isSuggested: true,
  },
  {
    code: "visit-target",
    name: "Visit Target",
    description: "Reach a number of visits or check-ins",
    isSuggested: true,
  },
  {
    code: "points-earned-target",
    name: "Points Earned Target",
    description: "Earn a specified number of points",
    isSuggested: true,
  },
  {
    code: "purchase-count",
    name: "Purchase Count",
    description: "Make a number of purchases",
    isSuggested: true,
  },
];

/**
 * Suggested milestone target types.
 */
export const SUGGESTED_MILESTONE_TARGET_TYPES: SuggestedOption[] = [
  {
    code: "onboarding-journey",
    name: "Onboarding Journey",
    description: "Complete a series of onboarding steps",
    isSuggested: true,
  },
  {
    code: "loyalty-tier-path",
    name: "Loyalty Tier Path",
    description: "Progress through a sequence of tier milestones",
    isSuggested: true,
  },
  {
    code: "challenge-path",
    name: "Challenge Path",
    description: "Complete a multi-step challenge or quest",
    isSuggested: true,
  },
];

/**
 * Suggested X of Y target types.
 */
export const SUGGESTED_XOFY_TARGET_TYPES: SuggestedOption[] = [
  {
    code: "product-explorer",
    name: "Product Explorer",
    description: "Try a selection of products from a larger set",
    isSuggested: true,
  },
  {
    code: "activity-sampler",
    name: "Activity Sampler",
    description: "Complete some activities from a curated list",
    isSuggested: true,
  },
  {
    code: "category-shopper",
    name: "Category Shopper",
    description: "Shop across a selection of categories",
    isSuggested: true,
  },
];

/**
 * Suggested customer statuses.
 */
export const SUGGESTED_CUSTOMER_STATUSES: SuggestedOption[] = [
  {
    code: "ACTIVE",
    name: "Active",
    description: "Customer is active and can earn/redeem",
    isSuggested: true,
  },
  {
    code: "INACTIVE",
    name: "Inactive",
    description: "Customer account is inactive",
    isSuggested: true,
  },
  {
    code: "SUSPENDED",
    name: "Suspended",
    description: "Customer account is temporarily suspended",
    isSuggested: true,
  },
];

/**
 * Suggested customer fraud statuses.
 */
export const SUGGESTED_CUSTOMER_FRAUD_STATUSES: SuggestedOption[] = [
  {
    code: "CLEAR",
    name: "Clear",
    description: "No fraud detected",
    isSuggested: true,
  },
  {
    code: "UNDER_REVIEW",
    name: "Under Review",
    description: "Account flagged for fraud review",
    isSuggested: true,
  },
  {
    code: "CONFIRMED_FRAUD",
    name: "Confirmed Fraud",
    description: "Fraud has been confirmed on the account",
    isSuggested: true,
  },
];

/**
 * Suggested customer enrollment channels.
 */
export const SUGGESTED_CUSTOMER_ENROLLMENTS: SuggestedOption[] = [
  {
    code: "ONLINE",
    name: "Online",
    description: "Enrolled via website or app",
    isSuggested: true,
  },
  {
    code: "IN_STORE",
    name: "In Store",
    description: "Enrolled at a physical location",
    isSuggested: true,
  },
  {
    code: "REFERRAL",
    name: "Referral",
    description: "Enrolled through a referral program",
    isSuggested: true,
  },
  {
    code: "IMPORT",
    name: "Import",
    description: "Imported from an external system",
    isSuggested: true,
  },
];

/**
 * Suggested gender codes.
 */
export const SUGGESTED_GENDERS: SuggestedOption[] = [
  {
    code: "MALE",
    name: "Male",
    isSuggested: true,
  },
  {
    code: "FEMALE",
    name: "Female",
    isSuggested: true,
  },
  {
    code: "NON_BINARY",
    name: "Non-Binary",
    isSuggested: true,
  },
  {
    code: "PREFER_NOT_TO_SAY",
    name: "Prefer Not to Say",
    isSuggested: true,
  },
];

/**
 * Suggested coupon types for offers (COUPON-typed).
 */
export const SUGGESTED_COUPON_TYPES: SuggestedOption[] = [
  {
    code: "standard",
    name: "Standard",
    description: "General-purpose coupon for everyday discounts",
    isSuggested: true,
    dataModelCode: "COUPON",
  },
  {
    code: "premium",
    name: "Premium",
    description: "Higher-tier coupon with greater discount value",
    isSuggested: true,
    dataModelCode: "COUPON",
  },
  {
    code: "promotional",
    name: "Promotional",
    description: "Limited-time coupon tied to a campaign or promotion",
    isSuggested: true,
    dataModelCode: "COUPON",
  },
];

/**
 * Suggested coupon code groups — the metadata grouping that holds an offer's
 * pool of redemption codes.
 */
export const SUGGESTED_COUPON_CODE_GROUPS: SuggestedOption[] = [
  {
    code: "default-codes",
    name: "Default Codes",
    description: "Default code group for offers without a dedicated pool",
    isSuggested: true,
    dataModelCode: "COUPON_CODE_GROUP",
  },
];

/**
 * Map of type codes to their suggested options.
 *
 * Add entries here to provide suggested options for new metadata types.
 */
export const SUGGESTED_OPTIONS_MAP: Record<string, SuggestedOption[]> = {
  PROGRAM_TYPE: SUGGESTED_PROGRAM_TYPES,
  PARTNER_TYPE: SUGGESTED_PARTNER_TYPES,
  CURRENCY_TYPE: SUGGESTED_CURRENCY_TYPES,
  TIER_TYPE: SUGGESTED_TIER_TYPES,
  BADGE_TYPE: SUGGESTED_BADGE_TYPES,
  EVENT_TYPE: SUGGESTED_EVENT_TYPES,
  COMPLETION_TARGET_TYPE: SUGGESTED_COMPLETION_TARGET_TYPES,
  COUNTER_TARGET_TYPE: SUGGESTED_COUNTER_TARGET_TYPES,
  MILESTONE_TARGET_TYPE: SUGGESTED_MILESTONE_TARGET_TYPES,
  X_OF_Y_TARGET_TYPE: SUGGESTED_XOFY_TARGET_TYPES,
  CUSTOMER_STATUS: SUGGESTED_CUSTOMER_STATUSES,
  CUSTOMER_FRAUD_STATUS: SUGGESTED_CUSTOMER_FRAUD_STATUSES,
  ENROLLMENT_TYPE: SUGGESTED_CUSTOMER_ENROLLMENTS,
  GENDER: SUGGESTED_GENDERS,
  COUPON_TYPE: SUGGESTED_COUPON_TYPES,
  COUPON_CODE_GROUP: SUGGESTED_COUPON_CODE_GROUPS,
};
