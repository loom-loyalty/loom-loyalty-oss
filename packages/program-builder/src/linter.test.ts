/**
 * Linter tests.
 *
 * 11 rules × 2-3 tests each = ~30 tests. Every rule gets:
 * - One "happy path" test that proves the rule does NOT fire on a valid spec
 * - One "fires on violation" test that proves it catches the bug
 * - Optionally a boundary case
 *
 * Plus a few integration-level tests that exercise `validateProgramSpec`
 * and `validateProgramSpecPartial` with multi-rule inputs.
 */

import { describe, expect, it } from "vitest";
import { LINTER_RULE_CODES, validateProgramSpec, validateProgramSpecPartial } from "./linter";
import type { ProgramSpec, SelectedFeatures, WizardBadge, WizardTier } from "./spec";

// ────────────────────────────────────────────────────────────────
// Fixtures — a valid "baseline" spec that passes every rule.
// Each test starts from this and mutates ONE thing to trigger ONE rule.
// ────────────────────────────────────────────────────────────────

function baseFeatures(): SelectedFeatures {
  return {
    programCurrency: true,
    expiry: false,
    pending: false,
    tiers: false,
    badges: false,
    programType: "transactional",
    signupBonus: false,
    birthdayBonus: false,
  };
}

function validSpec(): ProgramSpec {
  return {
    selectedFeatures: baseFeatures(),
    program: { code: "my-rewards", name: "My Rewards", typeCode: "standard" },
    currency: { code: "my-rewards-points", name: "Points", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    promotions: [],
    metadata: [
      {
        category: "DATA_TYPE",
        typeCode: "PROGRAM_TYPE",
        code: "standard",
        name: "Standard Points Program",
      },
      { category: "DATA_TYPE", typeCode: "CURRENCY_TYPE", code: "points", name: "Points" },
    ],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 10 },
      rulePayload: { code: "my-rewards-earn", name: "Earn Points" },
    },
    // Linter requires testCustomer unless skipTestRun is explicit. This
    // factory doesn't model the test run, so it sets skipTestRun: true.
    skipTestRun: true,
  };
}

function validTieredSpec(): ProgramSpec {
  const spec = validSpec();
  spec.selectedFeatures.tiers = true;
  spec.autoAwardBaseTier = true;
  spec.tiers = [
    { name: "Bronze", code: "bronze", pointsThreshold: 0 },
    { name: "Silver", code: "silver", pointsThreshold: 100 },
    { name: "Gold", code: "gold", pointsThreshold: 500 },
  ];
  spec.metadata.push({
    category: "DATA_TYPE",
    typeCode: "COUNTER_TARGET_TYPE",
    code: "POINTS",
    name: "Points",
  });
  return spec;
}

function validBadgedSpec(): ProgramSpec {
  const spec = validSpec();
  spec.selectedFeatures.badges = true;
  spec.badges = [
    { name: "First Purchase", code: "first-purchase" },
    { name: "Loyal Customer", code: "loyal-customer" },
  ];
  // Orphan-badge rule is a warning, not an error, so an untouched
  // awardRule still produces a lint-pass.
  return spec;
}

// ────────────────────────────────────────────────────────────────
// Tests — one describe per rule
// ────────────────────────────────────────────────────────────────

describe("linter", () => {
  describe("rule: referenced metadata missing", () => {
    it("fires when a program typeCode has no matching PROGRAM_TYPE metadata row", () => {
      const spec = validSpec();
      spec.metadata = spec.metadata.filter((record) => record.typeCode !== "PROGRAM_TYPE");

      const result = validateProgramSpec(spec, { requireExplicitMetadata: true });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: LINTER_RULE_CODES.REFERENCED_METADATA_MISSING,
              path: "program.typeCode",
            }),
          ])
        );
      }
    });

    it("fires for standard currency type codes when their explicit metadata row is absent", () => {
      const spec = validSpec();
      spec.metadata = spec.metadata.filter((record) => record.typeCode !== "CURRENCY_TYPE");

      const result = validateProgramSpec(spec, { requireExplicitMetadata: true });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: LINTER_RULE_CODES.REFERENCED_METADATA_MISSING,
              path: "currency.currencyTypeCode",
            }),
          ])
        );
      }
    });

    it("requires COUNTER_TARGET_TYPE metadata for each non-base tier's resolved type", () => {
      const spec = validTieredSpec();
      spec.metadata = spec.metadata.filter((record) => record.typeCode !== "COUNTER_TARGET_TYPE");

      const result = validateProgramSpec(spec, { requireExplicitMetadata: true });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: LINTER_RULE_CODES.REFERENCED_METADATA_MISSING,
              path: "tiers[1].counterTargetTypeCode",
            }),
          ])
        );
      }
    });

    it("allows standard type references without metadata by default", () => {
      const spec = validSpec();
      spec.metadata = [];

      expect(validateProgramSpec(spec)).toMatchObject({ ok: true });
      expect(validateProgramSpec(spec, { requireExplicitMetadata: false })).toMatchObject({
        ok: true,
      });
    });
  });

  describe("rule: dead-tier-no-progression", () => {
    it("does NOT fire when base tier + auto-award exist", () => {
      const result = validateProgramSpec(validTieredSpec());
      expect(result.ok).toBe(true);
    });

    it("fires when non-base tiers exist but no base tier and no auto-award", () => {
      const spec = validTieredSpec();
      spec.autoAwardBaseTier = false;
      // Remove the base tier (pointsThreshold === 0) so there's no entry point
      spec.tiers = spec.tiers.filter((t) => t.pointsThreshold > 0);
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION);
      }
    });

    it("does NOT fire when tiers are disabled", () => {
      const spec = validSpec(); // no tiers enabled
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });

    // Catch-22 regression guard (WV006): DEAD_TIER's `fix` text must not
    // suggest enabling auto-award, because that just trades this rule for
    // AUTO_AWARD_NO_BASE_TIER and loops the user.
    it("fix text does not suggest enabling auto-award (catch-22 guard)", () => {
      const spec = validTieredSpec();
      spec.autoAwardBaseTier = false;
      spec.tiers = [
        { name: "Silver", code: "silver", pointsThreshold: 100 },
        { name: "Gold", code: "gold", pointsThreshold: 500 },
      ];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const violation = result.violations.find(
          (v) => v.code === LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION
        );
        expect(violation).toBeDefined();
        // The fix should ONLY suggest adding a base tier, not enabling auto-award.
        const fixText = (violation?.fix ?? "").toLowerCase();
        expect(fixText).not.toContain("autoaward");
        expect(fixText).not.toContain("auto-award");
        expect(fixText).not.toContain("auto award");
        // And the message itself should not loop the user either.
        const messageText = (violation?.message ?? "").toLowerCase();
        expect(messageText).not.toContain("autoaward");
        expect(messageText).not.toContain("auto-award");
        expect(messageText).not.toContain("auto award");
      }
    });

    // Sequential application: literally applying DEAD_TIER's recommended fix
    // (add a base tier) must clear BOTH this rule and AUTO_AWARD_NO_BASE_TIER.
    it("applying DEAD_TIER fix verbatim clears both DEAD_TIER and AUTO_AWARD violations", () => {
      const spec = validTieredSpec();
      spec.autoAwardBaseTier = false;
      spec.tiers = [
        { name: "Silver", code: "silver", pointsThreshold: 100 },
        { name: "Gold", code: "gold", pointsThreshold: 500 },
      ];
      const before = validateProgramSpec(spec);
      expect(before.ok).toBe(false);
      if (!before.ok) {
        expect(before.violations.map((v) => v.code)).toContain(
          LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION
        );
      }

      // Apply the rule's recommended fix: add a base tier with pointsThreshold: 0.
      spec.tiers.push({ name: "Base", code: "base", pointsThreshold: 0 });
      const after = validateProgramSpec(spec);
      expect(after.ok).toBe(true);
      if (!after.ok) {
        const codes = after.violations.map((v) => v.code);
        expect(codes).not.toContain(LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION);
        expect(codes).not.toContain(LINTER_RULE_CODES.AUTO_AWARD_NO_BASE_TIER);
      }
    });

    // Verbatim fix-text pin — drift detector. If a future change reintroduces
    // the auto-award escape hatch in the fix text, this test fails loudly.
    it("fix text is the exact verbatim string (drift detector)", () => {
      const spec = validTieredSpec();
      spec.autoAwardBaseTier = false;
      spec.tiers = [
        { name: "Silver", code: "silver", pointsThreshold: 100 },
        { name: "Gold", code: "gold", pointsThreshold: 500 },
      ];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const violation = result.violations.find(
          (v) => v.code === LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION
        );
        expect(violation?.fix).toBe("Add a tier with pointsThreshold: 0.");
      }
    });
  });

  describe("rule: auto-award-no-base-tier", () => {
    it("does NOT fire when auto-award has a base tier to reference", () => {
      const result = validateProgramSpec(validTieredSpec());
      expect(result.ok).toBe(true);
    });

    it("fires when autoAwardBaseTier is true but no tier has pointsThreshold: 0", () => {
      const spec = validTieredSpec();
      spec.tiers = [
        { name: "Silver", code: "silver", pointsThreshold: 100 },
        { name: "Gold", code: "gold", pointsThreshold: 500 },
      ];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.AUTO_AWARD_NO_BASE_TIER);
      }
    });

    it("does NOT fire when autoAwardBaseTier is false", () => {
      const spec = validTieredSpec();
      spec.autoAwardBaseTier = false;
      // Leave the base tier in place so dead-tier-no-progression doesn't fire
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });

    // Catch-22 regression guard (WV006): applying AUTO_AWARD's "set
    // autoAwardBaseTier: false" alternative literally must still surface
    // DEAD_TIER — that part is correct — but DEAD_TIER's fix must not loop
    // the user back here.
    it("applying AUTO_AWARD 'disable auto-award' fix surfaces DEAD_TIER with non-looping fix", () => {
      const spec = validTieredSpec();
      spec.tiers = [
        { name: "Silver", code: "silver", pointsThreshold: 100 },
        { name: "Gold", code: "gold", pointsThreshold: 500 },
      ];
      // AUTO_AWARD fires here.
      const before = validateProgramSpec(spec);
      expect(before.ok).toBe(false);
      if (!before.ok) {
        expect(before.violations.map((v) => v.code)).toContain(
          LINTER_RULE_CODES.AUTO_AWARD_NO_BASE_TIER
        );
      }

      // Apply AUTO_AWARD's alternative escape hatch: disable auto-award.
      spec.autoAwardBaseTier = false;
      const after = validateProgramSpec(spec);
      expect(after.ok).toBe(false);
      if (!after.ok) {
        const codes = after.violations.map((v) => v.code);
        // DEAD_TIER should now fire (correctly — non-base tiers + no base + no auto-award).
        expect(codes).toContain(LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION);
        // But its fix must not mention auto-award (would loop back).
        const violation = after.violations.find(
          (v) => v.code === LINTER_RULE_CODES.DEAD_TIER_NO_PROGRESSION
        );
        const fixText = (violation?.fix ?? "").toLowerCase();
        expect(fixText).not.toContain("autoaward");
        expect(fixText).not.toContain("auto-award");
      }
    });
  });

  describe("rule: currency-without-earn-rule", () => {
    it("does NOT fire when a valid template is selected", () => {
      const result = validateProgramSpec(validSpec());
      expect(result.ok).toBe(true);
    });

    it("fires when programCurrency is enabled but awardRule.templateId is empty", () => {
      const spec = validSpec();
      spec.awardRule.templateId = "";
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.CURRENCY_WITHOUT_EARN_RULE);
      }
    });

    it("does NOT fire when programCurrency is disabled", () => {
      const spec = validSpec();
      spec.selectedFeatures.programCurrency = false;
      spec.awardRule.templateId = "";
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });
  });

  describe("rule: event-based-no-event-type", () => {
    it("does NOT fire when event-based program has a fully-defined event type", () => {
      const spec = validSpec();
      spec.selectedFeatures.programType = "event-based";
      spec.eventType = {
        code: "booking-completed",
        name: "Booking Completed",
        dataFields: [{ name: "amount", type: "number", required: true }],
      };
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });

    it("fires when programType is event-based but eventType is missing", () => {
      const spec = validSpec();
      spec.selectedFeatures.programType = "event-based";
      // No eventType set
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.EVENT_BASED_NO_EVENT_TYPE);
      }
    });

    it("does NOT fire for transactional programs with no eventType", () => {
      const spec = validSpec();
      spec.selectedFeatures.programType = "transactional";
      // eventType is undefined — fine for transactional
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });
  });

  describe("rule: tier-code-collision", () => {
    it("does NOT fire when all tier codes are unique", () => {
      const result = validateProgramSpec(validTieredSpec());
      expect(result.ok).toBe(true);
    });

    it("fires on duplicate tier codes", () => {
      const spec = validTieredSpec();
      spec.tiers = [
        { name: "Bronze", code: "tier-a", pointsThreshold: 0 },
        { name: "Silver", code: "tier-a", pointsThreshold: 100 },
      ];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.TIER_CODE_COLLISION);
      }
    });
  });

  describe("rule: tier-threshold-non-ascending", () => {
    it("does NOT fire on strictly ascending thresholds", () => {
      const result = validateProgramSpec(validTieredSpec());
      expect(result.ok).toBe(true);
    });

    it("fires when two tiers share a pointsThreshold", () => {
      const spec = validTieredSpec();
      spec.tiers = [
        { name: "Bronze", code: "bronze", pointsThreshold: 0 },
        { name: "Silver", code: "silver", pointsThreshold: 100 },
        { name: "Gold", code: "gold", pointsThreshold: 100 }, // collision
      ];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.TIER_THRESHOLD_NON_ASCENDING);
      }
    });
  });

  describe("rule: signup-bonus-without-currency", () => {
    it("does NOT fire when programCurrency is enabled with signupBonus", () => {
      const spec = validSpec();
      spec.selectedFeatures.signupBonus = true;
      spec.signupBonusConfig = { bonusPoints: 100 };
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });

    it("fires when signupBonus is enabled but programCurrency is disabled", () => {
      const spec = validSpec();
      spec.selectedFeatures.programCurrency = false;
      spec.selectedFeatures.signupBonus = true;
      // Also need to disable the currency-without-earn-rule from the valid spec
      spec.awardRule.templateId = "";
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.SIGNUP_BONUS_WITHOUT_CURRENCY);
      }
    });
  });

  describe("rule: birthday-bonus-without-currency", () => {
    it("does NOT fire when programCurrency is enabled with birthdayBonus", () => {
      const spec = validSpec();
      spec.selectedFeatures.birthdayBonus = true;
      spec.birthdayBonusConfig = { bonusPoints: 200 };
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });

    it("fires when birthdayBonus is enabled but programCurrency is disabled", () => {
      const spec = validSpec();
      spec.selectedFeatures.programCurrency = false;
      spec.selectedFeatures.birthdayBonus = true;
      spec.awardRule.templateId = "";
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.BIRTHDAY_BONUS_WITHOUT_CURRENCY);
      }
    });
  });

  describe("rule: badge-code-collision", () => {
    it("does NOT fire when all badge codes are unique", () => {
      const result = validateProgramSpec(validBadgedSpec());
      // validBadgedSpec() produces warnings (orphan-badge) but no errors
      expect(result.ok).toBe(true);
    });

    it("fires on duplicate badge codes", () => {
      const spec = validBadgedSpec();
      spec.badges = [
        { name: "First Win", code: "first-win" },
        { name: "Another First", code: "first-win" },
      ] as WizardBadge[];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.BADGE_CODE_COLLISION);
      }
    });
  });

  describe("rule: tiers-enabled-no-tiers", () => {
    it("does NOT fire when tiers are enabled AND populated", () => {
      const result = validateProgramSpec(validTieredSpec());
      expect(result.ok).toBe(true);
    });

    it("fires when tiers feature is on but array is empty", () => {
      const spec = validSpec();
      spec.selectedFeatures.tiers = true;
      spec.tiers = [];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.TIERS_ENABLED_NO_TIERS);
      }
    });
  });

  describe("rule: badges-enabled-no-badges", () => {
    it("does NOT fire when badges are enabled AND populated", () => {
      const result = validateProgramSpec(validBadgedSpec());
      expect(result.ok).toBe(true);
    });

    it("fires when badges feature is on but array is empty", () => {
      const spec = validSpec();
      spec.selectedFeatures.badges = true;
      spec.badges = [];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.BADGES_ENABLED_NO_BADGES);
      }
    });
  });

  describe("rule: orphan-badge (warning-level)", () => {
    it("emits a warning, not an error, for badges not referenced by award rule", () => {
      const spec = validBadgedSpec();
      const result = validateProgramSpec(spec);
      // Orphan-badge is a warning, so ok: true but warnings: [...]
      expect(result.ok).toBe(true);
      if (result.ok) {
        const warningCodes = result.warnings.map((v) => v.code);
        expect(warningCodes).toContain(LINTER_RULE_CODES.ORPHAN_BADGE);
      }
    });

    it("does NOT emit when badge codes appear in the award rule payload", () => {
      const spec = validBadgedSpec();
      // Cheat the check by embedding a badge code in the award rule
      spec.awardRule.rulePayload = {
        ...spec.awardRule.rulePayload,
        // Pretend there's an action referencing the first badge
        description: { en: "Rule that issues first-purchase badge" },
      } as ProgramSpec["awardRule"]["rulePayload"];
      // Remove the other badge so we only assert against one
      spec.badges = [{ name: "First Purchase", code: "first-purchase" }];
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const warningCodes = result.warnings.map((v) => v.code);
        expect(warningCodes).not.toContain(LINTER_RULE_CODES.ORPHAN_BADGE);
      }
    });
  });

  describe("rule: missing-test-customer", () => {
    it("fires when testCustomer is missing AND skipTestRun is unset", () => {
      const spec = validSpec();
      // validSpec() sets skipTestRun: true; flip it to undefined to
      // exercise the "no opt-out, no customer" partial-spec case.
      delete (spec as { skipTestRun?: boolean }).skipTestRun;
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.MISSING_TEST_CUSTOMER);
      }
    });

    it("fires when testCustomer is missing AND skipTestRun is explicitly false", () => {
      const spec = validSpec();
      spec.skipTestRun = false;
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.MISSING_TEST_CUSTOMER);
      }
    });

    it("does NOT fire when skipTestRun is true (testCustomer absent)", () => {
      const spec = validSpec();
      spec.skipTestRun = true;
      // No testCustomer on validSpec() — this is the upload-flow shape.
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });

    it("does NOT fire when testCustomer is present (skipTestRun unset)", () => {
      const spec = validSpec();
      delete (spec as { skipTestRun?: boolean }).skipTestRun;
      spec.testCustomer = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      };
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(true);
    });

    it("treats an empty-string email as missing testCustomer", () => {
      // Defensive: a partial wizard spec might carry testCustomer with
      // empty fields. The rule should still fire so the user gets a
      // clear message instead of the executor running with bad data.
      const spec = validSpec();
      delete (spec as { skipTestRun?: boolean }).skipTestRun;
      spec.testCustomer = { email: "", firstName: "Test", lastName: "User" };
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.MISSING_TEST_CUSTOMER);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Integration tests — validateProgramSpec + validateProgramSpecPartial
  // ────────────────────────────────────────────────────────────────

  describe("validateProgramSpec integration", () => {
    it("returns ok on the canonical valid spec", () => {
      const result = validateProgramSpec(validSpec());
      expect(result.ok).toBe(true);
    });

    it("returns all violations (errors and warnings) when an error is present", () => {
      const spec = validBadgedSpec();
      spec.badges.push({ name: "Dupe", code: "first-purchase" }); // trigger badge collision
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Should include at least the collision error
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.BADGE_CODE_COLLISION);
      }
    });

    it("returns multiple independent violations at once", () => {
      const spec = validSpec();
      spec.selectedFeatures.tiers = true;
      spec.tiers = []; // tiers-enabled-no-tiers
      spec.selectedFeatures.programCurrency = true;
      spec.awardRule.templateId = ""; // currency-without-earn-rule
      const result = validateProgramSpec(spec);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.TIERS_ENABLED_NO_TIERS);
        expect(codes).toContain(LINTER_RULE_CODES.CURRENCY_WITHOUT_EARN_RULE);
      }
    });
  });

  describe("validateProgramSpecPartial", () => {
    it("returns ok on an empty partial (no fields yet)", () => {
      const result = validateProgramSpecPartial({});
      expect(result.ok).toBe(true);
    });

    it("does NOT run FULL_SPEC_RULES (currency-without-earn-rule, event-based-no-event-type)", () => {
      // Partial spec has currency feature on but no award rule — full-spec
      // rules would flag this, but partial should NOT.
      const partial: Partial<ProgramSpec> = {
        selectedFeatures: {
          ...baseFeatures(),
          programCurrency: true,
        },
        tiers: [],
        badges: [],
      };
      const result = validateProgramSpecPartial(partial);
      expect(result.ok).toBe(true);
    });

    it("DOES run PARTIAL_SAFE_RULES (tier code collision even in partial spec)", () => {
      const partial: Partial<ProgramSpec> = {
        selectedFeatures: { ...baseFeatures(), tiers: true },
        tiers: [
          { name: "A", code: "tier-a", pointsThreshold: 0 } as WizardTier,
          { name: "A again", code: "tier-a", pointsThreshold: 100 } as WizardTier,
        ],
      };
      const result = validateProgramSpecPartial(partial);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain(LINTER_RULE_CODES.TIER_CODE_COLLISION);
      }
    });

    it("skips orphan-badge rule gracefully when award rule is absent", () => {
      const partial: Partial<ProgramSpec> = {
        selectedFeatures: { ...baseFeatures(), badges: true },
        badges: [{ name: "First", code: "first" }],
      };
      // Partial has badges but no awardRule. Orphan-badge heuristic should
      // still run but stringify an empty rule — so the badge appears orphan
      // and a warning fires. Verify ok: true and warning is present.
      const result = validateProgramSpecPartial(partial);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const warningCodes = result.warnings.map((v) => v.code);
        expect(warningCodes).toContain(LINTER_RULE_CODES.ORPHAN_BADGE);
      }
    });
  });

  describe("validateProgramSpec — unhydrated option", () => {
    function specMissingTestCustomer(): ProgramSpec {
      const spec = validSpec();
      // Disable the skip-test-run escape that the regular validSpec
      // factory uses. With no test customer AND no skipTestRun, the
      // `missing-test-customer` rule fires under the full ruleset.
      delete spec.skipTestRun;
      delete spec.testCustomer;
      return spec;
    }

    it("includes `missing-test-customer` errors by default (hydrated path)", () => {
      const result = validateProgramSpec(specMissingTestCustomer());
      // Without unhydrated option, the full rule set runs including the
      // missing-test-customer check.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.violations.map((v) => v.code);
        expect(codes).toContain("missing-test-customer");
      }
    });

    it("skips `missing-test-customer` when `unhydrated: true`", () => {
      // Pre-execution callers (preview gates, wizard Create) pass
      // `unhydrated: true` because the executor's hydration adds
      // `skipTestRun: true` later. The Create gate must not block on
      // a rule the executor will resolve anyway.
      const result = validateProgramSpec(specMissingTestCustomer(), { unhydrated: true });
      expect(result.ok).toBe(true);
    });
  });
});
