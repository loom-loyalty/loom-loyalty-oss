/**
 * computePromotionDiff tests.
 *
 * Pre-scan internals are exhaustively tested via the executor's
 * skip-existing test suite (executor.test.ts). These tests focus on
 * the dry-run wrapper specifically:
 *
 *   1. Lint failure short-circuits with no SDK calls
 *   2. Empty target env → wouldCreate populated, conflicts empty
 *   3. Existing matched entities → wouldSkip populated
 *   4. Fatal shape mismatch → conflicts populated
 *   5. computePromotionDiff makes ZERO create calls (the critical
 *      no-side-effects guarantee)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@loom-loyalty/sdk", () => ({
  // Create functions — should NEVER be called by computePromotionDiff
  programManagementCreateProgram: vi.fn(),
  programBankManagementCreateExpiryRule: vi.fn(),
  programBankManagementCreatePendingRule: vi.fn(),
  programBankManagementCreateProgramCurrency: vi.fn(),
  customerStatusManagementCreateTier: vi.fn(),
  customerStatusManagementCreateBadge: vi.fn(),
  eventEngineManagementCreateTarget: vi.fn(),
  eventEngineManagementCreateEventRule: vi.fn(),
  eventEngineManagementCreateEventTypeConfiguration: vi.fn(),
  customerCreateCustomer: vi.fn(),
  eventEnginePublishEvent: vi.fn(),
  metadataManagementCreateMetadata: vi.fn(),
  metadataManagementCreateMetadataType: vi.fn(),
  metadataManagementCreateDataType: vi.fn(),
  dataModelManagementCreateDataModel: vi.fn(),
  dataModelManagementCreateDataModelType: vi.fn(),
  // Get-by-code functions — used by the pre-scan
  programManagementGetProgramByCode: vi.fn(),
  programBankManagementGetProgramCurrencyByCode: vi.fn(),
  customerStatusManagementGetTierByCode: vi.fn(),
  customerStatusManagementGetBadgeByCode: vi.fn(),
  eventEngineManagementGetTargetByCode: vi.fn(),
  eventEngineManagementGetEventRuleByCode: vi.fn(),
  eventEngineManagementGetEventTypeConfigurationByCode: vi.fn(),
  programBankManagementListExpiryRules: vi.fn(),
  programBankManagementListPendingRules: vi.fn(),
}));

import {
  customerCreateCustomer,
  customerStatusManagementCreateBadge,
  customerStatusManagementCreateTier,
  customerStatusManagementGetTierByCode,
  eventEngineManagementCreateEventRule,
  eventEnginePublishEvent,
  programBankManagementCreateProgramCurrency,
  programBankManagementGetProgramCurrencyByCode,
  programManagementCreateProgram,
  programManagementGetProgramByCode,
} from "@loom-loyalty/sdk";
import { computePromotionDiff, type PromotionDiffContext } from "./promotion-diff";
import type { ProgramSpec, SelectedFeatures } from "./spec";

// ────────────────────────────────────────────────────────────────
// Fixtures (same shape as executor.test.ts)
// ────────────────────────────────────────────────────────────────

function ok<T>(data: T) {
  return { data, status: 200 as const, headers: new Headers() };
}

function notFound() {
  return Promise.reject({ statusCode: 404, message: "Not Found" });
}

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

function minimalSpec(): ProgramSpec {
  return {
    selectedFeatures: baseFeatures(),
    program: { code: "test-rewards", name: "Test Rewards", typeCode: "standard" },
    currency: { code: "test-rewards-points", name: "Points", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    metadata: [
      { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "standard", name: "Standard" },
      { category: "DATA_TYPE", typeCode: "CURRENCY_TYPE", code: "points", name: "Points" },
      { category: "DATA_TYPE", typeCode: "COUNTER_TARGET_TYPE", code: "POINTS", name: "Points" },
    ],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 10 },
      rulePayload: { code: "test-rewards-earn", name: "Earn Points" },
    },
    testCustomer: {
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      externalId: "test-ext-1",
    },
  };
}

const ctx: PromotionDiffContext = {
  env: "prod",
  environmentId: "env_prod",
};

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe("computePromotionDiff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset get-by-code mocks (default = unconfigured → returns undefined
    // → caught by tryGetByCode's uncertain-error path → null → "not found")
    vi.mocked(programManagementGetProgramByCode).mockReset();
    vi.mocked(programBankManagementGetProgramCurrencyByCode).mockReset();
    vi.mocked(customerStatusManagementGetTierByCode).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns lint-failed without calling any SDK function on invalid spec", async () => {
    const spec = minimalSpec();
    // Break the spec: enable tiers feature but supply zero tiers (linter
    // catches as 'tiers-enabled-no-tiers').
    spec.selectedFeatures.tiers = true;

    const result = await computePromotionDiff(spec, ctx);

    expect(result.status).toBe("lint-failed");
    if (result.status !== "lint-failed") return;
    expect(result.violations.length).toBeGreaterThan(0);

    // Critical: NO get-by-code call was made — pre-scan never ran.
    expect(programManagementGetProgramByCode).not.toHaveBeenCalled();
    expect(programBankManagementGetProgramCurrencyByCode).not.toHaveBeenCalled();
  });

  it("returns ok with everything in 'created' when target env is empty", async () => {
    // Pre-scan finds nothing (program not found short-circuits the rest)
    vi.mocked(programManagementGetProgramByCode).mockImplementation(
      notFound as unknown as typeof programManagementGetProgramByCode
    );

    const result = await computePromotionDiff(minimalSpec(), ctx);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    // Empty conflicts, empty wouldSkip, populated wouldCreate
    expect(result.conflicts).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.created.length).toBeGreaterThan(0);

    // Program is in the would-create list
    const createdTypes = result.created.map((c) => c.type);
    expect(createdTypes).toContain("program");
  });

  it("returns ok with matched entities in 'skipped'", async () => {
    // Real SDK Program response: type is a nested Metadata object.
    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "standard", name: "Standard", typeCode: "PROGRAM_TYPE" },
        createAccountOnCustomerCreation: true,
      }) as never
    );
    // Real SDK ProgramCurrency shape: currencyType is a nested
    // Metadata object, NOT a flat currencyTypeCode. Must include
    // programIds so the pre-scan's fatal comparison passes.
    vi.mocked(programBankManagementGetProgramCurrencyByCode).mockResolvedValue(
      ok({
        programCurrencyId: "existing_cur",
        code: "test-rewards-points",
        currencyType: { code: "points", name: "Points", typeCode: "CURRENCY_TYPE" },
        programIds: ["existing_pgm"],
      }) as never
    );

    const result = await computePromotionDiff(minimalSpec(), ctx);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.conflicts).toEqual([]);

    const skippedTypes = result.skipped.map((s) => s.type);
    expect(skippedTypes).toContain("program");
    expect(skippedTypes).toContain("currency");
  });

  it("returns ok with conflict-diff entries when fatal shape mismatch is found", async () => {
    // Program exists with divergent type.code (nested Metadata, real SDK shape)
    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "tiered", name: "Tiered", typeCode: "PROGRAM_TYPE" }, // ← spec wants "standard"
        createAccountOnCustomerCreation: true,
      }) as never
    );

    const result = await computePromotionDiff(minimalSpec(), ctx);

    // Note: dry-run returns 'ok' with non-empty conflicts. (The executor
    // returns 'conflict-diff' as a STATUS — but the dry-run is just a
    // report, so its 'ok' status means "the dry-run completed; here's
    // what it found".)
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.conflicts.length).toBeGreaterThan(0);
    const programConflict = result.conflicts.find((c) => c.ref.type === "program");
    expect(programConflict).toBeDefined();
    expect(programConflict?.kind).toBe("shape-diff");
    // Nested path lookup post-schema-alignment: "type.code"
    expect(programConflict?.diff?.fields.some((f) => f.path === "type.code")).toBe(true);
  });

  it("makes ZERO create calls in any scenario (the critical no-side-effects guarantee)", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
    ];
    spec.selectedFeatures.badges = true;
    spec.badges = [{ name: "First", code: "first" }];

    // Mix: program exists, bronze tier exists, others don't.
    // Program response: nested type Metadata (real SDK shape).
    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "standard", name: "Standard", typeCode: "PROGRAM_TYPE" },
        createAccountOnCustomerCreation: true,
      }) as never
    );
    vi.mocked(customerStatusManagementGetTierByCode).mockImplementation((async (code: string) => {
      if (code === "bronze") return ok({ code: "bronze", pointsThreshold: 0 });
      return notFound();
    }) as unknown as typeof customerStatusManagementGetTierByCode);

    const result = await computePromotionDiff(spec, ctx);
    expect(result.status).toBe("ok");

    // The whole point of computePromotionDiff: zero side effects.
    expect(programManagementCreateProgram).not.toHaveBeenCalled();
    expect(programBankManagementCreateProgramCurrency).not.toHaveBeenCalled();
    expect(customerStatusManagementCreateTier).not.toHaveBeenCalled();
    expect(customerStatusManagementCreateBadge).not.toHaveBeenCalled();
    expect(eventEngineManagementCreateEventRule).not.toHaveBeenCalled();
    expect(customerCreateCustomer).not.toHaveBeenCalled();
    expect(eventEnginePublishEvent).not.toHaveBeenCalled();
  });
});
