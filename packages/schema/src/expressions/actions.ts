/**
 * Expression Action schemas — the side effects a matched expression fires
 * (issue currency, grant a coupon, move a tier, tag metadata, …).
 *
 * Each action serializes as a wrapper object: `{ "<actionName>": { … } }`.
 * (18 actions total.)
 *
 * Two structural notes:
 *  - Every action inherits `path` + `preOperation` + `defaultResult`; numeric
 *    actions add `roundingAlgorithm`, `decimalPlaces`, `isFixedAmount`. The
 *    runtime-only `result` output is not modelled (clients never set it).
 *  - Unknown fields are absorbed as data-model **extension** values that ride at
 *    the TOP LEVEL of the event/customer payload (`$.eventData.myCustomField`),
 *    NOT under a `properties` sub-object. There is therefore no `properties`
 *    field here; the drifted FE `properties` bag was an artifact and is dropped.
 */

import { z } from "zod";

import { preOperationSchema } from "./pre-operations.js";

const jsonPathSchema = z.string().regex(/^\$\./, "JsonPath must start with $.");

// `DateTimePeriod` is a nested object; its internal shape is not authoritatively
// confirmed in-repo. The FE convention is a start/end window; kept permissive.
const dateTimePeriodSchema = z.object({
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
});

/** Rounding algorithm applied to numeric action amounts. */
export const ROUNDING_ALGORITHMS = [
  "ROUND_HALF_UP",
  "ROUND_HALF_DOWN",
  "ROUND_HALF_EVEN",
  "ROUND_UP",
  "ROUND_DOWN",
  "ROUND_CEILING",
  "ROUND_FLOOR",
  "UNNECESSARY",
] as const;
export type RoundingAlgorithm = (typeof ROUNDING_ALGORITHMS)[number];

// Inherited by every action.
const jsonPathBaseFields = {
  path: jsonPathSchema.optional(),
  preOperation: preOperationSchema.optional(),
};

// Numeric-emitting actions (issue/withdraw currency, add counter).
const numericActionFields = {
  ...jsonPathBaseFields,
  defaultResult: z.number(),
  isFixedAmount: z.boolean(),
  roundingAlgorithm: z.enum(ROUNDING_ALGORITHMS).optional(),
  decimalPlaces: z.number().int().optional(),
};

const issueProgramCurrencyActionSchema = z.object({
  issueProgramCurrency: z.object({
    ...numericActionFields,
    cappedResult: z.number().optional(),
    programId: z.string().optional(),
    programCode: z.string().optional(),
    programCurrencyCode: z.string().min(1),
    targetIdsToIncrement: z.array(z.string()).optional(),
    registerTargets: z.boolean().optional(),
    pendingDate: z.string().optional(),
    expiryDate: z.string().optional(),
    synchronous: z.boolean().optional(),
  }),
});

const withdrawProgramCurrencyActionSchema = z.object({
  withdrawProgramCurrency: z.object({
    ...numericActionFields,
    cappedResult: z.number().optional(),
    programId: z.string().optional(),
    programCode: z.string().optional(),
    programCurrencyCode: z.string().min(1),
    // Withdraw keeps increment AND adds decrement; no pending/expiry dates.
    targetIdsToIncrement: z.array(z.string()).optional(),
    targetIdsToDecrement: z.array(z.string()).optional(),
    registerTargets: z.boolean().optional(),
  }),
});

const issueCustomerCouponActionSchema = z.object({
  issueCustomerCoupon: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    couponId: z.string().optional(),
    couponCode: z.string().optional(),
    couponOfferId: z.string().optional(),
    couponOfferCode: z.string().optional(),
    dateTimePeriod: dateTimePeriodSchema.optional(),
    synchronous: z.boolean().optional(),
  }),
});

// use / hold / return share a base: `defaultResult` is a STRING (the coupon
// code) and the coupon can instead be resolved from `path`.
const couponMutationFields = {
  path: jsonPathSchema.optional(),
  defaultResult: z.string().optional(),
  couponUseReferenceIdPath: jsonPathSchema.optional(),
  couponUseReferenceIdValue: z.string().optional(),
  couponUseValuePath: jsonPathSchema.optional(),
  couponUseValueValue: z.string().optional(),
  discountCurrencyTypeCodePath: jsonPathSchema.optional(),
  discountCurrencyTypeCodeValue: z.string().optional(),
  synchronous: z.boolean().optional(),
};

const useCustomerCouponActionSchema = z.object({
  useCustomerCoupon: z.object({ ...couponMutationFields }),
});

const holdCustomerCouponActionSchema = z.object({
  holdCustomerCoupon: z.object({ ...couponMutationFields }),
});

const returnCustomerCouponActionSchema = z.object({
  returnCustomerCoupon: z.object({ ...couponMutationFields }),
});

const cancelCustomerCouponActionSchema = z.object({
  cancelCustomerCoupon: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    couponId: z.string().optional(),
    couponCode: z.string().optional(),
    couponOfferId: z.string().optional(),
    couponOfferCode: z.string().optional(),
    synchronous: z.boolean().optional(),
  }),
});

const issueCustomerBadgeActionSchema = z.object({
  issueCustomerBadge: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    badgeId: z.string().optional(),
    badgeCode: z.string().optional(),
    dateTimePeriod: dateTimePeriodSchema.optional(),
    synchronous: z.boolean().optional(),
  }),
});

const issueCustomerTierActionSchema = z.object({
  issueCustomerTier: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    tierId: z.string().optional(),
    tierCode: z.string().optional(),
    issueLifetimeTier: z.boolean(),
    issueTrialTier: z.boolean(),
    dateTimePeriod: dateTimePeriodSchema.optional(),
    synchronous: z.boolean().optional(),
  }),
});

const registerTargetActionSchema = z.object({
  registerTarget: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    targetId: z.string().optional(),
    targetCode: z.string().optional(),
    programId: z.string().optional(),
    programCode: z.string().optional(),
    eventRuleId: z.string().optional(),
    eventRuleName: z.string().optional(),
  }),
});

const addCounterDataActionSchema = z.object({
  addCounterData: z.object({
    ...numericActionFields,
    targetId: z.string().optional(),
    targetCode: z.string().optional(),
    programId: z.string().optional(),
    registerTarget: z.boolean().optional(),
    metadataTypeCodePath: jsonPathSchema.optional(),
    metadataTypeCodeValue: z.string().optional(),
    metadataCodePath: jsonPathSchema.optional(),
    metadataCodeValue: z.string().optional(),
  }),
});

const completeTargetDataActionSchema = z.object({
  completeTargetData: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    targetId: z.string().optional(),
    targetCode: z.string().optional(),
    programId: z.string().optional(),
    registerTarget: z.boolean().optional(),
    metadataTypeCodePath: jsonPathSchema.optional(),
    metadataTypeCodeValue: z.string().optional(),
    metadataCodePath: jsonPathSchema.optional(),
    metadataCodeValue: z.string().optional(),
  }),
});

// New actions (5).
const addCustomerToAudienceActionSchema = z.object({
  addCustomerToAudience: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    customerAudienceId: z.string().optional(),
    customerAudienceCode: z.string().optional(),
    dateTimePeriod: dateTimePeriodSchema.optional(),
    synchronous: z.boolean().optional(),
  }),
});

const removeCustomerFromAudienceActionSchema = z.object({
  removeCustomerFromAudience: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    customerAudienceId: z.string().optional(),
    customerAudienceCode: z.string().optional(),
    synchronous: z.boolean().optional(),
  }),
});

const metadataTaggingActionSchema = z.object({
  metadataTagging: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    metadataTypeCode: z.string().min(1),
    metadataCode: z.string().min(1),
    weight: z.number().int().optional(),
  }),
});

const sendNotificationActionSchema = z.object({
  sendNotification: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    kind: z.enum(["REMINDER", "NOTIFICATION"]).optional(),
    channelCode: z.string().min(1),
    templateCode: z.string().min(1),
    templateData: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().optional(),
    synchronous: z.boolean().optional(),
  }),
});

const issueCustomerExternalOfferActionSchema = z.object({
  issueCustomerExternalOffer: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    offerId: z.string().optional(),
    offerCode: z.string().optional(),
    dateTimePeriod: dateTimePeriodSchema.optional(),
    synchronous: z.boolean().optional(),
    /**
     * A partner reward's face value, such as "25". The API keeps an action's extra keys as offer
     * properties and returns them flat, so this sits beside offerId rather than under `properties`.
     */
    partnerDenomination: z.union([z.string(), z.number()]).optional(),
  }),
});

const cancelCustomerExternalOfferActionSchema = z.object({
  cancelCustomerExternalOffer: z.object({
    ...jsonPathBaseFields,
    defaultResult: z.boolean().optional(),
    offerId: z.string().optional(),
    offerCode: z.string().optional(),
    customerExternalOfferId: z.string().optional(),
    synchronous: z.boolean().optional(),
  }),
});

/**
 * ExpressionAction — union of the 18 backend action subtypes.
 */
export const expressionActionSchema = z.union([
  issueProgramCurrencyActionSchema,
  withdrawProgramCurrencyActionSchema,
  issueCustomerCouponActionSchema,
  useCustomerCouponActionSchema,
  holdCustomerCouponActionSchema,
  returnCustomerCouponActionSchema,
  cancelCustomerCouponActionSchema,
  issueCustomerBadgeActionSchema,
  issueCustomerTierActionSchema,
  registerTargetActionSchema,
  addCounterDataActionSchema,
  completeTargetDataActionSchema,
  addCustomerToAudienceActionSchema,
  removeCustomerFromAudienceActionSchema,
  metadataTaggingActionSchema,
  sendNotificationActionSchema,
  issueCustomerExternalOfferActionSchema,
  cancelCustomerExternalOfferActionSchema,
]);

export type ExpressionAction = z.infer<typeof expressionActionSchema>;

// Named per-action types (the action editors import these).
export type IssueProgramCurrencyAction = z.infer<typeof issueProgramCurrencyActionSchema>;
export type WithdrawProgramCurrencyAction = z.infer<typeof withdrawProgramCurrencyActionSchema>;
export type IssueCustomerCouponAction = z.infer<typeof issueCustomerCouponActionSchema>;
export type UseCustomerCouponAction = z.infer<typeof useCustomerCouponActionSchema>;
export type HoldCustomerCouponAction = z.infer<typeof holdCustomerCouponActionSchema>;
export type ReturnCustomerCouponAction = z.infer<typeof returnCustomerCouponActionSchema>;
export type CancelCustomerCouponAction = z.infer<typeof cancelCustomerCouponActionSchema>;
export type IssueCustomerBadgeAction = z.infer<typeof issueCustomerBadgeActionSchema>;
export type IssueCustomerTierAction = z.infer<typeof issueCustomerTierActionSchema>;
export type RegisterTargetAction = z.infer<typeof registerTargetActionSchema>;
export type AddCounterDataAction = z.infer<typeof addCounterDataActionSchema>;
export type CompleteTargetDataAction = z.infer<typeof completeTargetDataActionSchema>;
export type AddCustomerToAudienceAction = z.infer<typeof addCustomerToAudienceActionSchema>;
export type RemoveCustomerFromAudienceAction = z.infer<
  typeof removeCustomerFromAudienceActionSchema
>;
export type MetadataTaggingAction = z.infer<typeof metadataTaggingActionSchema>;
export type SendNotificationAction = z.infer<typeof sendNotificationActionSchema>;
export type IssueCustomerExternalOfferAction = z.infer<
  typeof issueCustomerExternalOfferActionSchema
>;
export type CancelCustomerExternalOfferAction = z.infer<
  typeof cancelCustomerExternalOfferActionSchema
>;

/** All 18 action names, for allowlists and prompt grounding. */
export const ACTION_NAMES = [
  "issueProgramCurrency",
  "withdrawProgramCurrency",
  "issueCustomerCoupon",
  "useCustomerCoupon",
  "holdCustomerCoupon",
  "returnCustomerCoupon",
  "cancelCustomerCoupon",
  "issueCustomerBadge",
  "issueCustomerTier",
  "registerTarget",
  "addCounterData",
  "completeTargetData",
  "addCustomerToAudience",
  "removeCustomerFromAudience",
  "metadataTagging",
  "sendNotification",
  "issueCustomerExternalOffer",
  "cancelCustomerExternalOffer",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

/**
 * Coupon mutation actions (use / hold / return). Their `defaultResult` is the
 * coupon code (a string), which distinguishes them from the boolean-
 * `defaultResult` coupon actions.
 */
export const COUPON_MUTATION_ACTION_NAMES = [
  "useCustomerCoupon",
  "holdCustomerCoupon",
  "returnCustomerCoupon",
] as const satisfies readonly ActionName[];

/**
 * Reward action subset — the actions the NL → reward generator emits for the
 * event-rule WHAT step. A curated set that GROWS one reward type at a time (program
 * currency → customer badge → …): small enough to keep the structured-output tool
 * schema tiny, and it structurally prevents the model from emitting an out-of-scope
 * action. Every code it references (programCurrencyCode, badgeCode, …) is grounded
 * against the tenant's real lists by the generator. Remaining reward types
 * (tier/coupon/offer/audience/target) are configured in the visual builder until
 * added here.
 *
 * These are NARROW reward-scoped shapes, NOT slices of the full action schemas above.
 * The full schemas carry id/date/target fields (programId, badgeId, targetIdsTo*,
 * dates) as DEFINED-optional keys, so zod's strip-unknown would keep them — a model
 * that emits them yields schema-valid output that skips code grounding. Declaring only
 * the reward vocabulary means zod drops everything else (ids, dates, targets, rounding,
 * capped, synchronous) on parse AND the structured-output tool definition never offers
 * it. The full `expressionActionSchema` stays permissive for the visual builder's
 * by-id path.
 */
const rewardCurrencyFields = {
  programCurrencyCode: z.string().min(1),
  isFixedAmount: z.boolean(),
  defaultResult: z.number(),
  path: jsonPathSchema.optional(),
  preOperation: preOperationSchema.optional(),
};

const rewardIssueProgramCurrencySchema = z.object({
  issueProgramCurrency: z.object(rewardCurrencyFields),
});

const rewardWithdrawProgramCurrencySchema = z.object({
  withdrawProgramCurrency: z.object(rewardCurrencyFields),
});

const rewardIssueCustomerBadgeSchema = z.object({
  // badgeCode stays OPTIONAL (unlike currency's required code): a code-less/id-only
  // badge still parses, and the generator's grounding rejects it as a no-op with a
  // graceful abstain — better UX than a schema-required 502.
  issueCustomerBadge: z.object({ badgeCode: z.string().optional() }),
});

// Counter-target progress ("count this purchase toward the punch card"). The
// target is named by code, grounded against `targets`; `registerTarget` enrols a
// customer who isn't on the target yet.
const rewardAddCounterDataSchema = z.object({
  addCounterData: z.object({
    targetCode: z.string().min(1),
    isFixedAmount: z.boolean(),
    defaultResult: z.number(),
    path: jsonPathSchema.optional(),
    registerTarget: z.boolean().optional(),
  }),
});

export const rewardActionSchema = z.union([
  rewardIssueProgramCurrencySchema,
  rewardWithdrawProgramCurrencySchema,
  rewardIssueCustomerBadgeSchema,
  rewardAddCounterDataSchema,
]);

export type RewardAction = z.infer<typeof rewardActionSchema>;

export const REWARD_ACTION_NAMES = [
  "issueProgramCurrency",
  "withdrawProgramCurrency",
  "issueCustomerBadge",
  "addCounterData",
] as const satisfies readonly ActionName[];

export type RewardActionName = (typeof REWARD_ACTION_NAMES)[number];

/**
 * Grounding-context keys — the reward code lists a caller supplies to ground reward
 * codes (a `programCurrencyCode` against `currencies`, a `badgeCode` against `badges`).
 * Shared here so producers and consumers of the grounding context can't drift on the
 * key strings. Grows one key at a time with rewardActionSchema.
 */
export const REWARD_CONTEXT_KEYS = ["currencies", "badges", "targets"] as const;
export type RewardContextKey = (typeof REWARD_CONTEXT_KEYS)[number];

/** One grounded reward code plus its display name, as the client sends it. */
export interface GroundedCode {
  code: string;
  name: string;
}

/**
 * The grounding object a caller assembles for reward generation: the reward code lists
 * keyed by REWARD_CONTEXT_KEYS (a key absent → prompt-only grounding for that reward
 * type), plus any extra top-level keys carrying data-model fields, so the shape stays open.
 */
export type RewardGroundingContext = Partial<Record<RewardContextKey, GroundedCode[]>> &
  Record<string, unknown>;

/**
 * Per reward action: the code field it carries and the context list that grounds that
 * code (a currency reward's programCurrencyCode against `currencies`, a badge reward's
 * badgeCode against `badges`). `contextKey` is typed against REWARD_CONTEXT_KEYS (a new
 * reward type must reference a real key), and the map is keyed by RewardActionName so
 * adding a reward action to rewardActionSchema fails to compile until its grounding row
 * is added here — a structural drift guard.
 */
export const REWARD_ACTION_GROUNDING: Record<
  RewardActionName,
  { field: string; contextKey: RewardContextKey }
> = {
  issueProgramCurrency: { field: "programCurrencyCode", contextKey: "currencies" },
  withdrawProgramCurrency: { field: "programCurrencyCode", contextKey: "currencies" },
  issueCustomerBadge: { field: "badgeCode", contextKey: "badges" },
  addCounterData: { field: "targetCode", contextKey: "targets" },
};
