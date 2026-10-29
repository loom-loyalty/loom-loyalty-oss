/**
 * Award Rule Templates
 *
 * Extensible template system for common award rule patterns. Originated
 * in `apps/hub/src/features/program-wizard/lib/templates.ts` and moved
 * here so both the wizard and the AI onboarding agent share the same
 * template definitions and drift cannot occur.
 *
 * DESIGN CHANGE VS WIZARD COPY:
 * -----------------------------
 * The wizard's original templates.ts had an `icon: LucideIcon` field
 * that pulled `lucide-react` into the module. Icons are a UI concern
 * and this package must stay React-free, so this version uses an
 * `iconName: string` field instead. The wizard's UI code (template
 * picker) maps these strings to lucide components via its own
 * icon registry.
 *
 * EXTENSION MODEL:
 * ----------------
 * Current: Templates are static in this file
 * Future:  Templates fetched from GET /api/templates?type=award-rule
 *
 * The template interface is designed for this transition:
 * - `id` is a string (not enum) for easy backend extension
 * - `configSchema` is Zod for client-side validation
 * - `buildEventRule` generates SDK-compatible payloads
 * - `source` field distinguishes static vs dynamic templates
 */

import type { CreateEventRule, CreateEventRuleCategory } from "@loom-loyalty/sdk";
import { z } from "zod";

import { sanitizeProgramCodeForEventType } from "./execution-helpers";

/**
 * Award rule template definition.
 */
export interface AwardRuleTemplate {
  /** Unique template identifier (string for extensibility) */
  id: string;

  /** Display name */
  name: string;

  /** Short description */
  description: string;

  /** Example text showing what the rule does */
  example: string;

  /**
   * Icon identifier string. The wizard's UI maps this to a lucide-react
   * component via a local icon registry. Kept as a string here so this
   * package stays React-free.
   */
  iconName: "ShoppingCart" | "Gift" | "UserPlus" | "Calendar" | "Star" | "Repeat" | "Sparkles";

  /** Category for grouping (earn, bonus, status, redemption) */
  category: "earn" | "bonus" | "status" | "redemption";

  /** Event type this rule responds to */
  eventTypeCode: string;

  /** Zod schema for template-specific configuration */
  configSchema: z.ZodObject<z.ZodRawShape>;

  /** Default configuration values */
  defaultConfig: Record<string, unknown>;

  /**
   * Build SDK-compatible event rule payload from configuration.
   * The `code` and `name` fields are added by the executor from user input.
   */
  buildEventRule: (
    config: Record<string, unknown>,
    context: {
      programId: string;
      currencyId?: string;
      currencyCode?: string;
      programCode?: string;
      /** Event type code for custom-event templates (from wizard event type step) */
      eventTypeCode?: string;
      tierTargetIds?: string[];
    }
  ) => Omit<CreateEventRule, "code" | "name">;

  /** Template source: 'static' (this file) or 'api' (fetched) */
  source?: "static" | "api";
}

// ============================================
// Configuration Schemas
// ============================================

/**
 * Configuration schema for points-per-dollar template.
 *
 * Note: `minimumPurchase` was removed from this schema because the
 * rewritten buildEventRule uses `eventExpression: { true: {} }`
 * unconditionally. Keeping the config field without wiring it into
 * the expression silently lied to users — they would set a
 * $10 minimum and the rule would still fire for a $1 purchase.
 * If a minimum-purchase gate is needed in the future, it must be
 * added to BOTH the eventExpression AND this schema together.
 */
const pointsPerDollarConfigSchema = z.object({
  pointsPerDollar: z
    .number()
    .min(1, "Must award at least 1 point")
    .max(1000, "Maximum 1000 points per dollar")
    .default(10),
});

/**
 * Configuration schema for fixed points template
 */
const fixedPointsConfigSchema = z.object({
  pointsPerPurchase: z
    .number()
    .min(1, "Must award at least 1 point")
    .max(10000, "Maximum 10,000 points per purchase")
    .default(50),
});

/**
 * Configuration schema for signup bonus template
 */
const signupBonusConfigSchema = z.object({
  bonusPoints: z
    .number()
    .min(1, "Must award at least 1 point")
    .max(100000, "Maximum 100,000 bonus points")
    .default(100),
});

/**
 * Configuration schema for birthday bonus template
 */
const birthdayBonusConfigSchema = z.object({
  bonusPoints: z
    .number()
    .min(1, "Must award at least 1 point")
    .max(10000, "Maximum 10,000 birthday points")
    .default(200),
});

/**
 * Configuration schema for referral bonus template
 */
const referralBonusConfigSchema = z.object({
  referrerPoints: z
    .number()
    .min(1, "Must award at least 1 point")
    .max(10000, "Maximum 10,000 referral points")
    .default(500),
});

/**
 * Configuration schema for custom event template (event-based programs).
 */
const customEventConfigSchema = z.object({
  pointsPerEvent: z
    .number()
    .min(1, "Must award at least 1 point")
    .max(100000, "Maximum 100,000 points per event")
    .default(100),
});

/**
 * Configuration schema for recurring visit bonus template
 */
const recurringVisitConfigSchema = z.object({
  pointsPerVisit: z
    .number()
    .min(1, "Must award at least 1 point")
    .max(1000, "Maximum 1,000 points per visit")
    .default(25),
  visitThreshold: z.number().min(1, "Minimum 1 visit").max(100, "Maximum 100 visits").default(5),
});

// ============================================
// Builder Helpers
// ============================================

/**
 * Resolve the currency code for a template that issues program currency.
 *
 * Throws instead of falling back to a hardcoded "points" string. The
 * fallback was a silent footgun: rules were created with
 * programCurrencyCode: "points" even when the user's program had no
 * currency with that code, then failed at runtime when the engine tried
 * to credit a non-existent currency. Failing fast at build time
 * surfaces the misconfiguration in the wizard execution UI instead.
 */
function requireCurrencyCode(context: { currencyCode?: string }, templateName: string): string {
  if (!context.currencyCode) {
    throw new Error(
      `Template "${templateName}" requires a program currency, but none was provided. Enable the program currency feature and configure it before selecting this award rule template.`
    );
  }
  return context.currencyCode;
}

/**
 * Build a program-scoped event type code, matching the platform's
 * event-type-code convention: the program-code segment must contain
 * letters only (see `sanitizeProgramCodeForEventType` above, the same
 * canonical converter already used everywhere else in this package that
 * generates a program-scoped code). A raw program code such as
 * "cafe-rewards" must be sanitized to "caferewards" before being used as
 * a scope prefix — "cafe-rewards.purchase" is a syntactically-valid event
 * type code but does not match what the platform actually fires, so a
 * rule scoped to it would silently never trigger.
 *
 * `buildEventRulePayload` (api-converters.ts) already pre-sanitizes the
 * `programCode` it passes into every template's `buildEventRule`, so
 * today's only production caller is unaffected either way — sanitizing
 * again here is a no-op on an already-sanitized code. This makes each
 * template correct on its own instead of relying on that undocumented,
 * caller-side contract.
 *
 * When no program code is available at all, the suffix is returned
 * unscoped, matching every call site's original fallback behavior.
 */
function scopeEventType(programCode: string | undefined, suffix: string): string {
  return programCode ? `${sanitizeProgramCodeForEventType(programCode)}.${suffix}` : suffix;
}

// ============================================
// Static Templates
// ============================================

/**
 * Static award rule templates.
 *
 * TO ADD A NEW TEMPLATE:
 * 1. Define the config schema (z.object)
 * 2. Add entry to this array with buildEventRule implementation
 * 3. Template will appear in the wizard automatically
 *
 * FUTURE: This array will be merged with templates from API
 */
export const AWARD_RULE_TEMPLATES: AwardRuleTemplate[] = [
  {
    id: "points-per-dollar",
    name: "Points per Dollar Spent",
    description: "Award points based on purchase amount",
    example: "Earn 10 points for every $1 spent",
    iconName: "ShoppingCart",
    category: "earn",
    eventTypeCode: "purchase",
    configSchema: pointsPerDollarConfigSchema,
    defaultConfig: {
      pointsPerDollar: 10,
    },
    source: "static",
    buildEventRule: (config, context) => {
      const pointsPerDollar = (config.pointsPerDollar as number | undefined) ?? 10;
      const scopedEventType = scopeEventType(context.programCode, "purchase");
      return {
        eventTypeCode: scopedEventType,
        programIds: [context.programId],
        category: "ORGANIZATION_DEFINED" as CreateEventRuleCategory,
        eventExpression: { true: {} },
        eventActionsExpression: {
          true: {
            actions: [
              {
                issueProgramCurrency: {
                  programId: context.programId,
                  programCurrencyCode: requireCurrencyCode(context, "Points per Dollar Spent"),
                  // This template always scopes to a transactional purchase
                  // event type (eventTypeCode above), never a custom
                  // event-based one. A real purchase event's persisted
                  // eventData has no top-level `amount` -- only the
                  // `transaction` parent type's own Money-typed
                  // `eligibleAmount` (confirmed live: publishing a real
                  // purchase event and reading back its eventData shows
                  // `eventData.eligibleAmount.amount`, never a bare
                  // `eventData.amount`). The old path silently matched
                  // nothing, so the multiply below always operated on a
                  // missing value and no currency was ever issued.
                  path: "$.eventData.eligibleAmount.amount",
                  ...(pointsPerDollar !== 1
                    ? {
                        preOperation: {
                          multiply: { operand: pointsPerDollar },
                        },
                      }
                    : {}),
                  targetIdsToIncrement: context.tierTargetIds ?? [],
                  registerTargets: true,
                  synchronous: false,
                },
              },
            ],
          },
        },
      };
    },
  },
  {
    id: "points-per-purchase",
    name: "Fixed Points per Purchase",
    description: "Award a fixed number of points for each purchase",
    example: "Earn 50 points for every purchase",
    iconName: "Gift",
    category: "earn",
    eventTypeCode: "purchase",
    configSchema: fixedPointsConfigSchema,
    defaultConfig: {
      pointsPerPurchase: 50,
    },
    source: "static",
    buildEventRule: (config, context) => {
      const pointsPerPurchase = (config.pointsPerPurchase as number | undefined) ?? 50;
      const scopedEventType = scopeEventType(context.programCode, "purchase");
      return {
        eventTypeCode: scopedEventType,
        programIds: [context.programId],
        category: "ORGANIZATION_DEFINED" as CreateEventRuleCategory,
        eventExpression: { true: {} },
        eventActionsExpression: {
          true: {
            actions: [
              {
                issueProgramCurrency: {
                  programId: context.programId,
                  programCurrencyCode: requireCurrencyCode(context, "Fixed Points per Purchase"),
                  defaultResult: pointsPerPurchase,
                  isFixedAmount: true,
                  targetIdsToIncrement: context.tierTargetIds ?? [],
                  registerTargets: true,
                  synchronous: false,
                },
              },
            ],
          },
        },
      };
    },
  },
  {
    id: "signup-bonus",
    name: "Sign-up Bonus",
    description: "Award points when a customer joins",
    example: "Earn 100 points when you sign up",
    iconName: "UserPlus",
    category: "bonus",
    // MUST match the eventTypeCode produced by buildEventRule below.
    // customer.created (period) is the canonical form; customer_created
    // (underscore) would fail the API regex ^[a-z]+(?:\.[a-z0-9]+)*$.
    eventTypeCode: "customer.created",
    configSchema: signupBonusConfigSchema,
    defaultConfig: {
      bonusPoints: 100,
    },
    source: "static",
    buildEventRule: (config, context) => {
      const bonusPoints = (config.bonusPoints as number | undefined) ?? 100;
      return {
        eventTypeCode: "customer.created",
        programIds: [context.programId],
        category: "ORGANIZATION_DEFINED" as CreateEventRuleCategory,
        eventExpression: { true: {} },
        eventActionsExpression: {
          true: {
            actions: [
              {
                issueProgramCurrency: {
                  programId: context.programId,
                  programCurrencyCode: requireCurrencyCode(context, "Sign-up Bonus"),
                  defaultResult: bonusPoints,
                  isFixedAmount: true,
                  targetIdsToIncrement: context.tierTargetIds ?? [],
                  registerTargets: true,
                  synchronous: false,
                },
              },
            ],
          },
        },
      };
    },
  },
  {
    id: "birthday-bonus",
    name: "Birthday Bonus",
    description: "Award points on customer's birthday",
    example: "Earn 200 points on your birthday",
    iconName: "Calendar",
    category: "bonus",
    eventTypeCode: "birthday",
    configSchema: birthdayBonusConfigSchema,
    defaultConfig: {
      bonusPoints: 200,
    },
    source: "static",
    buildEventRule: (config, context) => {
      const bonusPoints = (config.bonusPoints as number | undefined) ?? 200;
      return {
        eventTypeCode: "birthday",
        programIds: [context.programId],
        category: "ORGANIZATION_DEFINED" as CreateEventRuleCategory,
        eventExpression: { true: {} },
        eventActionsExpression: {
          true: {
            actions: [
              {
                issueProgramCurrency: {
                  programId: context.programId,
                  programCurrencyCode: requireCurrencyCode(context, "Birthday Bonus"),
                  defaultResult: bonusPoints,
                  isFixedAmount: true,
                  targetIdsToIncrement: context.tierTargetIds ?? [],
                  registerTargets: true,
                  synchronous: false,
                },
              },
            ],
          },
        },
      };
    },
  },
  {
    id: "referral-bonus",
    name: "Referral Bonus",
    description: "Reward customers for referring friends",
    example: "Earn 500 points when a friend signs up",
    iconName: "Star",
    category: "bonus",
    eventTypeCode: "referral.completed",
    configSchema: referralBonusConfigSchema,
    defaultConfig: {
      referrerPoints: 500,
    },
    source: "static",
    buildEventRule: (config, context) => {
      const referrerPoints = (config.referrerPoints as number | undefined) ?? 500;
      return {
        eventTypeCode: "referral.completed",
        programIds: [context.programId],
        category: "ORGANIZATION_DEFINED" as CreateEventRuleCategory,
        eventExpression: { true: {} },
        eventActionsExpression: {
          true: {
            actions: [
              {
                issueProgramCurrency: {
                  programId: context.programId,
                  programCurrencyCode: requireCurrencyCode(context, "Referral Bonus"),
                  defaultResult: referrerPoints,
                  isFixedAmount: true,
                  targetIdsToIncrement: context.tierTargetIds ?? [],
                  registerTargets: true,
                  synchronous: false,
                },
              },
            ],
          },
        },
      };
    },
  },
  {
    id: "recurring-visit",
    name: "Visit Rewards",
    description: "Reward customers for repeat visits",
    example: "Earn 25 points for every visit, bonus at 5 visits",
    iconName: "Repeat",
    category: "earn",
    // Static metadata field — must match the regex ^[a-z]+(?:\.[a-z0-9]+)*$.
    // Will be scoped per-program by buildEventRule below.
    eventTypeCode: "visit",
    configSchema: recurringVisitConfigSchema,
    defaultConfig: {
      pointsPerVisit: 25,
      visitThreshold: 5,
    },
    source: "static",
    buildEventRule: (config, context) => {
      const pointsPerVisit = (config.pointsPerVisit as number | undefined) ?? 25;
      return {
        // Scope to the specific program so two programs in the same org
        // don't accidentally cross-fire on each other's "visit" events.
        eventTypeCode: scopeEventType(context.programCode, "visit"),
        programIds: [context.programId],
        category: "ORGANIZATION_DEFINED" as CreateEventRuleCategory,
        eventExpression: { true: {} },
        eventActionsExpression: {
          true: {
            actions: [
              {
                issueProgramCurrency: {
                  programId: context.programId,
                  programCurrencyCode: requireCurrencyCode(context, "Visit Rewards"),
                  defaultResult: pointsPerVisit,
                  isFixedAmount: true,
                  targetIdsToIncrement: context.tierTargetIds ?? [],
                  registerTargets: true,
                  synchronous: false,
                },
              },
            ],
          },
        },
      };
    },
  },
  // ---- Custom Event (event-based programs) ----
  {
    id: "customEvent",
    name: "Custom Event",
    description: "Award points when a custom event fires",
    example: "Earn 100 points for every event",
    iconName: "Sparkles",
    category: "earn",
    // Static eventTypeCode is a placeholder — the actual code comes from
    // context.eventTypeCode (set by the wizard's custom event step).
    eventTypeCode: "custom",
    configSchema: customEventConfigSchema,
    defaultConfig: {
      pointsPerEvent: 100,
    },
    source: "static",
    buildEventRule: (config, context) => {
      // For custom events, the event type code comes from the wizard's
      // event type step, not from the template's static eventTypeCode.
      const resolvedEventType =
        context.eventTypeCode ?? scopeEventType(context.programCode, "custom");

      return {
        eventTypeCode: resolvedEventType,
        programIds: [context.programId],
        category: "ORGANIZATION_DEFINED" as CreateEventRuleCategory,
        eventExpression: { true: {} },
        eventActionsExpression: {
          true: {
            actions: [
              {
                issueProgramCurrency: {
                  programId: context.programId,
                  programCurrencyCode: requireCurrencyCode(context, "Custom Event"),
                  isFixedAmount: true,
                  defaultResult: (config.pointsPerEvent as number) ?? 100,
                  targetIdsToIncrement: context.tierTargetIds ?? [],
                  registerTargets: true,
                  synchronous: false,
                },
              },
            ],
          },
        },
        processItemsIndividually: false,
      };
    },
  },
];

// ============================================
// Template Utilities
// ============================================

/**
 * Get template by ID
 */
export function getTemplateById(id: string): AwardRuleTemplate | undefined {
  return AWARD_RULE_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: AwardRuleTemplate["category"]
): AwardRuleTemplate[] {
  return AWARD_RULE_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get unique categories from templates
 */
export function getTemplateCategories(): AwardRuleTemplate["category"][] {
  const categories = new Set(AWARD_RULE_TEMPLATES.map((t) => t.category));
  return Array.from(categories);
}

/**
 * Validate template configuration
 */
export function validateTemplateConfig(
  templateId: string,
  config: Record<string, unknown>
): { valid: boolean; errors?: Record<string, string> } {
  const template = getTemplateById(templateId);
  if (!template) {
    return { valid: false, errors: { templateId: "Unknown template" } };
  }

  const result = template.configSchema.safeParse(config);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const error of result.error.issues) {
      errors[error.path.join(".")] = error.message;
    }
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Get default config for a template
 */
export function getDefaultConfig(templateId: string): Record<string, unknown> {
  const template = getTemplateById(templateId);
  return template?.defaultConfig ?? {};
}
