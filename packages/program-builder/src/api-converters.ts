/**
 * API Converters
 *
 * These helpers turn a `ProgramSpec` into API payloads. Originated in
 * `apps/hub/src/features/program-wizard/lib/api-converters.ts` and moved
 * here so both the wizard and the AI onboarding agent share the same
 * payload builders.
 *
 * Key change vs the wizard copy:
 * - Parameter type changed from `ProgramWizardData` to `ProgramSpec`.
 * - Deprecated fields (`hasExpiration`, `hasPendingPeriod`, `skipCurrency`)
 *   are no longer read — the `selectedFeatures.*` flags are the canonical
 *   source of truth.
 */

import type {
  CreateCustomer,
  CreateEventRule,
  CreateExpiryRule,
  CreatePendingRule,
  CreateProgram,
  CreateProgramCurrency,
} from "@loom-loyalty/sdk";

import { sanitizeProgramCodeForEventType, toResourceCode } from "./execution-helpers";
import type { ProgramSpec } from "./spec";
import { getTemplateById } from "./templates";

// ============================================
// Code Generation Helpers
// ============================================

/**
 * Generate a kebab-case code from a human name, optionally prefixed.
 *
 * Delegates the sanitization to `toResourceCode()` rather than a second
 * hand-rolled implementation: the previous version stripped leading/trailing
 * hyphens BEFORE truncating to 40 characters, so a name whose 40th character
 * landed on a hyphen (or one that was entirely non-alphanumeric) could still
 * produce an empty string or a trailing-hyphen code the API's resource-code
 * pattern rejects.
 */
export function generateCode(name: string, prefix?: string): string {
  const baseCode = toResourceCode(name, "generated").slice(0, 40).replace(/-+$/g, "");
  return prefix ? `${prefix}-${baseCode || "generated"}` : baseCode || "generated";
}

/**
 * Generate expiry rule code/name from program.
 *
 * Routes the composed code through toResourceCode() rather than trusting
 * programCode to already be short enough: the program-step wizard's manual
 * "Program Code" entry has a charset check but no length cap, so a
 * hand-typed programCode plus this suffix can exceed the API's 63-character
 * limit even though every auto-generated programCode stays well under it.
 */
export function generateExpiryRuleFields(
  programCode: string,
  programName: string
): { code: string; name: string } {
  return {
    code: toResourceCode(`${programCode}-expiry`, "expiry"),
    name: `${programName} Expiry Rule`,
  };
}

/**
 * Generate pending rule code/name from program. See generateExpiryRuleFields
 * for why the composed code is re-sanitized rather than trusted as-is.
 */
export function generatePendingRuleFields(
  programCode: string,
  programName: string
): { code: string; name: string } {
  return {
    code: toResourceCode(`${programCode}-pending`, "pending"),
    name: `${programName} Pending Rule`,
  };
}

/**
 * Generate currency code/name from program. See generateExpiryRuleFields for
 * why the composed code is re-sanitized rather than trusted as-is.
 */
export function generateCurrencyFields(
  programCode: string,
  programName: string
): { code: string; name: string } {
  return {
    code: toResourceCode(`${programCode}-points`, "points"),
    name: `${programName} Points`,
  };
}

/**
 * Generate event rule code/name from program and template. See
 * generateExpiryRuleFields for why the composed code is re-sanitized rather
 * than trusted as-is.
 */
export function generateEventRuleFields(
  programCode: string,
  templateId: string
): { code: string; name: string } {
  const template = getTemplateById(templateId);
  const ruleName = template?.name ?? "Award Rule";
  return {
    code: toResourceCode(`${programCode}-${templateId}`, "event-rule"),
    name: ruleName,
  };
}

// ============================================
// API Payload Builders
// ============================================

/**
 * Build CreateProgram payload from a spec.
 */
export function buildProgramPayload(spec: ProgramSpec): CreateProgram {
  const { program } = spec;

  return {
    code: program.code!,
    name: program.name!,
    typeCode: program.typeCode!,
    description: program.description,
    createAccountOnCustomerCreation: program.createAccountOnCustomerCreation ?? true,
    programAccountIdInformation: program.programAccountIdInformation ?? {
      type: "GENERATED",
      prefix: (program.code || "PRG").substring(0, 4).toUpperCase(),
      part1Algorithm: "ALPHABETICAL",
      part1Length: 2,
      part2Algorithm: "NUMERIC",
      part2Length: 6,
    },
  };
}

/**
 * Build CreateProgramCurrency payload from a spec.
 */
export function buildCurrencyPayload(
  spec: ProgramSpec,
  programId: string,
  expiryRuleId?: string,
  pendingRuleId?: string
): CreateProgramCurrency {
  const { currency, program } = spec;

  // Use provided currency data or generate defaults.
  const currencyCode = currency?.code || generateCurrencyFields(program.code!, program.name!).code;
  const currencyName = currency?.name || generateCurrencyFields(program.code!, program.name!).name;

  return {
    code: currencyCode,
    name: currencyName,
    currencyTypeCode: currency?.currencyTypeCode || "points",
    programIds: [programId],
    expiryRuleId,
    pendingRuleId,
  };
}

/**
 * Build CreateExpiryRule payload from a spec. Returns null when expiry is
 * disabled or the expiry rule data is missing.
 */
export function buildExpiryRulePayload(
  spec: ProgramSpec,
  programId: string
): CreateExpiryRule | null {
  // Canonical source: selectedFeatures.expiry. The wizard's original
  // api-converters.ts read `data.hasExpiration` which was a deprecated
  // mirror of the feature flag.
  if (!spec.selectedFeatures?.expiry || !spec.expiryRule) {
    return null;
  }

  const { expiryRule, program } = spec;
  const { code, name } = generateExpiryRuleFields(program.code!, program.name!);

  return {
    code,
    name,
    type: expiryRule.type!,
    expiryPeriod: expiryRule.expiryPeriod,
    expiryPeriodValue: expiryRule.expiryPeriodValue,
    expiryDate: expiryRule.expiryDate,
    programIds: [programId],
  };
}

/**
 * Build CreatePendingRule payload from a spec. Returns null when pending
 * is disabled or the pending rule data is missing.
 */
export function buildPendingRulePayload(
  spec: ProgramSpec,
  programId: string
): CreatePendingRule | null {
  if (!spec.selectedFeatures?.pending || !spec.pendingRule) {
    return null;
  }

  const { pendingRule, program } = spec;
  const { code, name } = generatePendingRuleFields(program.code!, program.name!);

  return {
    code,
    name,
    type: pendingRule.type!,
    pendingPeriod: pendingRule.pendingPeriod,
    pendingPeriodValue: pendingRule.pendingPeriodValue,
    pendingDate: pendingRule.pendingDate,
    programIds: [programId],
  };
}

/**
 * Build a complete event rule payload from the spec's selected template.
 */
export function buildEventRulePayload(
  spec: ProgramSpec,
  programId: string,
  currencyId?: string,
  currencyCode?: string,
  tierTargetIds?: string[]
): CreateEventRule {
  const { awardRule, program } = spec;
  const template = getTemplateById(awardRule.templateId);

  if (!template) {
    throw new Error(`Unknown template: ${awardRule.templateId}`);
  }

  // Build the template-generated portion. The programCode sanitizer is
  // imported from execution-helpers so it matches creating-event-type
  // exactly — drift here would cause the rule's eventTypeCode and the
  // registered EVENT_TYPE data type to diverge silently.
  const templateResult = template.buildEventRule(awardRule.templateConfig, {
    programId,
    currencyId,
    currencyCode,
    programCode: sanitizeProgramCodeForEventType(spec.program.code),
    eventTypeCode: spec.eventType?.code,
    tierTargetIds,
  });

  // Use provided rule code/name or generate defaults.
  const ruleCode =
    awardRule.rulePayload.code || generateEventRuleFields(program.code!, awardRule.templateId).code;
  const ruleName =
    awardRule.rulePayload.name || generateEventRuleFields(program.code!, awardRule.templateId).name;

  return {
    // API requires these on every CreateEventRule. The api-e2e EventRuleBuilder
    // defaults them; templates that need different shapes can override via
    // templateResult since the spread happens after.
    eventTargetsExpression: { true: {} },
    processItemsIndividually: false,
    ...templateResult,
    code: ruleCode,
    name: ruleName,
    programIds: [programId],
  } as CreateEventRule;
}

/**
 * Build CreateCustomer payload from a spec's test customer.
 *
 * Throws if no test customer is set — only dev-env runs should call this,
 * and dev-env runs must always have a test customer attached to the spec.
 */
export function buildCustomerPayload(spec: ProgramSpec, programId: string): CreateCustomer {
  const { testCustomer } = spec;

  if (!testCustomer) {
    throw new Error("Cannot build customer payload: spec has no testCustomer");
  }

  return {
    externalId: testCustomer.externalId || `test-${Date.now()}`,
    identity: {
      firstName: testCustomer.firstName,
      lastName: testCustomer.lastName,
    },
    emailAddresses: [
      {
        typeCode: "work",
        emailAddress: testCustomer.email,
        primary: true,
        status: "ACTIVE",
      },
    ],
    programs: [
      {
        programId,
        customerProgramStatusCode: "ACTIVE",
      },
    ],
  };
}

// ============================================
// Test Event Helpers
// ============================================

/**
 * Build test event data for a given template.
 */
export function buildTestEventData(
  templateId: string,
  customerId: string,
  _templateConfig: Record<string, unknown>
): Record<string, unknown> {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  // Common event data.
  const baseEventData = {
    customerId,
    timestamp: new Date().toISOString(),
  };

  // Template-specific test data.
  switch (template.eventTypeCode) {
    case "purchase":
      // Mirrors the real, live-proven purchase-event shape (see
      // demo-dataset-generator's buildPurchaseEvent) -- the transactional
      // data model requires transactionId/transactionDateTime as real
      // elements, and the real spend lands under eligibleAmount.amount,
      // never a bare top-level "amount". A test event built any other way
      // either 400s against the platform or silently fails to exercise the
      // eligibleAmount.amount-reading reward rules.
      return {
        transactionId: `test-${customerId}-${Date.now()}`,
        transactionDateTime: new Date().toISOString(),
        eligibleAmount: { amount: 50.0, currencyTypeCode: "USD" }, // Test with $50 purchase
      };

    case "customer.created":
      return {
        ...baseEventData,
        eventType: "customer.created",
      };

    case "birthday":
      return {
        ...baseEventData,
        eventType: "birthday",
      };

    case "referral.completed":
      return {
        ...baseEventData,
        eventType: "referral.completed",
        referredCustomerId: `referred-${Date.now()}`,
      };

    case "visit":
      // Same transactional data model as "purchase" (see runCreatingEventType's
      // transactional branch, which isn't purchase-specific) -- transactionId/
      // transactionDateTime are required elements there no matter which
      // template triggered the creation. Unlike purchase, recurring-visit's
      // award rule is a flat pointsPerVisit that never reads eligibleAmount
      // (see templates.ts), so it's omitted here. customerId/timestamp/
      // eventType/locationId aren't declared on that DataModel either -- the
      // platform's schema doesn't allow additional properties, so sending
      // them 400s the same way a stray eligibleAmount would on a
      // custom-event schema.
      return {
        transactionId: `test-${customerId}-${Date.now()}`,
        transactionDateTime: new Date().toISOString(),
      };

    default:
      return {
        amount: 50.0, // Test with $50 purchase
      };
  }
}

/**
 * Calculate expected points for a test event — client-side estimate.
 *
 * This is not API-confirmed because rule processing is asynchronous
 * (all templates use `synchronous: false`). UI should label the value
 * as "expected" so users aren't misled about what was actually credited.
 */
export function calculateExpectedPoints(
  templateId: string,
  templateConfig: Record<string, unknown>,
  testEventData: Record<string, unknown>
): number {
  const template = getTemplateById(templateId);
  if (!template) return 0;

  switch (templateId) {
    case "points-per-dollar": {
      const pointsPerDollar = (templateConfig.pointsPerDollar as number) || 10;
      const amount = (testEventData.amount as number) || 50;
      return Math.floor(amount * pointsPerDollar);
    }

    case "points-per-purchase":
      return (templateConfig.pointsPerPurchase as number) || 50;

    case "signup-bonus":
      return (templateConfig.bonusPoints as number) || 100;

    case "birthday-bonus":
      return (templateConfig.bonusPoints as number) || 200;

    case "referral-bonus":
      return (templateConfig.referrerPoints as number) || 500;

    case "recurring-visit":
      return (templateConfig.pointsPerVisit as number) || 25;

    case "customEvent":
      return (templateConfig.pointsPerEvent as number) || 100;

    default:
      return 0;
  }
}
