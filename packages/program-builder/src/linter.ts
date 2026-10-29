/**
 * Pre-execution config linter.
 *
 * Pure function over a `ProgramSpec` that catches dead-config bugs BEFORE
 * the executor makes any API call. The linter is the "PR #273 shall never
 * recur" guardrail — every class of bug that would produce a broken
 * loyalty program (dead tiers without progression, orphan badges,
 * currencies without earn rules, etc.) gets a rule here.
 *
 * Policy (per eng review 2026-04-07): every future production bug that
 * could have been caught by a spec linter rule MUST add a new rule here
 * before the fix lands. The linter is the regression net for class-of-bug
 * regressions.
 *
 * Rules are pure functions that take a spec (or partial spec) and return
 * zero or more violations. `validateProgramSpec` runs the full set;
 * `validateProgramSpecPartial` skips rules that depend on fields that
 * may not be present mid-wizard.
 */

import type { ProgramSpec } from "./spec";
import type { LintViolation } from "./types";

// ────────────────────────────────────────────────────────────────
// Rule codes (stable identifiers — callers switch on these)
// ────────────────────────────────────────────────────────────────

export const LINTER_RULE_CODES = {
  DEAD_TIER_NO_PROGRESSION: "dead-tier-no-progression",
  ORPHAN_BADGE: "orphan-badge",
  CURRENCY_WITHOUT_EARN_RULE: "currency-without-earn-rule",
  AUTO_AWARD_NO_BASE_TIER: "auto-award-no-base-tier",
  EVENT_BASED_NO_EVENT_TYPE: "event-based-no-event-type",
  TIER_CODE_COLLISION: "tier-code-collision",
  TIER_THRESHOLD_NON_ASCENDING: "tier-threshold-non-ascending",
  SIGNUP_BONUS_WITHOUT_CURRENCY: "signup-bonus-without-currency",
  BIRTHDAY_BONUS_WITHOUT_CURRENCY: "birthday-bonus-without-currency",
  BADGE_CODE_COLLISION: "badge-code-collision",
  TIERS_ENABLED_NO_TIERS: "tiers-enabled-no-tiers",
  BADGES_ENABLED_NO_BADGES: "badges-enabled-no-badges",
  MISSING_TEST_CUSTOMER: "missing-test-customer",
  REFERENCED_METADATA_MISSING: "referenced-metadata-missing",
} as const;

export type LinterRuleCode = (typeof LINTER_RULE_CODES)[keyof typeof LINTER_RULE_CODES];

// ────────────────────────────────────────────────────────────────
// Individual rules
//
// Each rule is a pure function: (spec) → LintViolation[]. Return an
// empty array if the rule doesn't fire. Rules do not throw.
// ────────────────────────────────────────────────────────────────

/**
 * dead-tier-no-progression:
 *
 * If tiers are enabled and any tier has `pointsThreshold > 0` (i.e. it's
 * not the base tier), there must be a mechanism to PROGRESS customers
 * into it. Currently that mechanism is the automatic tier-progression
 * rule the executor creates via CounterTargets — but the linter's job is
 * to catch the spec-level condition before execution.
 *
 * A tier with `pointsThreshold > 0` and no `counterTargetTypeCode` is
 * a warning (the executor's default CounterTarget type may still work).
 * The more severe case is: tiers enabled, at least one non-base tier,
 * AND `autoAwardBaseTier` is false AND no rank-1 base tier exists. In
 * that case the customer has no way to receive ANY tier — dead tiers
 * end-to-end.
 */
function checkDeadTierNoProgression(spec: Partial<ProgramSpec>): LintViolation[] {
  if (!spec.selectedFeatures?.tiers) return [];
  const tiers = spec.tiers ?? [];
  if (tiers.length === 0) return [];

  // Base tier = pointsThreshold === 0.
  const baseTiers = tiers.filter((t) => t.pointsThreshold === 0);
  const nonBaseTiers = tiers.filter((t) => t.pointsThreshold > 0);

  const violations: LintViolation[] = [];

  // The critical dead-tier case: non-base tiers exist, but there's no way to
  // enter the ladder AT ALL (no base tier + no auto-award). Only suggest the
  // base-tier path — enabling auto-award here would just trade this rule for
  // AUTO_AWARD_NO_BASE_TIER and loop the user (WV006).
  if (nonBaseTiers.length > 0 && baseTiers.length === 0 && !spec.autoAwardBaseTier) {
    violations.push({
      path: "tiers",
      code: LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION,
      severity: "error",
      message:
        "Tiers are enabled but customers have no way to enter the tier system. " +
        "Add a tier with pointsThreshold: 0 as the starting point.",
      fix: "Add a tier with pointsThreshold: 0.",
    });
  }

  return violations;
}

/**
 * auto-award-no-base-tier:
 *
 * `autoAwardBaseTier` fires the wizard's base-tier-rule (customer.created →
 * IssueCustomerTierAction). That action needs a target tier code — specifically,
 * the rank-1 (lowest pointsThreshold) tier. If the spec sets `autoAwardBaseTier`
 * but has no tier with pointsThreshold === 0, the rule has no target and will
 * fail at runtime.
 */
function checkAutoAwardNoBaseTier(spec: Partial<ProgramSpec>): LintViolation[] {
  if (!spec.autoAwardBaseTier) return [];
  const tiers = spec.tiers ?? [];
  const hasBaseTier = tiers.some((t) => t.pointsThreshold === 0);
  if (hasBaseTier) return [];

  return [
    {
      path: "autoAwardBaseTier",
      code: LINTER_RULE_CODES.AUTO_AWARD_NO_BASE_TIER,
      severity: "error",
      message:
        "autoAwardBaseTier is enabled but the spec has no base tier (a tier with pointsThreshold: 0).",
      fix: "Add a tier with pointsThreshold: 0 or set autoAwardBaseTier: false.",
    },
  ];
}

/**
 * currency-without-earn-rule:
 *
 * Program currency is the vehicle for earning points. Without an earning
 * rule the currency just sits there and no customer can ever receive any.
 * This rule fires if currency is enabled but the spec has no award rule
 * template selected.
 */
function checkCurrencyWithoutEarnRule(spec: Partial<ProgramSpec>): LintViolation[] {
  if (!spec.selectedFeatures?.programCurrency) return [];
  const templateId = spec.awardRule?.templateId ?? "";
  if (templateId.length > 0) return [];

  return [
    {
      path: "awardRule.templateId",
      code: LINTER_RULE_CODES.CURRENCY_WITHOUT_EARN_RULE,
      severity: "error",
      message:
        "Program currency is enabled but no earning rule template is selected. Customers would never earn any points.",
      fix: "Pick an earning rule template (points-per-dollar, points-per-purchase, etc.) for the award rule.",
    },
  ];
}

/**
 * event-based-no-event-type:
 *
 * An event-based program fires its award rule against a custom event type.
 * That event type must be defined in the spec so the executor can create it
 * before the award rule.
 */
function checkEventBasedNoEventType(spec: Partial<ProgramSpec>): LintViolation[] {
  if (spec.selectedFeatures?.programType !== "event-based") return [];
  const eventType = spec.eventType;
  if (eventType && eventType.code && eventType.name) return [];

  return [
    {
      path: "eventType",
      code: LINTER_RULE_CODES.EVENT_BASED_NO_EVENT_TYPE,
      severity: "error",
      message:
        "Program type is 'event-based' but no event type is defined. The executor needs an event type to register before creating the award rule.",
      fix: "Define eventType with code, name, and at least one data field.",
    },
  ];
}

/**
 * missing-test-customer:
 * Spec needs `testCustomer` unless `skipTestRun: true` is set. Catches
 * partial specs that would have silently skipped the dev-env test run.
 *
 * The wizard's customer-step validation
 * (`apps/hub/src/features/program-wizard/lib/wizard-config.ts`) is the
 * first-line guard — it blocks step progression on empty email. This
 * rule is the executor-side safety net for non-wizard callers (uploaded
 * templates, programmatic clients) where that guard doesn't apply.
 */
function checkMissingTestCustomer(spec: Partial<ProgramSpec>): LintViolation[] {
  if (spec.skipTestRun === true) return [];
  if (spec.testCustomer && spec.testCustomer.email) return [];
  return [
    {
      path: "testCustomer",
      code: LINTER_RULE_CODES.MISSING_TEST_CUSTOMER,
      severity: "error",
      message:
        "Spec is missing testCustomer but skipTestRun is not set — the executor would silently skip the dev-env test run. Either provide a testCustomer or set skipTestRun: true.",
      fix: "Add testCustomer with email/firstName/lastName, OR set skipTestRun: true at the spec root.",
    },
  ];
}

/**
 * tier-code-collision:
 *
 * Tier codes must be unique within a program. The Zod schema enforces this
 * too, but the linter catches it independently so partial specs (mid-wizard)
 * surface the violation without requiring a full Zod validation pass.
 */
function checkTierCodeCollision(spec: Partial<ProgramSpec>): LintViolation[] {
  const tiers = spec.tiers ?? [];
  const seen = new Map<string, number[]>();
  tiers.forEach((t, idx) => {
    if (!t.code) return;
    const existing = seen.get(t.code);
    if (existing) {
      existing.push(idx);
    } else {
      seen.set(t.code, [idx]);
    }
  });

  const violations: LintViolation[] = [];
  for (const [code, indices] of seen.entries()) {
    if (indices.length > 1) {
      violations.push({
        path: `tiers[${indices[1]}].code`,
        code: LINTER_RULE_CODES.TIER_CODE_COLLISION,
        severity: "error",
        message: `Tier code "${code}" is used by ${indices.length} tiers. Tier codes must be unique within a program.`,
        fix: `Rename one of the conflicting tiers (indices ${indices.join(", ")}).`,
      });
    }
  }
  return violations;
}

/**
 * tier-threshold-non-ascending:
 *
 * Tiers should have strictly increasing point thresholds when sorted by rank.
 * Equal thresholds create ambiguity in which tier a customer is assigned to.
 * The executor's wizard today sorts by pointsThreshold for rank assignment,
 * so a tie produces undefined ordering.
 */
function checkTierThresholdNonAscending(spec: Partial<ProgramSpec>): LintViolation[] {
  const tiers = spec.tiers ?? [];
  if (tiers.length < 2) return [];

  const sorted = [...tiers].sort((a, b) => a.pointsThreshold - b.pointsThreshold);
  const violations: LintViolation[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (!prev || !current) continue;
    if (current.pointsThreshold === prev.pointsThreshold) {
      violations.push({
        path: `tiers.pointsThreshold`,
        code: LINTER_RULE_CODES.TIER_THRESHOLD_NON_ASCENDING,
        severity: "error",
        message:
          `Tiers "${prev.code}" and "${current.code}" both have pointsThreshold ${current.pointsThreshold}. ` +
          `Tier thresholds must be strictly ascending so rank assignment is deterministic.`,
        fix: "Adjust one of the thresholds so every tier has a unique value.",
      });
    }
  }
  return violations;
}

/**
 * signup-bonus-without-currency:
 *
 * Signup bonus awards currency. Without currency enabled, the rule has no
 * currency to award. This is also enforced by selectedFeaturesSchema's
 * refine, but the linter surfaces it for partial specs.
 */
function checkSignupBonusWithoutCurrency(spec: Partial<ProgramSpec>): LintViolation[] {
  if (!spec.selectedFeatures?.signupBonus) return [];
  if (spec.selectedFeatures.programCurrency) return [];

  return [
    {
      path: "selectedFeatures.signupBonus",
      code: LINTER_RULE_CODES.SIGNUP_BONUS_WITHOUT_CURRENCY,
      severity: "error",
      message:
        "Signup bonus is enabled but program currency is not. Bonus rules need a currency to award.",
      fix: "Enable programCurrency or disable signupBonus.",
    },
  ];
}

/**
 * birthday-bonus-without-currency:
 *
 * Same reasoning as signup-bonus-without-currency.
 */
function checkBirthdayBonusWithoutCurrency(spec: Partial<ProgramSpec>): LintViolation[] {
  if (!spec.selectedFeatures?.birthdayBonus) return [];
  if (spec.selectedFeatures.programCurrency) return [];

  return [
    {
      path: "selectedFeatures.birthdayBonus",
      code: LINTER_RULE_CODES.BIRTHDAY_BONUS_WITHOUT_CURRENCY,
      severity: "error",
      message:
        "Birthday bonus is enabled but program currency is not. Bonus rules need a currency to award.",
      fix: "Enable programCurrency or disable birthdayBonus.",
    },
  ];
}

/**
 * badge-code-collision:
 *
 * Badge codes must be unique within a program. Same reasoning as tier codes.
 */
function checkBadgeCodeCollision(spec: Partial<ProgramSpec>): LintViolation[] {
  const badges = spec.badges ?? [];
  const seen = new Map<string, number[]>();
  badges.forEach((b, idx) => {
    if (!b.code) return;
    const existing = seen.get(b.code);
    if (existing) {
      existing.push(idx);
    } else {
      seen.set(b.code, [idx]);
    }
  });

  const violations: LintViolation[] = [];
  for (const [code, indices] of seen.entries()) {
    if (indices.length > 1) {
      violations.push({
        path: `badges[${indices[1]}].code`,
        code: LINTER_RULE_CODES.BADGE_CODE_COLLISION,
        severity: "error",
        message: `Badge code "${code}" is used by ${indices.length} badges. Badge codes must be unique within a program.`,
        fix: `Rename one of the conflicting badges (indices ${indices.join(", ")}).`,
      });
    }
  }
  return violations;
}

/**
 * tiers-enabled-no-tiers:
 *
 * Feature is on but the array is empty. Executor would create nothing and
 * the user would get a tiered program with no tiers.
 */
function checkTiersEnabledNoTiers(spec: Partial<ProgramSpec>): LintViolation[] {
  if (!spec.selectedFeatures?.tiers) return [];
  const tiers = spec.tiers ?? [];
  if (tiers.length > 0) return [];

  return [
    {
      path: "tiers",
      code: LINTER_RULE_CODES.TIERS_ENABLED_NO_TIERS,
      severity: "error",
      message: "Tier system is enabled but the spec defines zero tiers.",
      fix: "Add at least 2 tiers, or disable the tier system feature.",
    },
  ];
}

/**
 * badges-enabled-no-badges:
 *
 * Feature is on but the array is empty. Same issue as tiers-enabled-no-tiers.
 */
function checkBadgesEnabledNoBadges(spec: Partial<ProgramSpec>): LintViolation[] {
  if (!spec.selectedFeatures?.badges) return [];
  const badges = spec.badges ?? [];
  if (badges.length > 0) return [];

  return [
    {
      path: "badges",
      code: LINTER_RULE_CODES.BADGES_ENABLED_NO_BADGES,
      severity: "error",
      message: "Badge system is enabled but the spec defines zero badges.",
      fix: "Add at least 1 badge, or disable the badge feature.",
    },
  ];
}

/**
 * orphan-badge:
 *
 * A badge with no mechanism to issue it. Badge issuance happens via an
 * event rule action (IssueCustomerBadgeAction) — if no rule references the
 * badge, it's dead config. The wizard currently doesn't wire badge issuance
 * into the earning rule, so this is a WARNING-level rule (not error) — the
 * badge can be wired manually post-creation via the badge detail view.
 */
function checkOrphanBadge(spec: Partial<ProgramSpec>): LintViolation[] {
  const badges = spec.badges ?? [];
  if (badges.length === 0) return [];

  // Heuristic: if the badge's code appears anywhere in the award rule payload
  // (as JSON stringification of any nested action/expression), consider it
  // referenced. This is intentionally loose because the badge issuance
  // pattern is evolving.
  const awardRulePayloadJson = JSON.stringify(spec.awardRule?.rulePayload ?? {});

  const violations: LintViolation[] = [];
  badges.forEach((b, idx) => {
    if (!b.code) return;
    if (awardRulePayloadJson.includes(b.code)) return;
    violations.push({
      path: `badges[${idx}]`,
      code: LINTER_RULE_CODES.ORPHAN_BADGE,
      severity: "warning",
      message: `Badge "${b.code}" is defined but no earning rule references it. You'll need to wire badge issuance manually.`,
      fix: "Add an IssueCustomerBadgeAction to an event rule that targets this badge's code.",
    });
  });
  return violations;
}

/**
 * referenced-metadata-missing:
 *
 * Program, currency, and tier-progression entities reference metadata
 * instances. The metadata stage only iterates `spec.metadata`, so a missing
 * row would otherwise make a fresh tenant abort mid-run after earlier stages
 * may already have created entities. Standard codes are intentionally not
 * exempt: the standard-type registry is documentation/template guidance and
 * is not consulted by `runCreatingMetadata`.
 */
function checkReferencedMetadata(spec: Partial<ProgramSpec>): LintViolation[] {
  const metadata = spec.metadata ?? [];
  const hasMetadata = (typeCode: string, code: string) =>
    metadata.some((record) => record.typeCode === typeCode && record.code === code);
  const violations: LintViolation[] = [];

  const programTypeCode = spec.program?.typeCode;
  if (programTypeCode && !hasMetadata("PROGRAM_TYPE", programTypeCode)) {
    violations.push({
      path: "program.typeCode",
      code: LINTER_RULE_CODES.REFERENCED_METADATA_MISSING,
      severity: "error",
      message: `program.typeCode "${programTypeCode}" requires a matching PROGRAM_TYPE metadata row.`,
      fix: `Add { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "${programTypeCode}", name: "..." } to metadata.`,
    });
  }

  const currencyTypeCode = spec.currency?.currencyTypeCode;
  if (currencyTypeCode && !hasMetadata("CURRENCY_TYPE", currencyTypeCode)) {
    violations.push({
      path: "currency.currencyTypeCode",
      code: LINTER_RULE_CODES.REFERENCED_METADATA_MISSING,
      severity: "error",
      message: `currency.currencyTypeCode "${currencyTypeCode}" requires a matching CURRENCY_TYPE metadata row.`,
      fix: `Add { category: "DATA_TYPE", typeCode: "CURRENCY_TYPE", code: "${currencyTypeCode}", name: "..." } to metadata.`,
    });
  }

  if (spec.selectedFeatures?.tiers) {
    for (const [index, tier] of (spec.tiers ?? []).entries()) {
      if (tier.pointsThreshold <= 0) continue;
      const resolvedCode = (tier.counterTargetTypeCode ?? currencyTypeCode ?? "POINTS_EARNED")
        .toUpperCase()
        .replace(/-/g, "_");
      if (!hasMetadata("COUNTER_TARGET_TYPE", resolvedCode)) {
        violations.push({
          path: `tiers[${index}].counterTargetTypeCode`,
          code: LINTER_RULE_CODES.REFERENCED_METADATA_MISSING,
          severity: "error",
          message: `Tier progression requires a matching COUNTER_TARGET_TYPE metadata row for "${resolvedCode}".`,
          fix: `Add { category: "DATA_TYPE", typeCode: "COUNTER_TARGET_TYPE", code: "${resolvedCode}", name: "..." } to metadata.`,
        });
      }
    }
  }

  return violations;
}

// ────────────────────────────────────────────────────────────────
// Rule registries
// ────────────────────────────────────────────────────────────────

/**
 * Rules that run on a COMPLETE spec.
 *
 * These may reference fields the wizard hasn't collected yet mid-flow, so
 * partial validation skips them.
 */
const FULL_SPEC_RULES: Array<(spec: Partial<ProgramSpec>) => LintViolation[]> = [
  checkCurrencyWithoutEarnRule,
  checkEventBasedNoEventType,
  checkMissingTestCustomer,
];

/**
 * Rules that are safe to run on a partial spec.
 *
 * These only touch fields that make sense to validate as soon as they exist.
 */
const PARTIAL_SAFE_RULES: Array<(spec: Partial<ProgramSpec>) => LintViolation[]> = [
  checkDeadTierNoProgression,
  checkAutoAwardNoBaseTier,
  checkTierCodeCollision,
  checkTierThresholdNonAscending,
  checkSignupBonusWithoutCurrency,
  checkBirthdayBonusWithoutCurrency,
  checkBadgeCodeCollision,
  checkTiersEnabledNoTiers,
  checkBadgesEnabledNoBadges,
  checkOrphanBadge,
];

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Options for `validateProgramSpec`.
 *
 * The default (no options) runs the standard full-spec rules, including the
 * executor-side checks that only apply to a fully-hydrated spec (test
 * customer / signup bonus completeness / etc.). Pre-execution callers —
 * preview sheets, wizard-step gates — should pass `unhydrated: true` so
 * checks the executor's hydration pass would satisfy don't fire prematurely.
 */
export interface ValidateProgramSpecOptions {
  /**
   * Set when validating a spec that hasn't been through
   * `hydrateForExecution` yet. Skips rules that the executor's hydration
   * pass would otherwise satisfy (currently: `missing-test-customer`,
   * which the executor synthesizes via `skipTestRun: true` when the
   * uploaded spec has no test customer).
   *
   * Use this in UIs that gate Create on lint passing — the user expects
   * the gate to reflect "would this actually fail at execution time",
   * and an unhydrated spec failing a hydration-resolved rule is a
   * false negative.
   */
  unhydrated?: boolean;
  /**
   * Require every program, currency, and tier-progression metadata reference
   * to be declared in `spec.metadata`. This is for callers, such as the AI
   * executor path, that cannot establish metadata out of band. Leave false
   * when referenced metadata may already exist on the tenant.
   */
  requireExplicitMetadata?: boolean;
}

/**
 * Validate a complete program spec against all linter rules.
 *
 * Used by `runProgramExecutor` before making any API call. If the return
 * value is `{ ok: false }`, the executor refuses to run and returns
 * `{ status: 'lint-failed', violations }`.
 *
 * Only error-level violations cause `ok: false`. Warning-level violations
 * are returned but do not block — callers should render them as advisory
 * messages.
 *
 * Pre-execution callers (preview gates, wizard Create buttons) should pass
 * `{ unhydrated: true }` to skip rules the executor's hydration would
 * resolve. See `ValidateProgramSpecOptions.unhydrated`.
 */
export function validateProgramSpec(
  spec: ProgramSpec,
  options: ValidateProgramSpecOptions = {}
): { ok: true; warnings: LintViolation[] } | { ok: false; violations: LintViolation[] } {
  const fullRules = options.unhydrated
    ? FULL_SPEC_RULES.filter((rule) => rule !== checkMissingTestCustomer)
    : FULL_SPEC_RULES;
  const allRules = [
    ...fullRules,
    ...PARTIAL_SAFE_RULES,
    ...(options.requireExplicitMetadata ? [checkReferencedMetadata] : []),
  ];
  const all: LintViolation[] = [];
  for (const rule of allRules) {
    all.push(...rule(spec));
  }

  const errors = all.filter((v) => v.severity === "error");
  const warnings = all.filter((v) => v.severity === "warning");

  if (errors.length > 0) {
    // Return ALL violations (errors and warnings) so the caller can render
    // both without a second validation pass.
    return { ok: false, violations: all };
  }
  return { ok: true, warnings };
}

/**
 * Validate a partial program spec (mid-wizard or mid-conversation).
 *
 * Runs only the subset of rules that are safe on incomplete specs. The
 * wizard calls this at step transitions to surface inline violations
 * without requiring the user to finish every step first.
 *
 * Returns the same shape as `validateProgramSpec` but warnings are always
 * OK — partial validation never has "ok: false" for warning-only violations.
 */
export function validateProgramSpecPartial(
  partial: Partial<ProgramSpec>
): { ok: true; warnings: LintViolation[] } | { ok: false; violations: LintViolation[] } {
  const all: LintViolation[] = [];
  for (const rule of PARTIAL_SAFE_RULES) {
    all.push(...rule(partial));
  }

  const errors = all.filter((v) => v.severity === "error");
  const warnings = all.filter((v) => v.severity === "warning");

  if (errors.length > 0) {
    return { ok: false, violations: all };
  }
  return { ok: true, warnings };
}
