/**
 * Program Spec
 *
 * Data types and Zod schemas for the loyalty program creation flow.
 * Shared between the Hub wizard (`apps/hub/src/features/program-wizard`)
 * and the AI onboarding agent (`apps/ai-server/src/agents/onboarding-agent`).
 *
 * These types originated in `apps/hub/src/features/program-wizard/lib/types.ts`
 * as `ProgramWizardData` + friends. They are the canonical representation of
 * "a loyalty program the user wants to create" — the INPUT to the executor.
 *
 * The executor's OUTPUT lives in `./types.ts` (`ExecutionResults`, `ExecutorResult`).
 * Do not confuse the two: spec = desired state, results = what actually happened.
 *
 * Design notes:
 * - SDK types (CreateProgram, CreateEventRule, etc.) are used directly so every
 *   field maps 1:1 to the API payload. No parallel type definitions.
 * - Zod schemas enforce cross-field invariants (e.g. signupBonus requires currency,
 *   tier thresholds must be ascending, tier/badge codes must be unique).
 * - Max caps on tiers (50) and badges (100) prevent degenerate inputs from
 *   DoS'ing the executor (eng review 2026-04-07, Section 4 finding).
 */

import type {
  CreateCustomer,
  CreateEventRule,
  CreateEventRuleCategory,
  CreateExpiryRule,
  CreateExpiryRuleExpiryPeriod,
  CreateExpiryRuleType,
  CreatePendingRule,
  CreatePendingRulePendingPeriod,
  CreatePendingRuleType,
  CreateProgram,
  CreateProgramCurrency,
} from "@loom-loyalty/sdk";
import { z } from "zod";

// Re-export SDK types so consumers only need one import path
export type {
  CreateCustomer,
  CreateEventRule,
  CreateEventRuleCategory,
  CreateExpiryRule,
  CreateExpiryRuleExpiryPeriod,
  CreateExpiryRuleType,
  CreatePendingRule,
  CreatePendingRulePendingPeriod,
  CreatePendingRuleType,
  CreateProgram,
  CreateProgramCurrency,
};

// ============================================
// Upper bounds (eng review 2026-04-07 — prevents degenerate inputs)
// ============================================

/** Maximum number of tiers in a single program. */
export const MAX_TIERS_PER_PROGRAM = 50;

/** Maximum number of badges in a single program. */
export const MAX_BADGES_PER_PROGRAM = 100;

/** Maximum number of metadata rows declared inline on a program spec. */
export const MAX_METADATA_RECORDS_PER_PROGRAM = 200;

/** Maximum number of promotions declared inline on a program spec. */
export const MAX_PROMOTIONS_PER_PROGRAM = 25;

// ============================================
// Feature Selection Types
// ============================================

/**
 * Program type — determines which earning rule templates apply.
 */
export type ProgramType = "transactional" | "event-based";

/**
 * Transactional rule template options.
 */
export type TransactionalRuleType = "points-per-dollar" | "fixed-per-purchase";

/**
 * Selected features determine which spec fields are required and which
 * stages the executor will run.
 */
export interface SelectedFeatures {
  // Currency & rules
  programCurrency: boolean;
  expiry: boolean; // Sub-feature of programCurrency
  pending: boolean; // Sub-feature of programCurrency
  tiers: boolean; // Tier system
  badges: boolean; // Badge system
  /** Promotions system (event type + target + event rule bundles). Optional for backward-compat with pre-2026-05 templates. */
  promotions?: boolean;

  // Program type (determines earning rule flow)
  programType: ProgramType;

  // Bonus rules
  signupBonus: boolean;
  birthdayBonus: boolean;
}

/**
 * Tier configuration.
 *
 * Named `WizardTier` to match the wizard's existing type for a trivial
 * import swap in M2b. A future rename to `TierSpec` is possible but not
 * required for parity.
 */
export interface WizardTier {
  name: string;
  code: string;
  pointsThreshold: number;
  /** Earn-rate multiplier applied at this tier. Undefined / 1.0 means no bonus rule emitted. */
  earnMultiplier?: number;
  /** Counter target type code for tier progression (e.g., currency code, 'VISITS', 'SPEND') */
  counterTargetTypeCode?: string;
  description?: string;
}

/**
 * Badge configuration.
 */
export interface WizardBadge {
  name: string;
  code: string;
  description?: string;
}

/**
 * Event type definition for event-based programs.
 */
export interface WizardEventType {
  code: string;
  name: string;
  description?: string;
  /** Event data model fields (simplified for the spec layer). Empty when `useExisting` is true. */
  dataFields: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "date";
    required: boolean;
  }>;
  /**
   * True when `code` names an event type that already exists (a pre-seeded
   * system type such as `check-in`, or a custom type another program already
   * created) rather than one this program should create from scratch. The
   * executor skips DataModelType/DataModel/EVENT_TYPE-data-type creation for
   * this event and only registers an EventTypeConfiguration (idempotent —
   * harmless if one already exists) so the event engine can process it.
   */
  useExisting?: boolean;
}

/**
 * Bonus rule configuration (signup or birthday bonus).
 */
export interface BonusConfig {
  bonusPoints: number;
}

/**
 * Promotion target — one slice of an event-rule trigger condition.
 * `kind` selects the platform target type; `config` holds kind-specific
 * fields the executor maps onto the SDK target payload.
 *
 * The four kinds mirror the platform's `EntityTarget` discriminator
 * (see `packages/sdk/src/generated/schemas/entityTarget.ts`):
 *
 *   - COMPLETION: a single-event completion (`completionTargetTypeCode`
 *     required). Used for "did X once" semantics.
 *   - COUNTER: an N-event accumulator (`counterTargetTypeCode` +
 *     `targetValue` required). Used for "visit 5 times" or "spend $100".
 *   - MILESTONE: reach a milestone with ordered tiers
 *     (`milestoneTargetTypeCode` + `items[]` required). Used for level-up
 *     progression.
 *   - X_OF_Y: complete X of Y sub-targets (`xofYTargetTypeCode` +
 *     `itemTargetIds[]` + `targetValue` required). Used for "every Monday
 *     for 4 weeks" patterns.
 *
 * When required `config` fields are missing for a kind, the executor
 * skips Target creation for that promotion and surfaces a warning into
 * the progress log — the event rules still fire on the promotion's
 * event-expression conditions.
 */
export interface WizardPromotionTarget {
  kind: "COMPLETION" | "COUNTER" | "MILESTONE" | "X_OF_Y";
  config: Record<string, unknown>;
}

/**
 * Promotion award — how the event rule pays out when matched.
 */
export interface WizardPromotionEventRule {
  award: {
    type: "FLAT_POINTS" | "MULTIPLIER" | "FREE_ITEM";
    value: number | string;
  };
  conditions?: Record<string, unknown>;
}

/**
 * Self-contained promotion: event type + targets + event rules.
 * Each maps to a `creating-promotions` executor stage iteration.
 */
export interface WizardPromotion {
  code: string;
  name: string;
  description?: string;
  eventType: {
    code: string;
    name: string;
    dataFields?: Array<{
      name: string;
      type: "string" | "number" | "boolean" | "date";
      required: boolean;
    }>;
  };
  targets: WizardPromotionTarget[];
  eventRules: WizardPromotionEventRule[];
  /**
   * Coupon type metadata code referenced when the executor creates the
   * promotion's coupon offer (only required when any eventRule has
   * award.type === "FREE_ITEM"). Populated by the freeform extractor;
   * the executor falls back to "STANDARD" if missing.
   */
  couponTypeCode?: string;
  /**
   * Discount semantics for the promotion's coupon offer (FIXED_AMOUNT,
   * PERCENTAGE, BUY_X_GET_Y, FREE_SHIPPING). Populated by the freeform
   * extractor based on the promotion's intent; the executor falls back
   * to FIXED_AMOUNT if missing.
   */
  couponDiscountType?: string;
}

/**
 * Inline metadata declaration. A row with `code` defines a Metadata instance;
 * a row without `code` defines just the MetadataType. Iterated explicitly by
 * the executor — no implicit auto-creation from program/currency typeCodes.
 */
export interface MetadataRecord {
  category: string;
  typeCode: string;
  code?: string;
  name: string;
  description?: string;
}

/**
 * A complete, executable program specification.
 *
 * This is the single data structure that both the wizard and the AI pass
 * to `runProgramExecutor`. Every field is either required by the executor
 * or gated behind a feature flag in `selectedFeatures`.
 *
 * Note: the wizard's `ProgramWizardData` has a few wizard-UI-only fields
 * (`executionResults?`, deprecated `skipCurrency`/`hasExpiration`/etc.)
 * which are NOT part of the canonical spec. Those stay in the wizard layer
 * and are translated to `ProgramSpec` at the boundary.
 */
export interface ProgramSpec {
  /** Feature flags that determine which spec fields are required and which stages run. */
  selectedFeatures: SelectedFeatures;

  /**
   * Program entity data. `typeName` is round-trip-preserved through the
   * markdown/excel parsers and read by AI prompts for display-name context.
   * Not consumed by the executor — metadata creation runs from `metadata[]`.
   */
  program: Partial<CreateProgram> & { typeName?: string };

  /** Program currency. `currencyTypeName` mirrors `program.typeName`. */
  currency?: Partial<CreateProgramCurrency> & { currencyTypeName?: string };
  /** Code of an existing currency to reuse instead of creating a new one */
  existingCurrencyCode?: string;
  /** ID of an existing currency to reuse */
  existingCurrencyId?: string;

  /** Expiry rule data — present if selectedFeatures.expiry. */
  expiryRule?: Partial<CreateExpiryRule>;

  /** Pending rule data — present if selectedFeatures.pending. */
  pendingRule?: Partial<CreatePendingRule>;

  /** Tiers — at least 2 required if selectedFeatures.tiers. */
  tiers: WizardTier[];
  /** Automatically award the base (rank 1) tier when a customer joins. */
  autoAwardBaseTier?: boolean;

  /** Badges — at least 1 required if selectedFeatures.badges. */
  badges: WizardBadge[];

  /** Promotions — present (possibly empty) when selectedFeatures.promotions. */
  promotions: WizardPromotion[];

  /** Metadata types and instances created up-front by the executor. */
  metadata: MetadataRecord[];

  /** Custom event type definition — required if programType is 'event-based'. */
  eventType?: WizardEventType;

  /** Earning rule template selection + configuration + resulting rule payload. */
  awardRule: {
    templateId: string;
    templateConfig: Record<string, unknown>;
    rulePayload: Partial<CreateEventRule>;
  };

  /** Signup bonus configuration — present if selectedFeatures.signupBonus. */
  signupBonusConfig?: BonusConfig;

  /** Birthday bonus configuration — present if selectedFeatures.birthdayBonus. */
  birthdayBonusConfig?: BonusConfig;

  /**
   * Test customer for dev-env validation. Not created in prod runs.
   * Optional because non-dev callers may not provide one.
   */
  testCustomer?: {
    email: string;
    firstName: string;
    lastName: string;
    externalId?: string;
  };

  /**
   * Explicit opt-out of the dev-env creating-customer + firing-event
   * stages. When unset/false the linter requires `testCustomer`. When
   * `true`, both stages are skipped — even if `testCustomer` is set
   * (precedence: skipTestRun wins, testCustomer is discarded). Prod
   * always skips regardless of this flag.
   */
  skipTestRun?: boolean;
}

// ============================================
// Zod Schemas
// ============================================

/**
 * Program step schema.
 *
 * The refinement on `code` enforces that the letter-only skeleton (used to
 * build event type codes downstream) has enough signal to be unique. Without
 * this, programs like "summer2025" and "summer2024" would both sanitize to
 * "summer.purchase" and collide on the event type configuration.
 */
export const programStepSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .regex(
      /^[A-Za-z][A-Za-z0-9_-]*$/,
      "Code must start with a letter and contain only letters, numbers, hyphens, or underscores"
    )
    .refine(
      (code) => {
        // Must contain at least 3 letters — digits, hyphens, and underscores
        // are stripped when building scoped event type codes. Counts both
        // cases so platform-style codes (`NWA_WORLDPERKS`) and wizard-style
        // codes (`coffee-loyalty`) both pass.
        const letters = code.replace(/[^a-zA-Z]/g, "");
        return letters.length >= 3;
      },
      {
        message:
          "Code must contain at least 3 letters (digits, hyphens, and underscores are stripped when building event type codes)",
      }
    ),
  name: z.string().min(1, "Name is required"),
  typeCode: z.string().min(1, "Program type is required"),
  // Round-trip-preserved display name; not consumed by the executor.
  typeName: z.string().min(1).optional(),
  description: z.record(z.string(), z.string()).optional(),
});

export type ProgramStepData = z.infer<typeof programStepSchema>;

/**
 * Currency step schema — field validation for a new program currency.
 */
export const currencyStepSchema = z.object({
  code: z.string().min(1, "Currency code is required"),
  name: z.string().min(1, "Currency name is required"),
  currencyTypeCode: z.string().min(1, "Currency type is required"),
  // Round-trip-preserved display name; not consumed by the executor.
  currencyTypeName: z.string().min(1).optional(),
});

export type CurrencyStepData = z.infer<typeof currencyStepSchema>;

/**
 * Expiry rule schema with type-dependent field requirements.
 */
export const expiryRuleSchema = z
  .object({
    type: z.enum(["FIXED_DATE", "FIXED_PERIOD", "ROLLING_PERIOD"] as const),
    expiryPeriod: z.enum(["DAYS", "WEEKS", "MONTHS", "YEARS"] as const).optional(),
    expiryPeriodValue: z.number().min(1).optional(),
    expiryDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "FIXED_PERIOD" || data.type === "ROLLING_PERIOD") {
        return data.expiryPeriod && data.expiryPeriodValue;
      }
      if (data.type === "FIXED_DATE") {
        return data.expiryDate;
      }
      return true;
    },
    { message: "Please complete all required fields for the selected expiry type" }
  );

export type ExpiryRuleData = z.infer<typeof expiryRuleSchema>;

/**
 * Pending rule schema with type-dependent field requirements.
 */
export const pendingRuleSchema = z
  .object({
    type: z.enum([
      "FIXED_DATE",
      "FIXED_PERIOD",
      "ROLLING_PERIOD",
      "MANUAL",
      "PENDING_ON_ITEM",
    ] as const),
    pendingPeriod: z.enum(["DAYS", "WEEKS", "MONTHS", "YEARS"] as const).optional(),
    pendingPeriodValue: z.number().min(1).optional(),
    pendingDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "FIXED_PERIOD" || data.type === "ROLLING_PERIOD") {
        return data.pendingPeriod && data.pendingPeriodValue;
      }
      if (data.type === "FIXED_DATE") {
        return data.pendingDate;
      }
      return true;
    },
    { message: "Please complete all required fields for the selected pending type" }
  );

export type PendingRuleData = z.infer<typeof pendingRuleSchema>;

/**
 * Feature selection schema.
 *
 * Refinements enforce cross-feature dependencies that would otherwise fail
 * late at execution time:
 *   - signupBonus and birthdayBonus award program currency, so they require
 *     programCurrency to be enabled.
 *   - expiry and pending are sub-features of programCurrency (not enforced
 *     here because they're independent booleans, but the linter checks it).
 */
export const selectedFeaturesSchema = z
  .object({
    programCurrency: z.boolean(),
    expiry: z.boolean(),
    pending: z.boolean(),
    tiers: z.boolean(),
    badges: z.boolean(),
    promotions: z.boolean().optional(),
    programType: z.enum(["transactional", "event-based"]),
    signupBonus: z.boolean(),
    birthdayBonus: z.boolean(),
  })
  .refine((data) => !data.signupBonus || data.programCurrency, {
    message: "Sign-up bonus requires program currency to be enabled",
    path: ["signupBonus"],
  })
  .refine((data) => !data.birthdayBonus || data.programCurrency, {
    message: "Birthday bonus requires program currency to be enabled",
    path: ["birthdayBonus"],
  });

export type SelectedFeaturesData = z.infer<typeof selectedFeaturesSchema>;

/**
 * Single tier schema.
 */
export const tierSchema = z.object({
  name: z.string().min(1, "Tier name is required"),
  code: z
    .string()
    .min(1, "Tier code is required")
    .regex(
      /^[A-Za-z][A-Za-z0-9_-]*$/,
      "Code must start with a letter and contain only letters, numbers, hyphens, or underscores"
    ),
  pointsThreshold: z.number().min(0, "Points threshold must be 0 or greater"),
  earnMultiplier: z
    .number()
    .min(0, "Earn multiplier must be 0 or greater")
    .max(20, "Earn multiplier cannot exceed 20x")
    .optional(),
  description: z.string().optional(),
});

export type TierData = z.infer<typeof tierSchema>;

/**
 * Tiers collection schema.
 *
 * Requires at least 2 tiers, unique codes, and a MAXIMUM of 50 to prevent
 * degenerate inputs from DoS'ing the executor (eng review 2026-04-07).
 */
export const tiersStepSchema = z.object({
  tiers: z
    .array(tierSchema)
    .min(2, "At least 2 tiers are required")
    .max(MAX_TIERS_PER_PROGRAM, `At most ${MAX_TIERS_PER_PROGRAM} tiers are allowed`)
    .refine(
      (tiers) => {
        const codes = tiers.map((t) => t.code);
        return new Set(codes).size === codes.length;
      },
      { message: "Tier codes must be unique" }
    ),
});

export type TiersStepData = z.infer<typeof tiersStepSchema>;

/**
 * Single badge schema.
 */
export const badgeSchema = z.object({
  name: z.string().min(1, "Badge name is required"),
  code: z
    .string()
    .min(1, "Badge code is required")
    .regex(
      /^[A-Za-z][A-Za-z0-9_-]*$/,
      "Code must start with a letter and contain only letters, numbers, hyphens, or underscores"
    ),
  description: z.string().optional(),
});

export type BadgeData = z.infer<typeof badgeSchema>;

/**
 * Badges collection schema.
 *
 * Requires at least 1 badge, unique codes, and a MAXIMUM of 100 (eng review 2026-04-07).
 */
export const badgesStepSchema = z.object({
  badges: z
    .array(badgeSchema)
    .min(1, "At least 1 badge is required")
    .max(MAX_BADGES_PER_PROGRAM, `At most ${MAX_BADGES_PER_PROGRAM} badges are allowed`)
    .refine(
      (badges) => {
        const codes = badges.map((b) => b.code);
        return new Set(codes).size === codes.length;
      },
      { message: "Badge codes must be unique" }
    ),
});

export type BadgesStepData = z.infer<typeof badgesStepSchema>;

/**
 * Event type data field schema (used inside event type schema below).
 */
export const eventDataFieldSchema = z.object({
  name: z
    .string()
    .min(1, "Field name is required")
    .regex(/^[a-z][a-zA-Z0-9]*$/, "Field name must be camelCase"),
  type: z.enum(["string", "number", "boolean", "date"]),
  required: z.boolean(),
});

/**
 * Custom event type schema. `dataFields` only needs at least one entry when
 * creating a brand-new event type -- `useExisting` (reusing a pre-seeded
 * system type or another program's custom type) has no fields to define.
 */
export const eventTypeSchema = z
  .object({
    name: z.string().min(1, "Event type name is required"),
    code: z
      .string()
      .min(1, "Event type code is required")
      .regex(
        /^[a-z][a-z0-9-]*$/,
        "Code must start with lowercase letter, contain only lowercase letters, numbers, and hyphens"
      ),
    description: z.string().optional(),
    dataFields: z.array(eventDataFieldSchema),
    useExisting: z.boolean().optional(),
  })
  .refine((data) => data.useExisting || data.dataFields.length >= 1, {
    message: "At least one data field is required",
    path: ["dataFields"],
  });

export type EventTypeData = z.infer<typeof eventTypeSchema>;

/**
 * Metadata row schema. Empty `code` means TYPE-only; populated `code`
 * means a Metadata instance under that type.
 */
export const metadataRecordSchema = z.object({
  category: z.string().min(1, "Metadata category is required"),
  typeCode: z.string().min(1, "Metadata typeCode is required"),
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Metadata name is required"),
  description: z.string().optional(),
});

export type MetadataRecordData = z.infer<typeof metadataRecordSchema>;

/**
 * Bonus config schema (used for signup and birthday bonuses).
 */
export const bonusConfigSchema = z.object({
  bonusPoints: z
    .number()
    .min(1, "Bonus points must be at least 1")
    .max(100000, "Bonus points cannot exceed 100,000"),
});

export type BonusConfigData = z.infer<typeof bonusConfigSchema>;

/**
 * Single promotion schema — event type + targets + event rules bundle.
 */
export const promotionSchema = z.object({
  code: z
    .string()
    .min(1, "Promotion code is required")
    .regex(
      /^[A-Za-z][A-Za-z0-9_-]*$/,
      "Code must start with a letter and contain only letters, numbers, hyphens, or underscores"
    ),
  name: z.string().min(1, "Promotion name is required"),
  description: z.string().optional(),
  eventType: z.object({
    code: z.string().min(1, "Event type code is required"),
    name: z.string().min(1, "Event type name is required"),
    dataFields: z.array(eventDataFieldSchema).optional(),
  }),
  targets: z.array(
    z.object({
      kind: z.enum(["COMPLETION", "COUNTER", "MILESTONE", "X_OF_Y"]),
      config: z.record(z.string(), z.unknown()),
    })
  ),
  eventRules: z
    .array(
      z.object({
        award: z.object({
          type: z.enum(["FLAT_POINTS", "MULTIPLIER", "FREE_ITEM"]),
          value: z.union([z.number(), z.string()]),
        }),
        conditions: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1, "Promotion must declare at least one event rule"),
});

export type PromotionData = z.infer<typeof promotionSchema>;

/**
 * Award rule step schema — template selection + the resulting rule payload.
 */
export const awardRuleStepSchema = z.object({
  templateId: z.string().min(1, "Please select a rule template"),
  rulePayload: z
    .object({
      code: z.string().min(1, "Rule code is required"),
      name: z.string().min(1, "Rule name is required"),
    })
    .passthrough(), // Allow additional fields from the template
});

export type AwardRuleStepData = z.infer<typeof awardRuleStepSchema>;

/**
 * Test customer schema.
 */
export const customerStepSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  externalId: z.string().optional(),
});

export type CustomerStepData = z.infer<typeof customerStepSchema>;

// ============================================
// ProgramSpec structural schema (LLM boundary)
// ============================================

/**
 * Structural Zod schema for the whole `ProgramSpec`. Used at the LLM trust
 * boundary in `runProgramExecutor` to reject garbage specs BEFORE the
 * linter's business-rule checks — the linter assumes a well-typed spec
 * shape, so a bad shape (wrong types, arrays where objects are expected,
 * prototype pollution via `__proto__`) can crash the linter or slip past
 * it into the API payload builders.
 *
 * Semantics:
 *   - Every top-level field is validated for type, not business rules.
 *   - Inner objects use `.loose()` so the executor and API-converter
 *     layers still see all the fields they expect, but the OUTER shape
 *     is locked down.
 *   - Business rules (tier-ordering, orphan-badge, required-fields-per-feature)
 *     remain the linter's job. `programSpecSchema` runs BEFORE the linter.
 *   - Runs cheap — pure Zod type checks, no async work.
 *
 * Called from `runProgramExecutor` (executor.ts) to guard the LLM tool path.
 * The wizard path also benefits because it catches wizard-state bugs that
 * would otherwise corrupt the executor's assumptions.
 */
export const programSpecSchema = z
  .object({
    selectedFeatures: z.looseObject({
      programCurrency: z.boolean().optional(),
      expiry: z.boolean().optional(),
      pending: z.boolean().optional(),
      tiers: z.boolean().optional(),
      badges: z.boolean().optional(),
      programType: z.enum(["transactional", "event-based"]).optional(),
      signupBonus: z.boolean().optional(),
      birthdayBonus: z.boolean().optional(),
    }),
    program: z.looseObject({
      code: z.string().optional(),
      name: z.string().optional(),
      typeCode: z.string().optional(),
      typeName: z.string().optional(),
    }),
    currency: z.looseObject({}).optional(),
    existingCurrencyCode: z.string().optional(),
    existingCurrencyId: z.string().optional(),
    expiryRule: z.looseObject({}).optional(),
    pendingRule: z.looseObject({}).optional(),
    tiers: z.array(z.looseObject({})).max(MAX_TIERS_PER_PROGRAM),
    autoAwardBaseTier: z.boolean().optional(),
    badges: z.array(z.looseObject({})).max(MAX_BADGES_PER_PROGRAM),
    promotions: z.preprocess(
      (v) => v ?? [],
      z.array(z.looseObject({})).max(MAX_PROMOTIONS_PER_PROGRAM)
    ),
    // `preprocess` (rather than `.default([])`) so JSON consumers that send
    // `metadata: null` are coerced to `[]` instead of erroring with
    // "Expected array, received null". `.default()` only substitutes for undefined.
    metadata: z.preprocess(
      (v) => v ?? [],
      z.array(metadataRecordSchema).max(MAX_METADATA_RECORDS_PER_PROGRAM)
    ),
    eventType: z.looseObject({}).optional(),
    awardRule: z.object({
      templateId: z.string().min(1, "awardRule.templateId is required"),
      templateConfig: z.record(z.string(), z.unknown()),
      rulePayload: z.looseObject({}),
    }),
    signupBonusConfig: z.looseObject({}).optional(),
    birthdayBonusConfig: z.looseObject({}).optional(),
    testCustomer: z
      .object({
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        externalId: z.string().optional(),
      })
      .optional(),
    skipTestRun: z.boolean().optional(),
  })
  // `.loose()` on the outer object so wizard-only extension fields on
  // `ProgramWizardData` (executionResults, skipCurrency, hasExpiration, etc.)
  // are accepted without being silently stripped by the parse.
  .loose();

export type ProgramSpecParsed = z.infer<typeof programSpecSchema>;
