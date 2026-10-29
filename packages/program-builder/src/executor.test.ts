/**
 * Executor tests — strict replay mode.
 *
 * Strategy:
 * - vi.mock the entire @loom-loyalty/sdk module at the factory level, so
 *   every create* function is a tracked mock we can configure per test.
 * - Each test builds a minimal valid ProgramSpec, runs the executor with
 *   a fake ctx (and optional persist/onProgress callbacks), then asserts
 *   on the result, the mocks called, and the order of calls.
 * - No real HTTP, no real backend, no SDK module state needed.
 *
 * Skip-existing mode tests are deferred to the follow-up commit that
 * implements skip-existing + dry-run API.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as LinterModule from "./linter";

// IMPORTANT: vi.mock must be declared BEFORE the executor import so vitest
// hoists it correctly. The mock factory returns plain vi.fn()s for every
// function the executor imports. Tests configure per-function behavior via
// the exported spies.
vi.mock("@loom-loyalty/sdk", () => ({
  // Value export used by runFiringEvent to target the test customer via
  // query params — must mirror the real SDK's enum-like const object.
  EntityType: { CUSTOMER: "CUSTOMER" },
  // Create functions (used by the stage loop)
  programManagementCreateProgram: vi.fn(),
  programBankManagementCreateExpiryRule: vi.fn(),
  programBankManagementCreatePendingRule: vi.fn(),
  programBankManagementCreateProgramCurrency: vi.fn(),
  customerStatusManagementCreateTier: vi.fn(),
  customerStatusManagementCreateBadge: vi.fn(),
  eventEngineManagementCreateTarget: vi.fn(),
  eventEngineManagementCreateEventRule: vi.fn(),
  eventEngineManagementCreateEventTypeConfiguration: vi.fn(),
  eventEngineManagementCreateEventTypeAction: vi.fn(),
  customerCreateCustomer: vi.fn(),
  eventEnginePublishEvent: vi.fn(),
  metadataManagementCreateMetadata: vi.fn(),
  metadataManagementCreateMetadataType: vi.fn(),
  metadataManagementCreateDataType: vi.fn(),
  dataModelManagementCreateDataModel: vi.fn(),
  dataModelManagementCreateDataModelType: vi.fn(),
  offerManagementCreateOffer: vi.fn(),
  // Get-by-code functions (used by the skip-existing pre-scan)
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

// Linter mock: default behavior delegates to the real implementation. Tests
// that need to simulate a "linter bypassed" scenario (WV006 defense-in-depth)
// override `validateProgramSpec` per test via `vi.mocked(...).mockReturnValue`.
vi.mock("./linter", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof LinterModule;
  return {
    ...actual,
    validateProgramSpec: vi.fn(actual.validateProgramSpec),
  };
});

// Import after vi.mock so the executor sees our mocked SDK.
import {
  customerCreateCustomer,
  customerStatusManagementCreateBadge,
  customerStatusManagementCreateTier,
  customerStatusManagementGetBadgeByCode,
  customerStatusManagementGetTierByCode,
  dataModelManagementCreateDataModel,
  dataModelManagementCreateDataModelType,
  eventEngineManagementCreateEventRule,
  eventEngineManagementCreateEventTypeAction,
  eventEngineManagementCreateEventTypeConfiguration,
  eventEngineManagementCreateTarget,
  eventEngineManagementGetEventRuleByCode,
  eventEngineManagementGetEventTypeConfigurationByCode,
  eventEngineManagementGetTargetByCode,
  eventEnginePublishEvent,
  metadataManagementCreateDataType,
  metadataManagementCreateMetadata,
  metadataManagementCreateMetadataType,
  offerManagementCreateOffer,
  programBankManagementCreateExpiryRule,
  programBankManagementCreatePendingRule,
  programBankManagementCreateProgramCurrency,
  programBankManagementGetProgramCurrencyByCode,
  programBankManagementListExpiryRules,
  programBankManagementListPendingRules,
  programManagementCreateProgram,
  programManagementGetProgramByCode,
} from "@loom-loyalty/sdk";
import {
  buildPromotionAction,
  buildPromotionExpression,
  buildPromotionTargetPayload,
  checkProgramSpec,
  computeActiveStages,
  runProgramExecutor,
} from "./executor";
import { validateProgramSpec } from "./linter";
import type { ProgramSpec, SelectedFeatures } from "./spec";
import type { ExecutionResults, ExecutorContext, ProgressEvent } from "./types";

// ────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────

function ok<T>(data: T) {
  return { data, status: 200 as const, headers: new Headers() };
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

/**
 * Minimal valid spec: explicit metadata + currency + award rule + test
 * customer. The metadata rows model fresh-tenant prerequisites; a
 * COUNTER_TARGET_TYPE row is included so tier-focused tests can opt in
 * without re-declaring the currency fallback. Test customer is required so
 * the dev-env creating-customer stage can run.
 */
function minimalSpec(): ProgramSpec {
  return {
    selectedFeatures: baseFeatures(),
    program: { code: "test-rewards", name: "Test Rewards", typeCode: "standard" },
    currency: { code: "test-rewards-points", name: "Points", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    promotions: [],
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

function devCtx(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    env: "dev",
    environmentId: "env_dev",
    replayMode: "strict",
    ...overrides,
  };
}

function prodCtx(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    env: "prod",
    environmentId: "env_prod",
    replayMode: "strict",
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────
// Mock helpers
// ────────────────────────────────────────────────────────────────

/**
 * Configure every mocked create function to return a default success.
 * Individual tests can override specific mocks afterwards.
 */
function mockAllSuccess() {
  vi.mocked(programManagementCreateProgram).mockResolvedValue(
    ok({ programId: "pgm_1", code: "test-rewards", name: "Test Rewards" }) as never
  );
  vi.mocked(programBankManagementCreateProgramCurrency).mockResolvedValue(
    ok({ programCurrencyId: "cur_1", code: "test-rewards-points" }) as never
  );
  vi.mocked(programBankManagementCreateExpiryRule).mockResolvedValue(
    ok({ expiryRuleId: "exp_1", code: "test-rewards-expiry" }) as never
  );
  vi.mocked(programBankManagementCreatePendingRule).mockResolvedValue(
    ok({ pendingRuleId: "pnd_1", code: "test-rewards-pending" }) as never
  );
  vi.mocked(customerStatusManagementCreateTier).mockImplementation((async (payload: {
    code: string;
  }) => ok({ code: payload.code, tierId: `tier_${payload.code}` })) as never);
  vi.mocked(customerStatusManagementCreateBadge).mockImplementation((async (payload: {
    code: string;
  }) => ok({ badgeId: `badge_${payload.code}`, code: payload.code })) as never);
  vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async (payload: {
    code: string;
  }) => ok({ targetId: `target_${payload.code}`, code: payload.code })) as never);
  vi.mocked(eventEngineManagementCreateEventRule).mockImplementation((async (payload: {
    code?: string;
  }) => ok({ eventRuleId: `rule_${payload.code ?? "unknown"}`, code: payload.code })) as never);
  vi.mocked(eventEngineManagementCreateEventTypeConfiguration).mockResolvedValue(
    ok({ eventTypeConfigurationId: "etc_1" }) as never
  );
  vi.mocked(eventEngineManagementCreateEventTypeAction).mockImplementation((async (payload: {
    eventTypeCode?: string;
  }) => ok({ eventTypeActionId: `eta_${payload.eventTypeCode ?? "unknown"}` })) as never);
  vi.mocked(customerCreateCustomer).mockResolvedValue(
    ok({ customerId: "cus_1", externalId: "test-ext" }) as never
  );
  vi.mocked(eventEnginePublishEvent).mockResolvedValue(
    ok({ eventId: "evt_1", status: "ACCEPTED" }) as never
  );
  vi.mocked(metadataManagementCreateMetadata).mockResolvedValue(ok({}) as never);
  vi.mocked(metadataManagementCreateMetadataType).mockResolvedValue(ok({}) as never);
  vi.mocked(metadataManagementCreateDataType).mockResolvedValue(ok({}) as never);
  vi.mocked(dataModelManagementCreateDataModel).mockResolvedValue(
    ok({ dataModelId: "dm_1" }) as never
  );
  vi.mocked(dataModelManagementCreateDataModelType).mockResolvedValue(ok({}) as never);
  vi.mocked(offerManagementCreateOffer).mockImplementation((async (payload: { code: string }) =>
    ok({ offerId: `offer_${payload.code}`, code: payload.code })) as never);
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe("runProgramExecutor — lint phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("returns lint-failed WITHOUT calling any SDK function when spec is invalid", async () => {
    const spec = minimalSpec();
    // Break the spec: enable tiers feature but supply zero tiers.
    // The linter catches this as 'tiers-enabled-no-tiers'.
    spec.selectedFeatures.tiers = true;

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("lint-failed");
    if (result.status === "lint-failed") {
      expect(result.violations.length).toBeGreaterThan(0);
    }
    // The critical assertion: ZERO API calls.
    expect(programManagementCreateProgram).not.toHaveBeenCalled();
    expect(customerStatusManagementCreateTier).not.toHaveBeenCalled();
    expect(eventEngineManagementCreateEventRule).not.toHaveBeenCalled();
  });

  it("proceeds past lint when spec is valid", async () => {
    const result = await runProgramExecutor(minimalSpec(), devCtx());
    expect(result.status).toBe("success");
  });
});

describe("checkProgramSpec", () => {
  it("accepts a valid spec", () => {
    expect(checkProgramSpec(minimalSpec())).toEqual({ ok: true });
  });

  it("returns the linter's violations, as the executor would", () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;

    const result = checkProgramSpec(spec);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "tiers-enabled-no-tiers")).toBe(true);
    }
  });

  it("reports a structurally malformed spec as spec-shape-invalid", () => {
    const result = checkProgramSpec({ program: "not-an-object" } as unknown as ProgramSpec);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.every((v) => v.code === "spec-shape-invalid")).toBe(true);
    }
  });
});

// NOTE: skip-existing mode tests live in `runProgramExecutor — skip-existing
// replay mode` further below. The earlier "throws not implemented" test was
// removed when the skip-existing implementation landed in M2b.4.

describe("runProgramExecutor — happy path (minimal spec)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("creates program → currency → event-type → award rule → customer → fires event", async () => {
    const result = await runProgramExecutor(minimalSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Entities were created in the right order
    expect(programManagementCreateProgram).toHaveBeenCalledTimes(1);
    expect(programBankManagementCreateProgramCurrency).toHaveBeenCalledTimes(1);
    // Event type creation for transactional programs touches several APIs.
    // (The EVENT_TYPE metadata type itself is seeded by org init — not
    // created by the executor — so it's not asserted here.)
    expect(dataModelManagementCreateDataModelType).toHaveBeenCalled();
    // The transaction parent is required — without it, the platform's generated
    // JSON schema for this data model type has no transaction-shaped fields
    // (eligibleAmount/transactionDateTime/etc.) and additionalProperties:false,
    // so publishing a real transactional event against it is rejected outright.
    expect(dataModelManagementCreateDataModelType).toHaveBeenCalledWith(
      expect.objectContaining({ parentDataModelTypeCode: "transaction" })
    );
    expect(dataModelManagementCreateDataModel).toHaveBeenCalled();
    expect(metadataManagementCreateDataType).toHaveBeenCalled();
    expect(eventEngineManagementCreateEventTypeConfiguration).toHaveBeenCalledTimes(1);
    // Award rule for the template
    expect(eventEngineManagementCreateEventRule).toHaveBeenCalledTimes(1);
    // Customer + test event (dev-env only)
    expect(customerCreateCustomer).toHaveBeenCalledTimes(1);
    expect(eventEnginePublishEvent).toHaveBeenCalledTimes(1);

    // Results populated from responses
    expect(result.results.programId).toBe("pgm_1");
    expect(result.results.programCode).toBe("test-rewards");
    expect(result.results.currencyId).toBe("cur_1");
    expect(result.results.eventRuleId).toMatch(/rule_/);
    expect(result.results.customerId).toBe("cus_1");
    expect(result.results.testEventId).toBe("evt_1");
  });

  it("fires purchase test events as a flat CustomEvent body with the customer targeted via query params", async () => {
    const result = await runProgramExecutor(minimalSpec(), devCtx());

    expect(result.status).toBe("success");
    // transactionId/transactionDateTime and eligibleAmount.amount (not a
    // bare top-level "amount") are real, required elements on the
    // transactional data model (runCreatingEventType) -- a test event
    // shaped any other way either 400s against the platform or silently
    // fails to exercise the eligibleAmount.amount-reading reward rules.
    expect(eventEnginePublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypeCode: "testrewards.purchase",
        description: "Test event for Points per Dollar Spent",
        eligibleAmount: { amount: 50, currencyTypeCode: "USD" },
        transactionId: expect.any(String),
        transactionDateTime: expect.any(String),
        eventDateTime: expect.any(String),
      }),
      { entityType: "CUSTOMER", entityId: "cus_1" }
    );
    const [body] = vi.mocked(eventEnginePublishEvent).mock.calls[0] ?? [];
    expect(body).not.toHaveProperty("eventTarget");
    expect(body).not.toHaveProperty("eventData");
    expect(body).not.toHaveProperty("amount");
  });

  it("populates results.programCode from the SDK response", async () => {
    // Cover the "server normalized the code" path explicitly: the SDK
    // returns a code different from spec.program.code. The executor must
    // prefer the server's value so callers' redirect targets line up
    // with what's actually in the DB.
    vi.mocked(programManagementCreateProgram).mockResolvedValueOnce(
      ok({
        programId: "pgm_normalized",
        code: "normalized-code",
        name: "Test Rewards",
      }) as never
    );
    const result = await runProgramExecutor(minimalSpec(), devCtx());
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.results.programCode).toBe("normalized-code");
    }
  });

  // The skip-existing path (when the executor adopts an existing program
  // from the target env via pre-scan) also sets `results.programCode = code`
  // — see runCreatingProgram in executor.ts. A targeted test for that
  // path requires aligning the full pre-scan mock for currency + tiers
  // + badges + rules so nothing trips conflict-diff. The set of skip-
  // existing tests below ("skip-existing replay mode" describe block)
  // exercises the broader flow; manually inspecting their `result.results`
  // would catch a regression on programCode there. Keeping this brief.

  it("creates explicit metadata records declared on the spec", async () => {
    // Greenfield: the executor only creates metadata that the spec
    // declares explicitly via spec.metadata. Implicit creation from
    // program/currency typeCodes was removed in M3c.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      metadata: [
        { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "standard", name: "Standard" },
        { category: "DATA_TYPE", typeCode: "CURRENCY_TYPE", code: "points", name: "Points" },
      ],
    };

    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");

    const metadataCalls = vi
      .mocked(metadataManagementCreateMetadata)
      .mock.calls.map(([payload]) => payload as { typeCode: string; code: string });

    expect(metadataCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ typeCode: "PROGRAM_TYPE", code: "standard" }),
        expect.objectContaining({ typeCode: "CURRENCY_TYPE", code: "points" }),
      ])
    );
  });

  it("lint-fails before creating program/currency when explicit metadata is required", async () => {
    // Pins the greenfield contract: no implicit creation from
    // program.typeCode + currency.currencyTypeCode.
    const spec = minimalSpec();
    spec.metadata = [];
    const result = await runProgramExecutor(spec, devCtx({ requireExplicitMetadata: true }));
    expect(result.status).toBe("lint-failed");
    expect(metadataManagementCreateMetadata).not.toHaveBeenCalled();
  });

  it("skips customer and firing-event when env is prod (S1.4 rule)", async () => {
    const result = await runProgramExecutor(minimalSpec(), prodCtx());

    expect(result.status).toBe("success");

    expect(customerCreateCustomer).not.toHaveBeenCalled();
    expect(eventEnginePublishEvent).not.toHaveBeenCalled();
    // But the other stages DID run
    expect(programManagementCreateProgram).toHaveBeenCalledTimes(1);
    expect(eventEngineManagementCreateEventRule).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────────
// skipTestRun gating
// ────────────────────────────────────────────────────────────────

describe("runProgramExecutor — skipTestRun gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("skipTestRun=true + dev + NO testCustomer → success, no customer/event calls", async () => {
    // Upload-page flow: no test customer in the markdown, but the user
    // explicitly opted into skipping the test run via spec.skipTestRun.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      skipTestRun: true,
      testCustomer: undefined,
    };

    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");
    expect(customerCreateCustomer).not.toHaveBeenCalled();
    expect(eventEnginePublishEvent).not.toHaveBeenCalled();
    // The rest of the pipeline still ran
    expect(programManagementCreateProgram).toHaveBeenCalledTimes(1);
    expect(eventEngineManagementCreateEventRule).toHaveBeenCalledTimes(1);
  });

  it("skipTestRun unset + NO testCustomer → linter rejects with clear message", async () => {
    // Wizard-style spec where skipTestRun isn't set means "we expect to run
    // a test"; missing testCustomer makes the spec contradictory and the
    // linter must catch it before any SDK call fires.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      testCustomer: undefined,
    };

    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("lint-failed");
    if (result.status !== "lint-failed") return;
    expect(result.violations.some((v) => v.code === "missing-test-customer")).toBe(true);
    // Critical: ZERO SDK calls when the linter rejects.
    expect(programManagementCreateProgram).not.toHaveBeenCalled();
    expect(customerCreateCustomer).not.toHaveBeenCalled();
  });

  it("skipTestRun=false + dev + testCustomer present → runs creating-customer + firing-event", async () => {
    // Wizard's normal path: provides a test customer AND wants the test
    // run to execute. skipTestRun: false makes the intent explicit.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      skipTestRun: false,
    };

    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");
    expect(customerCreateCustomer).toHaveBeenCalledTimes(1);
    expect(eventEnginePublishEvent).toHaveBeenCalledTimes(1);
  });

  it("env=prod skips test stages regardless of skipTestRun (existing S1.4 behavior)", async () => {
    // Even with skipTestRun: false explicitly set, prod must skip — the
    // env-level rule wins.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      skipTestRun: false,
    };

    const result = await runProgramExecutor(spec, prodCtx());
    expect(result.status).toBe("success");
    expect(customerCreateCustomer).not.toHaveBeenCalled();
    expect(eventEnginePublishEvent).not.toHaveBeenCalled();
  });

  it("skipTestRun=true wins over present testCustomer (precedence note in spec.ts)", async () => {
    // Adversarial-reviewer P1: the (testCustomer present + skipTestRun=true)
    // combination must skip the test stages — the explicit opt-out wins.
    // Pin this contract so callers that want to run the test stages know
    // they must leave skipTestRun unset/false. Spec.ts JSDoc documents
    // the precedence; this test guards against a future change that would
    // honor testCustomer when skipTestRun=true.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      skipTestRun: true,
      // testCustomer present from minimalSpec()
    };

    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");
    expect(customerCreateCustomer).not.toHaveBeenCalled();
    expect(eventEnginePublishEvent).not.toHaveBeenCalled();
    // Other stages still ran
    expect(programManagementCreateProgram).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────────
// Explicit metadata creation (M3c row-based semantics)
// ────────────────────────────────────────────────────────────────

describe("runProgramExecutor — spec.metadata creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("creates a metadata TYPE for rows that omit `code`", async () => {
    const spec: ProgramSpec = {
      ...minimalSpec(),
      metadata: [
        ...minimalSpec().metadata,
        {
          category: "DATA_TYPE",
          typeCode: "PROGRAM_TYPE",
          name: "Program Type",
          description: "Classifies a program",
        },
      ],
    };
    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");
    expect(metadataManagementCreateMetadataType).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "DATA_TYPE",
        code: "PROGRAM_TYPE",
        name: "Program Type",
        description: { en: "Classifies a program" },
      })
    );
  });

  it("creates a metadata INSTANCE for rows that include `code`", async () => {
    const spec: ProgramSpec = {
      ...minimalSpec(),
      metadata: [
        ...minimalSpec().metadata,
        { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "retail", name: "Retail" },
      ],
    };
    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");
    expect(metadataManagementCreateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ typeCode: "PROGRAM_TYPE", code: "retail", name: "Retail" })
    );
  });

  it("swallows 409 collisions on metadata create (ignoreIfExists)", async () => {
    vi.mocked(metadataManagementCreateMetadata).mockImplementation((async (payload: {
      typeCode: string;
      code: string;
    }) => {
      if (payload.typeCode === "PROGRAM_TYPE") {
        throw Object.assign(new Error("already exists"), { statusCode: 409, status: 409 });
      }
      return ok({});
    }) as never);
    const spec: ProgramSpec = {
      ...minimalSpec(),
      metadata: [
        ...minimalSpec().metadata,
        { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "standard", name: "Standard" },
      ],
    };
    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");
  });

  it("lint-fails custom program/currency type codes without explicit metadata when requested", async () => {
    const spec = minimalSpec();
    spec.program.typeCode = "premium-tier";
    spec.currency!.currencyTypeCode = "rewards-points";
    const result = await runProgramExecutor(spec, devCtx({ requireExplicitMetadata: true }));
    expect(result.status).toBe("lint-failed");
    expect(metadataManagementCreateMetadata).not.toHaveBeenCalled();
  });
});

describe("runProgramExecutor — feature-gated stages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("creates tiers + tier targets + base-tier rule + progression rules when tiers enabled", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
      { name: "Gold", code: "gold", pointsThreshold: 500 },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");

    // 3 tier creates
    expect(customerStatusManagementCreateTier).toHaveBeenCalledTimes(3);
    // 2 counter targets (one per non-base tier)
    expect(eventEngineManagementCreateTarget).toHaveBeenCalledTimes(2);
    // Event rules: award rule + base-tier rule + 2 progression rules = 4 total
    expect(eventEngineManagementCreateEventRule).toHaveBeenCalledTimes(4);

    if (result.status === "success") {
      expect(result.results.tierCodes).toEqual(["bronze", "silver", "gold"]);
      expect(result.results.targetIds).toHaveLength(2);
      expect(result.results.baseTierRuleId).toBeDefined();
      expect(result.results.tierProgressionRuleIds).toHaveLength(2);
      // tierCodeToTargetId must be populated for resume support
      expect(result.results.tierCodeToTargetId).toBeDefined();
      expect(Object.keys(result.results.tierCodeToTargetId ?? {})).toEqual(["silver", "gold"]);
    }
  });

  it("wires tier targets into award and tier-bonus currency actions", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100, earnMultiplier: 1.5 },
      { name: "Gold", code: "gold", pointsThreshold: 500 },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    const targetIds = ["target_test-rewards-silver-target", "target_test-rewards-gold-target"];
    const currencyActions = vi
      .mocked(eventEngineManagementCreateEventRule)
      .mock.calls.map((call) => {
        const payload = call[0] as {
          eventActionsExpression?: {
            true?: {
              actions?: Array<{ issueProgramCurrency?: { targetIdsToIncrement?: string[] } }>;
            };
          };
        };
        return payload.eventActionsExpression?.true?.actions?.[0]?.issueProgramCurrency;
      })
      .filter((action): action is { targetIdsToIncrement?: string[] } => action !== undefined);

    expect(currencyActions).toHaveLength(2);
    expect(currencyActions.map((action) => action.targetIdsToIncrement)).toEqual([
      targetIds,
      targetIds,
    ]);
  });

  it("wires tier targets into signup-bonus and birthday-bonus currency actions", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
      { name: "Gold", code: "gold", pointsThreshold: 500 },
    ];
    spec.selectedFeatures.signupBonus = true;
    spec.signupBonusConfig = { bonusPoints: 100 };
    spec.selectedFeatures.birthdayBonus = true;
    spec.birthdayBonusConfig = { bonusPoints: 50 };

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    const targetIds = ["target_test-rewards-silver-target", "target_test-rewards-gold-target"];

    // eventTypeCode alone is ambiguous here: autoAwardBaseTier also creates a
    // "Base Tier on Signup" rule (category BASE, issueCustomerTier action) on
    // the same "customer.created" event type as the signup-bonus rule
    // (category ORGANIZATION_DEFINED, issueProgramCurrency action) — filter
    // on the action shape itself, not just the event type.
    function currencyActionFor(eventTypeCode: string) {
      type Payload = {
        eventTypeCode?: string;
        eventActionsExpression?: {
          true?: {
            actions?: Array<{ issueProgramCurrency?: { targetIdsToIncrement?: string[] } }>;
          };
        };
      };
      const call = vi.mocked(eventEngineManagementCreateEventRule).mock.calls.find((c) => {
        const payload = c[0] as Payload;
        return (
          payload.eventTypeCode === eventTypeCode &&
          payload.eventActionsExpression?.true?.actions?.[0]?.issueProgramCurrency !== undefined
        );
      });
      const payload = call?.[0] as Payload | undefined;
      return payload?.eventActionsExpression?.true?.actions?.[0]?.issueProgramCurrency;
    }

    expect(currencyActionFor("customer.created")?.targetIdsToIncrement).toEqual(targetIds);
    expect(currencyActionFor("birthday")?.targetIdsToIncrement).toEqual(targetIds);
  });

  it("sorts tiers ASCENDING by pointsThreshold before creation (rank assignment bug)", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    // Deliberately unsorted — Gold before Silver before Bronze
    spec.tiers = [
      { name: "Gold", code: "gold", pointsThreshold: 500 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
    ];

    await runProgramExecutor(spec, devCtx());

    // createTier calls came in ASCENDING order: bronze rank 1, silver rank 2, gold rank 3
    const tierCalls = vi.mocked(customerStatusManagementCreateTier).mock.calls;
    expect(tierCalls).toHaveLength(3);
    const firstCall = tierCalls[0]?.[0] as unknown as { code: string; rank: number };
    const secondCall = tierCalls[1]?.[0] as unknown as { code: string; rank: number };
    const thirdCall = tierCalls[2]?.[0] as unknown as { code: string; rank: number };
    expect(firstCall.code).toBe("bronze");
    expect(firstCall.rank).toBe(1);
    expect(secondCall.code).toBe("silver");
    expect(secondCall.rank).toBe(2);
    expect(thirdCall.code).toBe("gold");
    expect(thirdCall.rank).toBe(3);
  });

  it("creates badges when badges enabled", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.badges = true;
    spec.badges = [
      { name: "First Purchase", code: "first-purchase" },
      { name: "Loyal Customer", code: "loyal-customer" },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    expect(customerStatusManagementCreateBadge).toHaveBeenCalledTimes(2);

    if (result.status === "success") {
      expect(result.results.badgeIds).toHaveLength(2);
    }
  });

  it("creates expiry rule BEFORE currency when expiry feature enabled", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.expiry = true;
    spec.expiryRule = {
      type: "ROLLING_PERIOD",
      expiryPeriod: "MONTHS",
      expiryPeriodValue: 12,
    };

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    expect(programBankManagementCreateExpiryRule).toHaveBeenCalledTimes(1);
    expect(programBankManagementCreateProgramCurrency).toHaveBeenCalledTimes(1);

    // Check ordering: expiry rule was called before currency
    const expiryCallOrder = vi.mocked(programBankManagementCreateExpiryRule).mock
      .invocationCallOrder[0];
    const currencyCallOrder = vi.mocked(programBankManagementCreateProgramCurrency).mock
      .invocationCallOrder[0];
    expect(expiryCallOrder).toBeDefined();
    expect(currencyCallOrder).toBeDefined();
    expect(expiryCallOrder).toBeLessThan(currencyCallOrder!);

    // And the currency payload includes the expiryRuleId from the previous stage
    const currencyCall = vi.mocked(programBankManagementCreateProgramCurrency).mock
      .calls[0]?.[0] as { expiryRuleId?: string } | undefined;
    expect(currencyCall?.expiryRuleId).toBe("exp_1");
  });

  it("creates signup bonus rule when signupBonus enabled", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.signupBonus = true;
    spec.signupBonusConfig = { bonusPoints: 100 };

    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");

    // Award rule + signup bonus = 2 rules
    expect(eventEngineManagementCreateEventRule).toHaveBeenCalledTimes(2);
    if (result.status === "success") {
      expect(result.results.signupBonusRuleId).toBeDefined();
    }
  });

  // Regression: the birthday chain creates a DataModelType and then references
  // it twice more (the DataModel, and the EVENT_TYPE data type). Those three
  // used to disagree — the type was created as `birthday` while the other two
  // referenced `BIRTHDAY`. Type codes resolve by exact match, so those
  // references miss on any tenant that does not already carry the uppercase
  // spelling. Asserted by comparison rather than against a literal, so the test
  // still catches a divergence if the code itself ever changes.
  it("references one consistent, convention-compliant code across the birthday chain", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.birthdayBonus = true;
    spec.birthdayBonusConfig = { bonusPoints: 50 };

    const result = await runProgramExecutor(spec, devCtx());
    expect(result.status).toBe("success");

    const typeCreate = vi
      .mocked(dataModelManagementCreateDataModelType)
      .mock.calls.map((c) => c[0] as { code?: string; name?: string })
      .find((p) => p.name === "Birthday Event Schema");
    expect(typeCreate, "expected a DataModelType create for the birthday schema").toBeDefined();

    const birthdayCode = typeCreate?.code;
    expect(birthdayCode).toMatch(/^(?=.{1,63}$)[a-z0-9]+(?:-[a-z0-9]+)*$/);

    // The DataModel must hang off the type that was just created.
    expect(dataModelManagementCreateDataModel).toHaveBeenCalledWith(
      expect.objectContaining({ typeCode: birthdayCode })
    );

    // The EVENT_TYPE data type must point at that same DataModel.
    expect(metadataManagementCreateDataType).toHaveBeenCalledWith(
      expect.objectContaining({ typeCode: "EVENT_TYPE", dataModelCode: birthdayCode })
    );
  });
});

// WV006 — defense-in-depth: if the linter is bypassed (e.g. AI-onboarding
// via `execute_program_spec`), the base-tier rule stage must refuse to
// issue a non-base tier on signup rather than silently picking the lowest
// non-base tier (e.g. Silver at threshold 100). The linter's
// AUTO_AWARD_NO_BASE_TIER catches this in practice; this guard is
// belt-and-suspenders.
describe("runProgramExecutor — base-tier rule defense-in-depth (WV006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
    // Default: linter runs for real (vi.mock factory preserved this).
    // Each test overrides as needed.
  });

  it("throws with a descriptive error if the linter is bypassed and no tier has pointsThreshold 0", async () => {
    // Simulate the AI-onboarding path: linter is bypassed and returns ok
    // for a spec that the wizard linter (AUTO_AWARD_NO_BASE_TIER) would
    // have rejected.
    vi.mocked(validateProgramSpec).mockReturnValueOnce({ ok: true, warnings: [] });

    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    // No tier with pointsThreshold === 0 — Silver is the sorted-ascending
    // [0] but it's not a base tier.
    spec.tiers = [
      { name: "Silver", code: "silver", pointsThreshold: 100 },
      { name: "Gold", code: "gold", pointsThreshold: 500 },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.stage).toBe("creating-base-tier-rule");
      // Error message must cite both the threshold value and the tier code
      // so an AI-onboarding operator can debug without re-reading source.
      expect(result.error.message).toContain("pointsThreshold");
      expect(result.error.message).toContain("100");
      expect(result.error.message).toContain("silver");
    }

    // No base-tier rule was created (the stage threw before the API call).
    const ruleCalls = vi.mocked(eventEngineManagementCreateEventRule).mock.calls;
    const baseTierRuleCall = ruleCalls.find((call) => {
      const payload = call[0] as { category?: string } | undefined;
      return payload?.category === "BASE";
    });
    expect(baseTierRuleCall).toBeUndefined();
  });

  it("does NOT throw when a base tier (pointsThreshold 0) is present (happy path)", async () => {
    // Don't override the linter — let it run for real to confirm the
    // assertion is silent on a well-formed spec.
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.results.baseTierRuleId).toBeDefined();
    }

    // The base-tier rule WAS created and it issues "bronze" — the correct tier.
    const ruleCalls = vi.mocked(eventEngineManagementCreateEventRule).mock.calls;
    const baseTierRuleCall = ruleCalls.find((call) => {
      const payload = call[0] as { category?: string } | undefined;
      return payload?.category === "BASE";
    });
    expect(baseTierRuleCall).toBeDefined();
    const payload = baseTierRuleCall?.[0] as unknown as {
      eventActionsExpression: {
        true: { actions: { issueCustomerTier: { tierCode: string } }[] };
      };
    };
    expect(payload.eventActionsExpression.true.actions[0]?.issueCustomerTier.tierCode).toBe(
      "bronze"
    );
  });
});

describe("runProgramExecutor — persist callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("calls persist after EVERY stage transition", async () => {
    const persistCalls: ExecutionResults[] = [];
    const persist = vi.fn(async (partial: ExecutionResults) => {
      persistCalls.push({ ...partial });
    });

    // Declare explicit metadata so creating-metadata runs alongside the
    // other minimal-spec stages.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      metadata: minimalSpec().metadata,
    };
    await runProgramExecutor(spec, devCtx({ persist }));

    // Spec runs: metadata → program → currency → event-type → award rule → customer → firing
    // Each stage that completes should trigger a persist call.
    // That's at least 7 stages -> at least 7 persist calls.
    expect(persist.mock.calls.length).toBeGreaterThanOrEqual(7);

    // The call immediately after creating-program has programId set but
    // no currencyId yet.
    const firstWithProgram = persistCalls.find((c) => c.programId === "pgm_1");
    expect(firstWithProgram).toBeDefined();
    expect(firstWithProgram?.currencyId).toBeUndefined();

    // The LAST persist call should have everything
    const lastCall = persistCalls[persistCalls.length - 1];
    expect(lastCall?.programId).toBe("pgm_1");
    expect(lastCall?.currencyId).toBe("cur_1");
    expect(lastCall?.testEventId).toBe("evt_1");
  });

  it("aborts with fail-closed semantics when persist throws", async () => {
    // Let persist succeed on the first call (after creating-metadata) so
    // creating-program runs and produces programId, then throw on the
    // second call (after creating-program). This verifies the fail-closed
    // abort behavior AND that partialResults reflect work completed
    // before persist failed.
    let persistCallCount = 0;
    const persist = vi.fn(async () => {
      persistCallCount++;
      if (persistCallCount > 1) {
        throw new Error("localStorage quota exceeded");
      }
    });

    const result = await runProgramExecutor(minimalSpec(), devCtx({ persist }));

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.error.message).toContain("Failed to persist partial results");
      // The program WAS created before persist failed, so partialResults has it
      expect(result.partialResults.programId).toBe("pgm_1");
    }
  });

  // P0 fix — correctness reviewer (confidence 0.88) flagged that
  // `persist()` is called AFTER each successful stage but NOT on abort.
  // Combined with the tier-targets Map sync happening only at end-of-
  // function, a mid-stage failure would silently lose every tier target
  // created before the failure from the persisted envelope, breaking
  // resume. The fix syncs results.tierCodeToTargetId INSIDE the loop
  // (belt) and calls ctx.persist() one last time from the main catch
  // (suspenders).
  it("persists partial state on abort — tier-targets mid-loop failure", async () => {
    // Spec with 3 non-base tiers. Silver + Gold create successfully,
    // Platinum throws a 500 (not a 409, so ignoreIfExists rethrows and
    // the stage aborts).
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
      { name: "Gold", code: "gold", pointsThreshold: 500 },
      { name: "Platinum", code: "platinum", pointsThreshold: 2000 },
    ];

    let createTargetCalls = 0;
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async (payload: {
      code: string;
    }) => {
      createTargetCalls++;
      // Silver + Gold succeed, Platinum (call #3) throws.
      if (createTargetCalls >= 3) {
        throw new Error("Simulated 500 on Platinum target create");
      }
      return ok({ targetId: `target_${payload.code}`, code: payload.code });
    }) as never);

    const persistCalls: ExecutionResults[] = [];
    const persist = vi.fn(async (partial: ExecutionResults) => {
      persistCalls.push({ ...partial });
    });

    const result = await runProgramExecutor(spec, devCtx({ persist }));

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.stage).toBe("creating-tier-targets");

      // CRITICAL assertion: partialResults must include the successfully
      // created tier targets (Silver + Gold) BEFORE the Platinum failure.
      // Without the in-loop sync, only whatever was persisted from the
      // last end-of-stage call would be present (an empty Map on fresh
      // run), and the progression rules stage on resume would fail.
      expect(result.partialResults.tierCodeToTargetId).toBeDefined();
      const tcti = result.partialResults.tierCodeToTargetId ?? {};
      expect(Object.keys(tcti).sort()).toEqual(["gold", "silver"]);
      expect(tcti.silver).toMatch(/^target_/);
      expect(tcti.gold).toMatch(/^target_/);

      // AND the partial targetIds array is populated.
      expect(result.partialResults.targetIds).toEqual(
        expect.arrayContaining([tcti.silver, tcti.gold])
      );
    }

    // CRITICAL assertion: the on-abort persist call was made. The last
    // persist call should reflect the latest state including Silver +
    // Gold targets — not the stale state from the last end-of-stage call.
    expect(persist.mock.calls.length).toBeGreaterThan(0);
    const lastPersisted = persistCalls[persistCalls.length - 1];
    expect(lastPersisted?.tierCodeToTargetId).toBeDefined();
    expect(Object.keys(lastPersisted?.tierCodeToTargetId ?? {}).sort()).toEqual(["gold", "silver"]);
  });

  // P0 #2 coverage gap closer: the abort-path persist has a
  // `tierCodeToTargetId.size > 0` guard that skips the Map-to-object
  // sync when no tier targets were created yet. This test exercises
  // the branch — if the tier-targets stage fails BEFORE any target
  // is created, persist must still be called with `tierCodeToTargetId`
  // empty (either absent or an empty object).
  it("persist is still called on abort even when no tier targets were created yet", async () => {
    // Spec with tiers, but the FIRST target create fails. Map size
    // stays 0 → the guard skips the Map-to-object sync but persist
    // still runs unconditionally.
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
    ];

    // First (and only) non-base target create throws a non-409 error
    // (so ignoreIfExists rethrows — no recovery path).
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async () => {
      throw new Error("Simulated 500 on first target create");
    }) as never);

    const persistCalls: ExecutionResults[] = [];
    const persist = vi.fn(async (partial: ExecutionResults) => {
      persistCalls.push({ ...partial });
    });

    const result = await runProgramExecutor(spec, devCtx({ persist }));

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.stage).toBe("creating-tier-targets");
    }

    // The critical assertion: persist WAS called on abort even though
    // tierCodeToTargetId was empty. This covers the `.size > 0` branch.
    expect(persist.mock.calls.length).toBeGreaterThan(0);
    const lastPersisted = persistCalls[persistCalls.length - 1];
    // tierCodeToTargetId is either absent or an empty object — both
    // are acceptable as long as the persist was called.
    expect(
      lastPersisted?.tierCodeToTargetId === undefined ||
        Object.keys(lastPersisted?.tierCodeToTargetId ?? {}).length === 0
    ).toBe(true);
    // But programId should still be persisted — that was captured
    // from an earlier stage.
    expect(lastPersisted?.programId).toBe("pgm_1");
  });

  it("on-abort persist failure is logged but does NOT mask the original error", async () => {
    // Program creation fails (mock returns 500). persist callback also
    // fails when called from the main catch block. The returned error
    // must still reflect the original program-create failure, NOT the
    // persist failure — the user needs to see the real bug, not a
    // cascade from the observability hook.
    vi.mocked(programManagementCreateProgram).mockResolvedValueOnce({
      data: null,
      status: 500,
      headers: new Headers(),
    } as never);

    // Let persist succeed on the first call (after creating-metadata) so
    // creating-program is actually attempted (and fails with the 500
    // above). Subsequent persist calls throw — specifically the on-abort
    // persist call — so we can verify the original creating-program error
    // is preserved and NOT masked by the persist error.
    let persistCallCount = 0;
    const persist = vi.fn(async () => {
      persistCallCount++;
      if (persistCallCount > 1) {
        throw new Error("Persist is broken");
      }
    });

    // Declare an explicit metadata row so creating-metadata runs first
    // and persists once before the creating-program failure triggers
    // the on-abort persist.
    const spec: ProgramSpec = {
      ...minimalSpec(),
      metadata: minimalSpec().metadata,
    };

    const result = await runProgramExecutor(spec, devCtx({ persist }));

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      // Original error — NOT "Persist is broken"
      expect(result.error.message).toContain("Failed to create program");
      expect(result.error.message).not.toContain("Persist is broken");
      expect(result.stage).toBe("creating-program");
    }
    // Persist WAS attempted multiple times (first for metadata success,
    // then on abort after program-create failed).
    expect(persistCallCount).toBeGreaterThan(1);
  });
});

// P0 fix — correctness reviewer (confidence 0.78) + adversarial reviewer
// (confidence 0.9) both flagged that the tier-targets 409 retry path
// silently `continue`d without recording the existing target's ID,
// leading to progression rules without promotionTargetId and broken
// tier advancement for every retry-after-partial-failure flow. The fix
// calls eventEngineManagementGetTargetByCode on 409 to recover the ID.
describe("runProgramExecutor — tier-target 409 retry recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  const tierSpec = () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
      { name: "Gold", code: "gold", pointsThreshold: 500 },
    ];
    return spec;
  };

  it("recovers the existing targetId via get-by-code when create returns 409", async () => {
    // Silver target already exists (409 conflict), Gold is fresh. The
    // get-by-code returns the pre-existing Silver target with targetId
    // "target_silver_existing".
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async (payload: {
      code: string;
    }) => {
      if (payload.code.includes("silver")) {
        // Must match execution-helpers.ts:isExistsError — it scans the
        // error MESSAGE for "409", "already exists", "conflict:",
        // "duplicate key", etc. A bare "Conflict" string without a colon
        // is NOT recognized, so we use the explicit phrase backends
        // typically return.
        throw new Error("409 Conflict: target with that code already exists");
      }
      return ok({ targetId: `target_${payload.code}`, code: payload.code });
    }) as never);

    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      expect(code).toContain("silver");
      // Real SDK shape: CounterTarget has programIds required. Must
      // include the current program's id or the recovery path fails-
      // closed on cross-program contamination (see P1 adversarial
      // review finding). The strict-mode tests use pgm_1 as the
      // program id from programManagementCreateProgram's mock.
      return ok({ targetId: "target_silver_existing", code, programIds: ["pgm_1"] });
    }) as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status === "success") {
      // Silver's existing targetId is recovered and populated into the Map.
      expect(result.results.tierCodeToTargetId?.silver).toBe("target_silver_existing");
      // Gold is freshly created.
      expect(result.results.tierCodeToTargetId?.gold).toMatch(/^target_/);
      // targetIds array includes both.
      expect(result.results.targetIds).toHaveLength(2);
      expect(result.results.targetIds).toContain("target_silver_existing");
    }

    // get-by-code was called for Silver (the 409 path).
    expect(eventEngineManagementGetTargetByCode).toHaveBeenCalledTimes(1);
  });

  it("falls back to counterTargetId if the response lacks targetId", async () => {
    // Some target variants return `counterTargetId` instead of `targetId`.
    // The fix must handle both.
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async () => {
      throw new Error("409 Conflict: target with that code already exists");
    }) as never);

    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({ counterTargetId: `ct_${code}`, code, programIds: ["pgm_1"] });
    }) as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.results.tierCodeToTargetId?.silver).toMatch(/^ct_/);
      expect(result.results.tierCodeToTargetId?.gold).toMatch(/^ct_/);
    }
  });

  it("aborts with a clear error if get-by-code ALSO fails after a 409", async () => {
    // Simulate: target create 409s (exists), but get-by-code returns 500.
    // Fail-closed: the executor must NOT silently drop the tier —
    // progression rules downstream would be broken without the targetId.
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async () => {
      throw new Error("409 Conflict: target with that code already exists");
    }) as never);

    vi.mocked(eventEngineManagementGetTargetByCode).mockResolvedValue({
      data: null,
      status: 500,
      headers: new Headers(),
    } as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.stage).toBe("creating-tier-targets");
      expect(result.error.message).toContain("409 conflict");
      expect(result.error.message).toContain("recovery via get-by-code");
      expect(result.error.message).toContain("status 500");
      // ExecutorError.ref should carry the failing target code.
      expect(result.error.ref?.type).toBe("target");
    }
  });

  it("aborts with a clear error if get-by-code returns a target with no id", async () => {
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async () => {
      throw new Error("409 Conflict: target with that code already exists");
    }) as never);

    // Corner case: the get-by-code response is "successful" (status 200)
    // but the returned object has neither targetId nor counterTargetId.
    // Could happen if the backend returns a partial or transient shape.
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({ code, name: "Silver", programIds: ["pgm_1"] });
    }) as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.stage).toBe("creating-tier-targets");
      expect(result.error.message).toContain("neither targetId nor counterTargetId");
    }
  });

  // P1 fix from adversarial re-review (confidence 0.92): the recovery
  // path MUST assert that the existing target's programIds contains
  // the current program's id before adopting it. Without this check,
  // an orphan target from a deleted program — common in dev envs where
  // programs are torn down but children leak — would be silently bound
  // to the new program, producing cross-program contamination of tier
  // progression rules.
  it("recovery FAILS CLOSED on cross-program contamination (orphan target)", async () => {
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async () => {
      throw new Error("409 Conflict: target with that code already exists");
    }) as never);

    // Orphan target belongs to a DIFFERENT program. Recovery must
    // refuse to adopt it.
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({
        targetId: "orphan_target_xyz",
        code,
        programIds: ["some_other_program_id"],
      });
    }) as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.stage).toBe("creating-tier-targets");
      expect(result.error.message).toContain("not associated with program");
      expect(result.error.message).toContain("cross-program");
      // ExecutorError.ref should carry the failing target code for
      // debug UIs and log scrapers — the outer catch used to clobber
      // this to null. The recovery now wraps in ExecutorError directly.
      expect(result.error.ref).toEqual(
        expect.objectContaining({ type: "target", code: expect.stringContaining("silver") })
      );
    }
  });

  it("recovery FAILS CLOSED when the existing target has no programIds at all", async () => {
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async () => {
      throw new Error("409 Conflict: target with that code already exists");
    }) as never);

    // Missing programIds field entirely (malformed or incomplete response).
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({ targetId: "maybe_existing", code });
    }) as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.error.message).toContain("not associated with program");
    }
  });

  it("classifies a recovered-from-409 target as 'skipped', not 'created'", async () => {
    // UI correctness: if we recovered the ID via get-by-code, the target
    // existed before this run — it should appear in `skipped`, not
    // `created`, so the caller's success screen reflects reality.
    vi.mocked(eventEngineManagementCreateTarget).mockImplementation((async (payload: {
      code: string;
    }) => {
      if (payload.code.includes("silver")) {
        throw new Error("409 Conflict: target with that code already exists");
      }
      return ok({ targetId: `target_${payload.code}`, code: payload.code });
    }) as never);

    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({ targetId: `existing_${code}`, code, programIds: ["pgm_1"] });
    }) as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status === "success") {
      // Silver recovered → in skipped
      const skippedTargetCodes = result.skipped
        .filter((e) => e.type === "target")
        .map((e) => e.code);
      expect(skippedTargetCodes.length).toBeGreaterThan(0);
      const recoveredSilver = skippedTargetCodes.find((c) => c?.includes("silver"));
      expect(recoveredSilver).toBeDefined();

      // Gold freshly created → in created
      const createdTargetCodes = result.created
        .filter((e) => e.type === "target")
        .map((e) => e.code);
      const freshGold = createdTargetCodes.find((c) => c?.includes("gold"));
      expect(freshGold).toBeDefined();
    }
  });
});

describe("runProgramExecutor — tier progression EventTypeConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  const tierSpec = () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
      { name: "Gold", code: "gold", pointsThreshold: 500 },
    ];
    return spec;
  };

  // Publishing an event rule against eventTypeCode "target.achieved" +
  // eventSubTypeIdentifier <targetCode> 500s server-side with "Cannot
  // publish an EventRule without a matching EventTypeConfiguration" unless
  // a matching EventTypeConfiguration was created first — same requirement
  // already honored for the base earning rule's own event type a few
  // hundred lines earlier in executor.ts. Bronze is the base tier
  // (pointsThreshold 0) and has no progression rule; Silver and Gold do.
  it("creates a matching EventTypeConfiguration before publishing each tier's progression rule", async () => {
    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("success");

    // One for the base earning rule's own event type, plus one per
    // non-base tier (Silver, Gold) for their target.achieved progression
    // rule's own EventTypeConfiguration.
    expect(eventEngineManagementCreateEventTypeConfiguration).toHaveBeenCalledTimes(3);
    expect(eventEngineManagementCreateEventTypeConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypeCode: "target.achieved",
        eventSubTypeIdentifier: expect.stringContaining("silver"),
      })
    );
    expect(eventEngineManagementCreateEventTypeConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypeCode: "target.achieved",
        eventSubTypeIdentifier: expect.stringContaining("gold"),
      })
    );
  });

  // The sibling EventTypeConfiguration create a few hundred lines above (the
  // base earning rule's own event type) explicitly checks
  // `configResponse.status === 200 && configResponse.data?.eventTypeConfigurationId`
  // before treating the create as real — a non-200 resolved response (no
  // thrown error, just a malformed/degraded result) doesn't get silently
  // treated as success there. This call site skipped that check entirely.
  it("does not silently proceed to publish a progression rule when the EventTypeConfiguration create resolves non-200", async () => {
    vi.mocked(eventEngineManagementCreateEventTypeConfiguration).mockImplementation(
      (async (payload: { eventSubTypeIdentifier?: string }) => {
        // Base earning rule's own event type still succeeds; only the
        // tier-progression one (has eventSubTypeIdentifier) resolves bad.
        if (payload.eventSubTypeIdentifier) {
          return { data: null, status: 500, headers: new Headers() };
        }
        return ok({ eventTypeConfigurationId: "etc_base" });
      }) as never
    );

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.error.message).toContain("event type configuration");
    }
    expect(eventEngineManagementCreateEventRule).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventTypeCode: "target.achieved" })
    );
  });

  it("creates each tier's EventTypeConfiguration before publishing that tier's progression rule", async () => {
    const configOrder: string[] = [];
    const ruleOrder: string[] = [];
    vi.mocked(eventEngineManagementCreateEventTypeConfiguration).mockImplementation(
      (async (payload: { eventSubTypeIdentifier?: string }) => {
        if (payload.eventSubTypeIdentifier) configOrder.push(payload.eventSubTypeIdentifier);
        return ok({ eventTypeConfigurationId: `etc_${payload.eventSubTypeIdentifier ?? "base"}` });
      }) as never
    );
    vi.mocked(eventEngineManagementCreateEventRule).mockImplementation((async (payload: {
      code?: string;
      eventSubTypeIdentifier?: string;
    }) => {
      if (payload.eventSubTypeIdentifier) ruleOrder.push(payload.eventSubTypeIdentifier);
      return ok({ eventRuleId: `rule_${payload.code ?? "unknown"}`, code: payload.code });
    }) as never);

    const result = await runProgramExecutor(tierSpec(), devCtx());

    expect(result.status).toBe("success");
    // Each tier's EventTypeConfiguration must exist before that tier's
    // progression rule publish is attempted — same targetCode on both
    // sides, config first.
    expect(configOrder).toEqual(ruleOrder);
    expect(configOrder.length).toBeGreaterThan(0);
  });
});

describe("runProgramExecutor — progress events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("emits a 'started' then 'created' progress event per stage", async () => {
    const events: ProgressEvent[] = [];
    await runProgramExecutor(minimalSpec(), devCtx({ onProgress: (e) => events.push(e) }));

    // At least one started and one created per stage
    const startedCount = events.filter((e) => e.action === "started").length;
    const createdCount = events.filter((e) => e.action === "created").length;
    expect(startedCount).toBeGreaterThan(0);
    expect(createdCount).toBeGreaterThan(0);

    // Progress percentages are in 0-100 range and monotonically non-decreasing
    // for started events (created events share the same percent as their started)
    const startedPercents = events.filter((e) => e.action === "started").map((e) => e.percent);
    for (let i = 1; i < startedPercents.length; i++) {
      expect(startedPercents[i]).toBeGreaterThanOrEqual(startedPercents[i - 1]!);
    }
  });

  it("emits an 'errored' progress event when a stage fails", async () => {
    // Break the program creation stage
    vi.mocked(programManagementCreateProgram).mockResolvedValue({
      data: null,
      status: 500,
      headers: new Headers(),
    } as never);

    const events: ProgressEvent[] = [];
    const result = await runProgramExecutor(
      minimalSpec(),
      devCtx({ onProgress: (e) => events.push(e) })
    );

    expect(result.status).toBe("aborted");

    const erroredEvent = events.find((e) => e.action === "errored");
    expect(erroredEvent).toBeDefined();
    expect(erroredEvent?.stage).toBe("creating-program");
  });
});

describe("runProgramExecutor — error path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  it("returns aborted with partialResults when a stage fails mid-run", async () => {
    // Let program creation succeed, but break currency creation
    vi.mocked(programBankManagementCreateProgramCurrency).mockResolvedValue({
      data: null,
      status: 500,
      headers: new Headers(),
    } as never);

    const result = await runProgramExecutor(minimalSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      // Crashed at creating-currency
      expect(result.stage).toBe("creating-currency");
      // Program WAS created before the failure
      expect(result.partialResults.programId).toBe("pgm_1");
      // Currency was NOT created
      expect(result.partialResults.currencyId).toBeUndefined();
    }
  });

  it("propagates backend error messages into ExecutorError.message", async () => {
    vi.mocked(programManagementCreateProgram).mockRejectedValue(
      new Error("Program code already in use")
    );

    const result = await runProgramExecutor(minimalSpec(), devCtx());
    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.error.message).toContain("Program code already in use");
    }
  });
});

describe("computeActiveStages", () => {
  it("includes all default stages for a minimal dev-env spec", () => {
    const stages = computeActiveStages(minimalSpec(), "dev");
    // Program + currency + event-type + award rule + customer + firing
    expect(stages).toContain("creating-program");
    expect(stages).toContain("creating-currency");
    expect(stages).toContain("creating-event-type");
    expect(stages).toContain("creating-award-rule");
    expect(stages).toContain("creating-customer");
    expect(stages).toContain("firing-event");
  });

  it("excludes customer and firing-event in prod env", () => {
    const stages = computeActiveStages(minimalSpec(), "prod");
    expect(stages).not.toContain("creating-customer");
    expect(stages).not.toContain("firing-event");
  });

  it("includes creating-badges only when badges feature is on AND badges are present", () => {
    const spec = minimalSpec();
    expect(computeActiveStages(spec, "dev")).not.toContain("creating-badges");

    spec.selectedFeatures.badges = true;
    expect(computeActiveStages(spec, "dev")).not.toContain("creating-badges");

    spec.badges = [{ name: "First", code: "first" }];
    expect(computeActiveStages(spec, "dev")).toContain("creating-badges");
  });

  it("includes creating-metadata when spec.metadata declares any rows", () => {
    const spec: ProgramSpec = {
      ...minimalSpec(),
      metadata: [
        { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "standard", name: "Standard" },
      ],
    };
    expect(computeActiveStages(spec, "dev")).toContain("creating-metadata");
  });

  it("excludes creating-metadata when no spec.metadata, no badges, no tier progression", () => {
    // The executor stages metadata only for explicitly declared rows and
    // feature obligations. This pure stage-selection test intentionally
    // omits the otherwise-required fresh-tenant metadata.
    const spec = minimalSpec();
    spec.metadata = [];
    expect(computeActiveStages(spec, "dev")).not.toContain("creating-metadata");
  });

  it("includes creating-base-tier-rule only when tiers enabled AND autoAwardBaseTier true", () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
    ];

    spec.autoAwardBaseTier = false;
    expect(computeActiveStages(spec, "dev")).not.toContain("creating-base-tier-rule");

    spec.autoAwardBaseTier = true;
    expect(computeActiveStages(spec, "dev")).toContain("creating-base-tier-rule");
  });
});

// ────────────────────────────────────────────────────────────────
// Skip-existing replay mode
// ────────────────────────────────────────────────────────────────
//
// Pre-scan fetches entities by code before any creates. For every entity
// the pre-scan finds:
//   - Shape matches → skip, pull the ID from the existing entity
//   - Shape diverges on a fatal field → accumulate in conflicts[]
//   - Not found (404 or uncertain error) → create normally
//
// Tests configure specific get-by-code mocks to simulate existing
// entities. Unconfigured mocks return undefined → tryGetByCode's catch
// path → null → treated as "not found".

describe("runProgramExecutor — skip-existing replay mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
    // Reset get-by-code mocks to undefined (→ "not found" via uncertain path)
    vi.mocked(programManagementGetProgramByCode).mockReset();
    vi.mocked(programBankManagementGetProgramCurrencyByCode).mockReset();
    vi.mocked(customerStatusManagementGetTierByCode).mockReset();
    vi.mocked(customerStatusManagementGetBadgeByCode).mockReset();
    vi.mocked(eventEngineManagementGetTargetByCode).mockReset();
    vi.mocked(eventEngineManagementGetEventRuleByCode).mockReset();
    vi.mocked(eventEngineManagementGetEventTypeConfigurationByCode).mockReset();
    vi.mocked(programBankManagementListExpiryRules).mockReset();
    vi.mocked(programBankManagementListPendingRules).mockReset();
  });

  function notFound() {
    // sdkFetch throws on non-ok responses — simulate by rejecting with
    // a plain object that has { statusCode: 404 }, matching the real
    // ApiError shape the pre-scan's isNotFoundError checks for.
    return Promise.reject({ statusCode: 404, message: "Not Found" });
  }

  function devSkipExistingCtx(): ExecutorContext {
    return {
      env: "dev",
      environmentId: "env_dev",
      replayMode: "skip-existing",
    };
  }

  it("behaves like strict when the target env has nothing (pre-scan sees no program)", async () => {
    vi.mocked(programManagementGetProgramByCode).mockImplementation(
      notFound as unknown as typeof programManagementGetProgramByCode
    );

    const result = await runProgramExecutor(minimalSpec(), devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Pre-scan short-circuits when the program isn't found, so children
    // aren't fetched — program was queried once, other entities not at all.
    expect(programManagementGetProgramByCode).toHaveBeenCalledTimes(1);
    expect(programBankManagementGetProgramCurrencyByCode).not.toHaveBeenCalled();
    expect(customerStatusManagementGetTierByCode).not.toHaveBeenCalled();

    // All entities created normally (same as strict mode)
    expect(programManagementCreateProgram).toHaveBeenCalledTimes(1);
    expect(programBankManagementCreateProgramCurrency).toHaveBeenCalledTimes(1);
    expect(result.skipped).toEqual([]);
    expect(result.created.length).toBeGreaterThan(0);
  });

  it("skips program + currency when both exist with matching shape", async () => {
    // Program exists with matching type.code (nested Metadata, real SDK shape).
    // SCHEMA ALIGNMENT: the SDK's Program.type is a nested Metadata
    // object, NOT a flat typeCode. Fixtures must mirror the real
    // response shape.
    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "standard", name: "Standard", typeCode: "PROGRAM_TYPE" },
        name: "Test Rewards",
        createAccountOnCustomerCreation: true,
      }) as never
    );
    // Currency exists with matching currencyType (nested Metadata, real SDK shape).
    // SCHEMA ALIGNMENT post-M3 correctness review: the SDK's ProgramCurrency
    // returns `currencyType: Metadata`, NOT `currencyTypeCode`. Fixtures
    // must mirror the real response shape or the shape-diff false-positive
    // flags every existing entity as conflict-diff.
    vi.mocked(programBankManagementGetProgramCurrencyByCode).mockResolvedValue(
      ok({
        programCurrencyId: "existing_cur",
        code: "test-rewards-points",
        currencyType: { code: "points", name: "Points", typeCode: "CURRENCY_TYPE" },
        programIds: ["existing_pgm"],
        name: "Points",
      }) as never
    );

    const result = await runProgramExecutor(minimalSpec(), devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Neither program nor currency were re-created
    expect(programManagementCreateProgram).not.toHaveBeenCalled();
    expect(programBankManagementCreateProgramCurrency).not.toHaveBeenCalled();

    // Both show up in skipped[] with their EXISTING IDs from the pre-scan
    const skippedTypes = result.skipped.map((s) => s.type);
    expect(skippedTypes).toContain("program");
    expect(skippedTypes).toContain("currency");

    // Results carry the existing IDs forward so downstream stages
    // (award rule, customer, event firing) use them.
    expect(result.results.programId).toBe("existing_pgm");
    expect(result.results.currencyId).toBe("existing_cur");
    // programCode must be populated on the skip-existing path too —
    // upload-page reads it for the post-success redirect; a regression
    // that drops it would silently 404 redirects for adopted programs.
    expect(result.results.programCode).toBe("test-rewards");
  });

  it("returns conflict-diff WITHOUT any creates when a fatal shape mismatch is found", async () => {
    // Program exists but with a DIVERGENT type.code ("tiered" vs spec's "standard")
    // Uses real SDK Program response shape (nested type: Metadata).
    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "tiered", name: "Tiered", typeCode: "PROGRAM_TYPE" }, // ← fatal mismatch
        name: "Test Rewards",
        createAccountOnCustomerCreation: true,
      }) as never
    );

    const result = await runProgramExecutor(minimalSpec(), devSkipExistingCtx());

    expect(result.status).toBe("conflict-diff");
    if (result.status !== "conflict-diff") return;

    // At least the program conflict is present
    const conflictTypes = result.conflicts.map((c) => c.ref.type);
    expect(conflictTypes).toContain("program");

    // Inspect the diff — should flag the type.code field as fatal
    // (nested path lookup after schema alignment).
    const programConflict = result.conflicts.find((c) => c.ref.type === "program");
    expect(programConflict?.kind).toBe("shape-diff");
    expect(programConflict?.diff?.fields.some((f) => f.path === "type.code")).toBe(true);

    // CRITICAL: zero creates were made
    expect(programManagementCreateProgram).not.toHaveBeenCalled();
    expect(programBankManagementCreateProgramCurrency).not.toHaveBeenCalled();
    expect(eventEngineManagementCreateEventRule).not.toHaveBeenCalled();
    expect(customerCreateCustomer).not.toHaveBeenCalled();
  });

  it("mixed case: creates some, skips some, when only SOME entities exist", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 },
    ];

    // Program exists with matching shape (nested type, real SDK shape)
    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "standard", name: "Standard", typeCode: "PROGRAM_TYPE" },
        createAccountOnCustomerCreation: true,
      }) as never
    );
    // Currency exists with matching shape (nested currencyType, real SDK shape)
    vi.mocked(programBankManagementGetProgramCurrencyByCode).mockResolvedValue(
      ok({
        programCurrencyId: "existing_cur",
        code: "test-rewards-points",
        currencyType: { code: "points", name: "Points", typeCode: "CURRENCY_TYPE" },
        programIds: ["existing_pgm"],
      }) as never
    );
    // Bronze tier exists; Silver does not. Tier response shape follows
    // the real SDK Tier interface — NO pointsThreshold field (the
    // threshold lives only on the wizard-side WizardTier as a proxy
    // for the CounterTarget's targetValue).
    vi.mocked(customerStatusManagementGetTierByCode).mockImplementation((async (code: string) => {
      if (code === "bronze") {
        return ok({ code: "bronze", name: "Bronze", rank: 1, programIds: ["existing_pgm"] });
      }
      return notFound();
    }) as unknown as typeof customerStatusManagementGetTierByCode);

    const result = await runProgramExecutor(spec, devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Program NOT re-created (was skipped)
    expect(programManagementCreateProgram).not.toHaveBeenCalled();
    // Currency NOT re-created
    expect(programBankManagementCreateProgramCurrency).not.toHaveBeenCalled();
    // Tier creations: only silver, not bronze
    expect(customerStatusManagementCreateTier).toHaveBeenCalledTimes(1);
    const tierCall = vi.mocked(customerStatusManagementCreateTier).mock.calls[0]?.[0] as {
      code: string;
    };
    expect(tierCall.code).toBe("silver");

    // Results reflect both the skipped and created entities
    const skippedCodes = result.skipped.map((s) => `${s.type}:${s.code}`);
    expect(skippedCodes).toContain("program:test-rewards");
    expect(skippedCodes).toContain("currency:test-rewards-points");
    expect(skippedCodes).toContain("tier:bronze");

    const createdCodes = result.created.map((c) => `${c.type}:${c.code}`);
    expect(createdCodes).toContain("tier:silver");
  });

  // SCHEMA ALIGNMENT post-M3 correctness review: the SDK's Tier
  // interface has NO threshold field, so a tier-level "pointsThreshold
  // mismatch" is impossible — the threshold exists only in the
  // wizard's WizardTier spec as a proxy for the downstream
  // CounterTarget's targetValue. The fatal identity check for tier
  // progression therefore lives on the CounterTarget, not on the Tier
  // itself. This test covers that: an existing target with a
  // divergent targetValue is flagged as a fatal conflict.
  it("pre-scan's tier-target mismatch on targetValue is fatal (tier-level diff is cosmetic)", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100 }, // spec wants 100
    ];

    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "standard", name: "Standard", typeCode: "PROGRAM_TYPE" },
        createAccountOnCustomerCreation: true,
      }) as never
    );
    // Tier responses use real SDK Tier shape (no threshold field).
    vi.mocked(customerStatusManagementGetTierByCode).mockImplementation((async (code: string) => {
      return ok({ code, name: code, rank: 1, programIds: ["existing_pgm"] });
    }) as unknown as typeof customerStatusManagementGetTierByCode);
    // Silver's CounterTarget exists but with targetValue 500 (≠ spec's 100).
    // CounterTarget response uses nested counterTargetType (real SDK shape).
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      if (code.includes("silver")) {
        return ok({
          code,
          type: "COUNTER",
          programIds: ["existing_pgm"],
          counterTargetType: { code: "POINTS", name: "Points", typeCode: "COUNTER_TARGET_TYPE" },
          targetValue: 500, // ← fatal mismatch with spec's 100
          name: "Silver Progression Target",
          targetId: "existing_target_silver",
        });
      }
      return notFound();
    }) as unknown as typeof eventEngineManagementGetTargetByCode);

    const result = await runProgramExecutor(spec, devSkipExistingCtx());

    expect(result.status).toBe("conflict-diff");
    if (result.status !== "conflict-diff") return;

    // The fatal conflict is on the TARGET, not the tier.
    const targetConflict = result.conflicts.find((c) => c.ref.type === "target");
    expect(targetConflict).toBeDefined();
    expect(targetConflict?.diff?.fields.some((f) => f.path === "targetValue")).toBe(true);

    // Still zero creates
    expect(programManagementCreateProgram).not.toHaveBeenCalled();
    expect(customerStatusManagementCreateTier).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────
  // Pre-scan extension: tier-bonus rules + promotion entities (PR #496)
  // ────────────────────────────────────────────────────────────────
  //
  // Pre-PR-#496, runCreatingTierBonusRules halted with a 409 on retry
  // because the stage's wrapApiCall re-raised. runCreatingPromotions
  // swallowed 409s via ignoreIfExists but left promoSummary.eventRuleIds
  // empty, so downstream tools couldn't tell what landed. These tests
  // lock in the new behaviour: pre-scan classifies the entities, the
  // executor's checkSkipExisting picks them up, and IDs flow through.

  function bonusTierSpec(): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      // earnMultiplier > 1.0 → tier-bonus rule code derives from generateCode
      { name: "Silver", code: "silver", pointsThreshold: 100, earnMultiplier: 1.5 },
    ];
    return spec;
  }

  function promotionSpec(): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.promotions = true;
    spec.promotions = [
      {
        code: "card-reload",
        name: "Card Reload Bonus",
        eventType: { code: "card_reload", name: "Card Reload" },
        targets: [
          {
            kind: "COUNTER",
            config: { counterTargetTypeCode: "RELOAD_AMOUNT", targetValue: 30 },
          },
        ],
        eventRules: [
          {
            award: { type: "FLAT_POINTS", value: 10 },
            conditions: { equalsPath: "$.eventData.tier", equalsValue: "RELOAD_30" },
          },
        ],
      },
    ];
    return spec;
  }

  // Program-and-currency response stubs reused across the new tests.
  function stubExistingProgram() {
    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "standard", name: "Standard", typeCode: "PROGRAM_TYPE" },
        name: "Test Rewards",
        createAccountOnCustomerCreation: true,
      }) as never
    );
    vi.mocked(programBankManagementGetProgramCurrencyByCode).mockResolvedValue(
      ok({
        programCurrencyId: "existing_cur",
        code: "test-rewards-points",
        currencyType: { code: "points", name: "Points", typeCode: "CURRENCY_TYPE" },
        programIds: ["existing_pgm"],
        name: "Points",
      }) as never
    );
  }

  it("skips a tier-bonus rule when pre-scan finds it by code", async () => {
    stubExistingProgram();
    // Both tiers exist with matching shape. Rank reflects the sorted
    // pointsThreshold ascending: Bronze=1 (threshold 0), Silver=2 (100).
    vi.mocked(customerStatusManagementGetTierByCode).mockImplementation((async (code: string) => {
      if (code === "bronze") {
        return ok({ code, name: "Bronze", rank: 1, programIds: ["existing_pgm"] });
      }
      if (code === "silver") {
        return ok({ code, name: "Silver", rank: 2, programIds: ["existing_pgm"] });
      }
      return notFound();
    }) as unknown as typeof customerStatusManagementGetTierByCode);
    // Silver's counter target (for tier progression) exists with matching shape.
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({
        code,
        type: "COUNTER",
        programIds: ["existing_pgm"],
        counterTargetType: { code: "POINTS", name: "Points", typeCode: "COUNTER_TARGET_TYPE" },
        targetValue: 100,
        name: "Silver Progression Target",
        targetId: `existing_target_${code}`,
      });
    }) as unknown as typeof eventEngineManagementGetTargetByCode);
    // ALL event rules pre-exist. The new tier-bonus code lookups (Silver's
    // multiplier rule) return existing IDs so the executor's stage skip
    // hits without ever calling create.
    vi.mocked(eventEngineManagementGetEventRuleByCode).mockImplementation((async (code: string) => {
      return ok({ eventRuleId: `existing_rule_${code}`, code });
    }) as unknown as typeof eventEngineManagementGetEventRuleByCode);

    const result = await runProgramExecutor(bonusTierSpec(), devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // The tier-bonus rule was NOT re-created — every event-rule create call
    // would have hit a stage halt previously. Now pre-scan absorbs them.
    const tierBonusCreates = vi
      .mocked(eventEngineManagementCreateEventRule)
      .mock.calls.filter((args) => {
        const payload = args[0] as { code?: string } | undefined;
        return payload?.code?.includes("silver-multiplier") === true;
      });
    expect(tierBonusCreates).toHaveLength(0);

    // The Silver multiplier rule is in skipped[] with its existing ID.
    const silverBonus = result.skipped.find((s) => s.code?.includes("silver-multiplier"));
    expect(silverBonus?.type).toBe("eventRule");
    expect(silverBonus?.id).toMatch(/^existing_rule_/);
  });

  it("skips a promotion event rule when pre-scan finds it by code", async () => {
    stubExistingProgram();
    // Counter target for the promotion exists (so we don't dispatch a target create).
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({
        code,
        type: "COUNTER",
        programIds: ["existing_pgm"],
        counterTargetType: {
          code: "RELOAD_AMOUNT",
          name: "Reload Amount",
          typeCode: "COUNTER_TARGET_TYPE",
        },
        targetValue: 30,
        targetId: `existing_target_${code}`,
      });
    }) as unknown as typeof eventEngineManagementGetTargetByCode);
    // Promotion's event rule exists.
    vi.mocked(eventEngineManagementGetEventRuleByCode).mockImplementation((async (code: string) => {
      return ok({ eventRuleId: `existing_rule_${code}`, code });
    }) as unknown as typeof eventEngineManagementGetEventRuleByCode);
    // Event type configuration for the promotion exists, so the executor
    // skips the create chain (data model + EVENT_TYPE + config).
    vi.mocked(eventEngineManagementGetEventTypeConfigurationByCode).mockImplementation((async (
      code: string
    ) => {
      return ok({
        code,
        eventTypeCode: code,
        eventTypeConfigurationId: `existing_etc_${code}`,
        name: "Card Reload",
      });
    }) as unknown as typeof eventEngineManagementGetEventTypeConfigurationByCode);

    const result = await runProgramExecutor(promotionSpec(), devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Promotion event rule was NOT re-created.
    const promoRuleCreates = vi
      .mocked(eventEngineManagementCreateEventRule)
      .mock.calls.filter((args) => {
        const payload = args[0] as { code?: string } | undefined;
        return payload?.code?.includes("card-reload-rule-0") === true;
      });
    expect(promoRuleCreates).toHaveLength(0);

    // Promotion summary carries the existing rule ID.
    expect(result.results.promotions?.[0]?.eventRuleIds[0]).toMatch(/^existing_rule_/);
  });

  it("skips a promotion target when pre-scan finds it by code", async () => {
    stubExistingProgram();
    // Counter target for the promotion exists.
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation((async (code: string) => {
      return ok({
        code,
        type: "COUNTER",
        programIds: ["existing_pgm"],
        counterTargetType: {
          code: "RELOAD_AMOUNT",
          name: "Reload Amount",
          typeCode: "COUNTER_TARGET_TYPE",
        },
        targetValue: 30,
        targetId: `existing_target_${code}`,
      });
    }) as unknown as typeof eventEngineManagementGetTargetByCode);
    // Event rule doesn't exist (so the promotion still creates a rule).
    vi.mocked(eventEngineManagementGetEventRuleByCode).mockImplementation(
      notFound as unknown as typeof eventEngineManagementGetEventRuleByCode
    );
    vi.mocked(eventEngineManagementGetEventTypeConfigurationByCode).mockImplementation(
      notFound as unknown as typeof eventEngineManagementGetEventTypeConfigurationByCode
    );

    const result = await runProgramExecutor(promotionSpec(), devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Counter target for the promotion was NOT re-created.
    const targetCreates = vi.mocked(eventEngineManagementCreateTarget).mock.calls.filter((args) => {
      const payload = args[0] as { code?: string } | undefined;
      return payload?.code?.includes("card-reload-target-0") === true;
    });
    expect(targetCreates).toHaveLength(0);

    // Promotion summary carries the existing target ID.
    expect(result.results.promotions?.[0]?.targetIds[0]).toMatch(/^existing_target_/);
  });

  it("skips the promotion event type config create-chain when pre-scan finds the config", async () => {
    stubExistingProgram();
    vi.mocked(eventEngineManagementGetTargetByCode).mockImplementation(
      notFound as unknown as typeof eventEngineManagementGetTargetByCode
    );
    vi.mocked(eventEngineManagementGetEventRuleByCode).mockImplementation(
      notFound as unknown as typeof eventEngineManagementGetEventRuleByCode
    );
    // Existing promotion event type configuration → skip the entire
    // dataModel/EVENT_TYPE/config create chain on rerun.
    vi.mocked(eventEngineManagementGetEventTypeConfigurationByCode).mockImplementation((async (
      code: string
    ) => {
      return ok({
        code,
        eventTypeCode: code,
        eventTypeConfigurationId: `existing_etc_${code}`,
        name: "Card Reload",
      });
    }) as unknown as typeof eventEngineManagementGetEventTypeConfigurationByCode);

    const result = await runProgramExecutor(promotionSpec(), devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // None of the promotion's data-model / EVENT_TYPE / config chain ran.
    // (The base earn rule's event type chain still runs for the spec's
    // configured awardRule, so we filter to promotion-scoped codes.)
    const promoEventTypeCreates = vi
      .mocked(eventEngineManagementCreateEventTypeConfiguration)
      .mock.calls.filter((args) => {
        const payload = args[0] as { code?: string } | undefined;
        return payload?.code === "testrewards.card.reload";
      });
    expect(promoEventTypeCreates).toHaveLength(0);

    // Promotion summary carries the eventTypeId from the existing config.
    expect(result.results.promotions?.[0]?.eventTypeId).toBe(
      "existing_etc_testrewards.card.reload"
    );
  });

  it("skips badges per-badge when the badge exists with matching shape", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.badges = true;
    spec.badges = [
      { name: "First Purchase", code: "first-purchase" },
      { name: "Loyal Customer", code: "loyal-customer" },
    ];

    vi.mocked(programManagementGetProgramByCode).mockResolvedValue(
      ok({
        programId: "existing_pgm",
        code: "test-rewards",
        type: { code: "standard", name: "Standard", typeCode: "PROGRAM_TYPE" },
        createAccountOnCustomerCreation: true,
      }) as never
    );
    // first-purchase exists; loyal-customer does not. Badge response
    // includes programIds per real SDK Badge shape — the pre-scan's
    // fatal identity check is on programIds, so omitting it would
    // produce a false-positive conflict.
    vi.mocked(customerStatusManagementGetBadgeByCode).mockImplementation((async (code: string) => {
      if (code === "first-purchase") {
        return ok({
          badgeId: "existing_badge_first",
          code: "first-purchase",
          name: "First Purchase",
          programIds: ["existing_pgm"],
        });
      }
      return notFound();
    }) as unknown as typeof customerStatusManagementGetBadgeByCode);

    const result = await runProgramExecutor(spec, devSkipExistingCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Only loyal-customer was created
    expect(customerStatusManagementCreateBadge).toHaveBeenCalledTimes(1);

    // first-purchase is in skipped; loyal-customer is in created
    const skipped = result.skipped.find((s) => s.code === "first-purchase");
    expect(skipped?.type).toBe("badge");
    expect(skipped?.id).toBe("existing_badge_first");

    const created = result.created.find((c) => c.code === "loyal-customer");
    expect(created?.type).toBe("badge");
  });
});

describe("buildPromotionTargetPayload", () => {
  const programId = "pgm_1";
  const targetCode = "coffee-loyalty-punch-card-target-0";
  const targetName = "Punch Card Reward Target 1";

  describe("COMPLETION", () => {
    it("returns a payload when completionTargetTypeCode is present", () => {
      const result = buildPromotionTargetPayload(
        {
          kind: "COMPLETION",
          config: { completionTargetTypeCode: "FIRST_PURCHASE" },
        },
        programId,
        targetCode,
        targetName
      );
      expect("payload" in result).toBe(true);
      if (!("payload" in result)) return;
      expect(result.payload).toMatchObject({
        type: "COMPLETION",
        completionTargetTypeCode: "FIRST_PURCHASE",
        code: targetCode,
        name: targetName,
        programIds: [programId],
      });
    });

    it("skips when completionTargetTypeCode is missing", () => {
      const result = buildPromotionTargetPayload(
        { kind: "COMPLETION", config: {} },
        programId,
        targetCode,
        targetName
      );
      expect("skipped" in result).toBe(true);
      if (!("skipped" in result)) return;
      expect(result.skipped).toContain("completionTargetTypeCode");
    });
  });

  describe("COUNTER", () => {
    it("returns a payload with the supplied targetValue", () => {
      const result = buildPromotionTargetPayload(
        {
          kind: "COUNTER",
          config: { counterTargetTypeCode: "QUALIFYING_PURCHASES", targetValue: 5 },
        },
        programId,
        targetCode,
        targetName
      );
      expect("payload" in result).toBe(true);
      if (!("payload" in result)) return;
      expect(result.payload).toMatchObject({
        type: "COUNTER",
        counterTargetTypeCode: "QUALIFYING_PURCHASES",
        targetValue: 5,
      });
    });

    it("defaults targetValue to 1 when omitted", () => {
      const result = buildPromotionTargetPayload(
        { kind: "COUNTER", config: { counterTargetTypeCode: "VISITS" } },
        programId,
        targetCode,
        targetName
      );
      if (!("payload" in result)) throw new Error("expected payload");
      expect((result.payload as { targetValue: number }).targetValue).toBe(1);
    });

    it("skips when counterTargetTypeCode is missing", () => {
      const result = buildPromotionTargetPayload(
        { kind: "COUNTER", config: {} },
        programId,
        targetCode,
        targetName
      );
      expect("skipped" in result).toBe(true);
      if (!("skipped" in result)) return;
      expect(result.skipped).toContain("counterTargetTypeCode");
    });
  });

  describe("MILESTONE", () => {
    it("returns a payload when typeCode and items[] are present", () => {
      const items = [{ rank: 1, points: 100 }];
      const result = buildPromotionTargetPayload(
        {
          kind: "MILESTONE",
          config: { milestoneTargetTypeCode: "PUNCH_LEVEL", items },
        },
        programId,
        targetCode,
        targetName
      );
      if (!("payload" in result)) throw new Error("expected payload");
      expect(result.payload).toMatchObject({
        type: "MILESTONE",
        milestoneTargetTypeCode: "PUNCH_LEVEL",
        items,
      });
    });

    it("skips when items[] is missing", () => {
      const result = buildPromotionTargetPayload(
        { kind: "MILESTONE", config: { milestoneTargetTypeCode: "X" } },
        programId,
        targetCode,
        targetName
      );
      if (!("skipped" in result)) throw new Error("expected skip");
      expect(result.skipped).toContain("items[]");
    });

    it("skips when milestoneTargetTypeCode is missing", () => {
      const result = buildPromotionTargetPayload(
        { kind: "MILESTONE", config: { items: [{}] } },
        programId,
        targetCode,
        targetName
      );
      if (!("skipped" in result)) throw new Error("expected skip");
      expect(result.skipped).toContain("milestoneTargetTypeCode");
    });
  });

  describe("X_OF_Y", () => {
    it("returns a payload when typeCode, itemTargetIds[], and targetValue are present", () => {
      const result = buildPromotionTargetPayload(
        {
          kind: "X_OF_Y",
          config: {
            xofYTargetTypeCode: "WEEKLY_VISIT",
            itemTargetIds: ["tgt_a", "tgt_b"],
            targetValue: 2,
          },
        },
        programId,
        targetCode,
        targetName
      );
      if (!("payload" in result)) throw new Error("expected payload");
      expect(result.payload).toMatchObject({
        type: "X_OF_Y",
        xofYTargetTypeCode: "WEEKLY_VISIT",
        itemTargetIds: ["tgt_a", "tgt_b"],
        targetValue: 2,
      });
    });

    it("skips when itemTargetIds is missing", () => {
      const result = buildPromotionTargetPayload(
        {
          kind: "X_OF_Y",
          config: { xofYTargetTypeCode: "X", targetValue: 2 },
        },
        programId,
        targetCode,
        targetName
      );
      if (!("skipped" in result)) throw new Error("expected skip");
      expect(result.skipped).toContain("itemTargetIds[]");
    });

    it("skips when targetValue is missing", () => {
      const result = buildPromotionTargetPayload(
        {
          kind: "X_OF_Y",
          config: { xofYTargetTypeCode: "X", itemTargetIds: ["a"] },
        },
        programId,
        targetCode,
        targetName
      );
      if (!("skipped" in result)) throw new Error("expected skip");
      expect(result.skipped).toContain("targetValue");
    });

    it("skips when xofYTargetTypeCode is missing", () => {
      const result = buildPromotionTargetPayload(
        { kind: "X_OF_Y", config: { itemTargetIds: ["a"], targetValue: 1 } },
        programId,
        targetCode,
        targetName
      );
      if (!("skipped" in result)) throw new Error("expected skip");
      expect(result.skipped).toContain("xofYTargetTypeCode");
    });
  });
});
// ────────────────────────────────────────────────────────────────
// Promotion FREE_ITEM → Coupon Offer issuance (#493)
// ────────────────────────────────────────────────────────────────

describe("runProgramExecutor — promotion FREE_ITEM coupon issuance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  function freeItemPromoSpec(): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.promotions = true;
    spec.promotions = [
      {
        code: "birthday-reward",
        name: "Birthday Reward",
        eventType: { code: "birthday", name: "Birthday" },
        targets: [],
        eventRules: [
          {
            award: { type: "FREE_ITEM", value: "handcrafted_drink" },
          },
        ],
      },
    ];
    return spec;
  }

  it("creates a Coupon Offer for a FREE_ITEM rule and references it from the event rule", async () => {
    const result = await runProgramExecutor(freeItemPromoSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Exactly one Coupon Offer was created for the promotion.
    expect(offerManagementCreateOffer).toHaveBeenCalledTimes(1);
    const offerPayload = vi.mocked(offerManagementCreateOffer).mock.calls[0]?.[0] as {
      type: string;
      programIds: string[];
      code: string;
      name: string;
    };
    expect(offerPayload.type).toBe("COUPON");
    expect(offerPayload.programIds).toEqual(["pgm_1"]);
    expect(offerPayload.code).toContain("birthday-reward-offer");
    // "Birthday Reward" already ends in "Reward" → name is the promo
    // name as-is, NOT "Birthday Reward Reward".
    expect(offerPayload.name).toBe("Birthday Reward");

    // promoSummary.offerIds carries the captured offerId.
    const summary = result.results.promotions?.[0];
    expect(summary?.offerIds?.[0]).toMatch(/^offer_/);

    // The event rule's action emits issueCustomerCoupon with the
    // deterministic offer code (not a 0-point currency stub).
    const ruleCall = vi.mocked(eventEngineManagementCreateEventRule).mock.calls.find((args) => {
      const p = args[0] as { code?: string };
      return p?.code?.includes("birthday-reward-rule") === true;
    });
    expect(ruleCall, "expected to find the birthday-reward event rule create call").toBeDefined();
    const rulePayload = ruleCall![0] as unknown as {
      eventActionsExpression: {
        true: {
          actions: Array<{ issueCustomerCoupon?: { couponOfferCode?: string } }>;
        };
      };
    };
    const action = rulePayload.eventActionsExpression.true.actions[0];
    expect(action?.issueCustomerCoupon).toBeDefined();
    expect(action?.issueCustomerCoupon?.couponOfferCode).toContain("birthday-reward-offer");
  });

  it("shares a single Coupon Offer across two FREE_ITEM rules on the same promotion", async () => {
    const spec = freeItemPromoSpec();
    // Two rules on the same promotion, both FREE_ITEM.
    spec.promotions[0]!.eventRules = [
      { award: { type: "FREE_ITEM", value: "drink_a" } },
      { award: { type: "FREE_ITEM", value: "drink_b" } },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Only ONE offer create — the second FREE_ITEM rule reuses the
    // first's `couponOfferCode`.
    expect(offerManagementCreateOffer).toHaveBeenCalledTimes(1);

    // Both event rules reference the same offer code.
    const ruleCalls = vi.mocked(eventEngineManagementCreateEventRule).mock.calls.filter((args) => {
      const p = args[0] as { code?: string };
      return p?.code?.includes("birthday-reward-rule") === true;
    });
    expect(ruleCalls).toHaveLength(2);
    const offerCodes = ruleCalls.map((args) => {
      const p = args[0] as unknown as {
        eventActionsExpression: {
          true: { actions: Array<{ issueCustomerCoupon?: { couponOfferCode?: string } }> };
        };
      };
      return p.eventActionsExpression.true.actions[0]?.issueCustomerCoupon?.couponOfferCode;
    });
    expect(offerCodes[0]).toBe(offerCodes[1]);
  });

  it("appends ' Reward' to promotion names that don't already end in 'Reward'", async () => {
    const spec = freeItemPromoSpec();
    spec.promotions[0]!.name = "Free Modification Day";

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const offerPayload = vi.mocked(offerManagementCreateOffer).mock.calls[0]?.[0] as {
      name: string;
    };
    // The name doesn't already end in " Reward", so the suffix is added.
    expect(offerPayload.name).toBe("Free Modification Day Reward");
  });

  it("does NOT create an offer for a promotion with only FLAT_POINTS rules", async () => {
    const spec = minimalSpec();
    spec.selectedFeatures.promotions = true;
    spec.promotions = [
      {
        code: "dollar-bonus",
        name: "Dollar Bonus",
        eventType: { code: "purchase", name: "Purchase" },
        targets: [],
        eventRules: [{ award: { type: "FLAT_POINTS", value: 10 } }],
      },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(offerManagementCreateOffer).not.toHaveBeenCalled();
    expect(result.results.promotions?.[0]?.offerIds).toEqual([]);
  });

  it("creates one offer for a mixed FREE_ITEM + FLAT_POINTS promotion", async () => {
    const spec = freeItemPromoSpec();
    spec.promotions[0]!.eventRules = [
      { award: { type: "FREE_ITEM", value: "drink" } },
      { award: { type: "FLAT_POINTS", value: 50 } },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(offerManagementCreateOffer).toHaveBeenCalledTimes(1);

    const ruleCalls = vi.mocked(eventEngineManagementCreateEventRule).mock.calls.filter((args) => {
      const p = args[0] as { code?: string };
      return p?.code?.includes("birthday-reward-rule") === true;
    });
    // FREE_ITEM rule emits issueCustomerCoupon, FLAT_POINTS emits
    // issueProgramCurrency — neither is collapsed into the other.
    const actions = ruleCalls.map((args) => {
      const p = args[0] as unknown as {
        eventActionsExpression: {
          true: {
            actions: Array<{
              issueCustomerCoupon?: unknown;
              issueProgramCurrency?: unknown;
            }>;
          };
        };
      };
      return p.eventActionsExpression.true.actions[0];
    });
    expect(actions[0]?.issueCustomerCoupon).toBeDefined();
    expect(actions[1]?.issueProgramCurrency).toBeDefined();
  });
});

describe("buildPromotionExpression", () => {
  it("returns `{ true: {} }` when conditions is undefined", () => {
    expect(buildPromotionExpression(undefined)).toEqual({ true: {} });
  });

  it("returns `{ true: {} }` when conditions is an empty object", () => {
    expect(buildPromotionExpression({})).toEqual({ true: {} });
  });

  it("translates equalsPath + equalsValue into an equals expression", () => {
    const result = buildPromotionExpression({
      equalsPath: "$.eventData.dayOfWeek",
      equalsValue: "MONDAY",
    });
    expect(result).toEqual({
      equals: { path: "$.eventData.dayOfWeek", value: "MONDAY" },
    });
  });

  it("preserves non-string equalsValue (boolean) for attribute checks", () => {
    // `reusableCup: true` is a real coffee-shop case — the equals
    // expression must carry the boolean through, not stringify.
    const result = buildPromotionExpression({
      equalsPath: "$.eventData.reusableCup",
      equalsValue: true,
    });
    expect((result as { equals: { value: unknown } }).equals.value).toBe(true);
  });

  it("translates hasTier into a currentTier predicate with revalidateTier=true", () => {
    expect(buildPromotionExpression({ hasTier: "GOLD" })).toEqual({
      currentTier: { tierCode: "GOLD", revalidateTier: true },
    });
  });

  it("falls back to `{ true: {} }` on an unknown condition shape", () => {
    // Defends against LLM-emitted keys that the platform's event-engine
    // would either reject (400) or silently ignore (over-payment risk).
    expect(buildPromotionExpression({ garbageKey: "value" })).toEqual({ true: {} });
  });

  it("falls back when equalsPath is present but equalsValue is missing", () => {
    expect(buildPromotionExpression({ equalsPath: "$.eventData.x" })).toEqual({ true: {} });
  });

  it("falls back when hasTier is non-string", () => {
    expect(buildPromotionExpression({ hasTier: 42 })).toEqual({ true: {} });
  });
});

describe("buildPromotionAction — MULTIPLIER event amount path", () => {
  const multiplierRule = { award: { type: "MULTIPLIER" as const, value: "1.5" } };

  function multiplierPath(isBaseTransactionalEvent: boolean): string | undefined {
    const action = buildPromotionAction(
      multiplierRule,
      "program-1",
      "POINTS",
      undefined,
      isBaseTransactionalEvent
    ) as {
      issueProgramCurrency?: { path?: string };
    };
    return action.issueProgramCurrency?.path;
  }

  it("uses eligibleAmount for a rule scoped to the base transactional event", () => {
    expect(multiplierPath(true)).toBe("$.eventData.eligibleAmount.amount");
  });

  it("keeps the top-level amount path for a bespoke promotion event", () => {
    expect(multiplierPath(false)).toBe("$.eventData.amount");
  });

  it("still rejects a non-numeric MULTIPLIER award value", () => {
    expect(() =>
      buildPromotionAction(
        { award: { type: "MULTIPLIER", value: "not-a-number" } },
        "program-1",
        "POINTS",
        undefined,
        true
      )
    ).toThrow("Promotion MULTIPLIER award value is not a finite number");
  });
});

describe("runCreatingTierBonusRules — error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  function bonusTierSpec(): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.autoAwardBaseTier = true;
    spec.tiers = [
      { name: "Bronze", code: "bronze", pointsThreshold: 0 },
      { name: "Silver", code: "silver", pointsThreshold: 100, earnMultiplier: 1.5 },
    ];
    return spec;
  }

  it("throws when the create response is non-200", async () => {
    vi.mocked(eventEngineManagementCreateEventRule).mockImplementation((async (payload: {
      code?: string;
    }) => {
      if (payload.code?.includes("silver-multiplier")) {
        // status !== 200 → executor throws "Failed to create tier bonus rule…"
        return { data: {}, status: 500, headers: new Headers() };
      }
      return ok({ eventRuleId: `rule_${payload.code ?? "x"}`, code: payload.code });
    }) as never);

    const result = await runProgramExecutor(bonusTierSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.error.message).toContain("tier bonus rule");
      expect(result.error.message).toContain("Silver");
    }
  });

  it("throws when the response succeeds but eventRuleId is missing", async () => {
    vi.mocked(eventEngineManagementCreateEventRule).mockImplementation((async (payload: {
      code?: string;
    }) => {
      if (payload.code?.includes("silver-multiplier")) {
        // status === 200 but the server returned no eventRuleId — the
        // executor refuses to record a phantom rule.
        return ok({}) as { data: { eventRuleId?: string }; status: 200; headers: Headers };
      }
      return ok({ eventRuleId: `rule_${payload.code ?? "x"}`, code: payload.code });
    }) as never);

    const result = await runProgramExecutor(bonusTierSpec(), devCtx());

    expect(result.status).toBe("aborted");
    if (result.status === "aborted") {
      expect(result.error.message).toContain("no eventRuleId");
    }
  });
});

describe("computeActiveStages — creating-tier-bonus-rules predicate", () => {
  function specWithMultipliers(multipliers: Array<number | undefined>): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.tiers = true;
    spec.tiers = multipliers.map((earnMultiplier, i) => {
      const tier: ProgramSpec["tiers"][number] = {
        name: `T${i}`,
        code: `t${i}`,
        pointsThreshold: i * 100,
      };
      if (earnMultiplier !== undefined) tier.earnMultiplier = earnMultiplier;
      return tier;
    });
    return spec;
  }

  it("includes the stage when at least one tier has earnMultiplier > 1.0", () => {
    expect(computeActiveStages(specWithMultipliers([undefined, 1.5]), "dev")).toContain(
      "creating-tier-bonus-rules"
    );
  });

  it("excludes the stage when every tier has earnMultiplier <= 1.0 or undefined", () => {
    expect(computeActiveStages(specWithMultipliers([undefined, undefined]), "dev")).not.toContain(
      "creating-tier-bonus-rules"
    );
    expect(computeActiveStages(specWithMultipliers([1.0, 1.0]), "dev")).not.toContain(
      "creating-tier-bonus-rules"
    );
  });

  it("excludes the stage when a tier has earnMultiplier = 0.5 (regression lock from PR #497 fix)", () => {
    // The per-tier skip in runCreatingTierBonusRules uses `<= 1.0`. Stage
    // gate must match (`> 1.0`) so the progress bar never advances past a
    // stage the inner loop silently skips. A sub-1.0 multiplier (e.g. a
    // future LLM extracting "earn slightly less") must NOT trigger the
    // stage.
    expect(computeActiveStages(specWithMultipliers([0.5]), "dev")).not.toContain(
      "creating-tier-bonus-rules"
    );
  });

  it("excludes the stage when tiers feature is off, even if multipliers > 1.0 are present", () => {
    const spec = specWithMultipliers([1.5]);
    spec.selectedFeatures.tiers = false;
    expect(computeActiveStages(spec, "dev")).not.toContain("creating-tier-bonus-rules");
  });
});

describe("runCreatingPromotions — event-type code collision fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  function emptyEventTypeSpec(): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.promotions = true;
    spec.promotions = [
      {
        // Two promotions whose `eventType.code` strips to empty after
        // sanitization — they MUST get distinct fallback codes
        // (`promotion.event0`, `promotion.event1`) to avoid colliding
        // on the same dataModelType / EVENT_TYPE entity.
        code: "promo-a",
        name: "Promo A",
        eventType: { code: "!@#$", name: "A" },
        targets: [],
        eventRules: [{ award: { type: "FLAT_POINTS", value: 1 } }],
      },
      {
        code: "promo-b",
        name: "Promo B",
        eventType: { code: "%%%%", name: "B" },
        targets: [],
        eventRules: [{ award: { type: "FLAT_POINTS", value: 2 } }],
      },
    ];
    return spec;
  }

  it("derives distinct scoped event type codes for two prose-only inputs", async () => {
    const result = await runProgramExecutor(emptyEventTypeSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Two distinct event-type-config creates — each rooted at the
    // loop-index fallback. Without the fallback, both promotions
    // would collide on the same empty code.
    const configCreateCalls = vi
      .mocked(eventEngineManagementCreateEventTypeConfiguration)
      .mock.calls.filter((args) => {
        const p = args[0] as { code?: string };
        return p?.code?.includes("promotion.event") === true;
      });
    expect(configCreateCalls).toHaveLength(2);
    const codes = configCreateCalls.map((c) => (c[0] as { code: string }).code);
    expect(codes[0]).not.toBe(codes[1]);
    expect(codes[0]).toMatch(/promotion\.event0$/);
    expect(codes[1]).toMatch(/promotion\.event1$/);
  });
});

// ────────────────────────────────────────────────────────────────
// Customer-care registration for custom activities
// ────────────────────────────────────────────────────────────────

describe("customer-care registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  /** A spec whose program defines one custom activity. */
  function eventBasedSpec(): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.programType = "event-based";
    spec.eventType = {
      code: "hotel_stay",
      name: "Hotel stay",
      dataFields: [
        { name: "nights", type: "number", required: true },
        { name: "property", type: "string", required: false },
      ],
    };
    return spec;
  }

  /** Activity codes this run actually created event types for. */
  function createdActivityCodes(result: Awaited<ReturnType<typeof runProgramExecutor>>): string[] {
    if (result.status !== "success") return [];
    return [
      ...new Set(result.created.filter((ref) => ref.type === "eventType").map((ref) => ref.code)),
    ];
  }

  function careRegistrations() {
    return vi
      .mocked(eventEngineManagementCreateEventTypeAction)
      .mock.calls.map((call) => call[0] as { eventTypeCode?: string; surfaces?: string[] });
  }

  it("registers a program's custom activity for the customer-care surface", async () => {
    // Covers AE8. A new vertical's activities are exactly the ones a care agent
    // will need to record by hand, and the registry has no care rows by default.
    const result = await runProgramExecutor(eventBasedSpec(), devCtx());

    expect(result.status).toBe("success");
    const registrations = careRegistrations();
    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toEqual({
      eventTypeCode: "hotel_stay",
      surfaces: ["CUSTOMER_CARE"],
    });
  });

  it("registers every custom activity when a program defines several", async () => {
    // A promotion introduces its own activity alongside the program's, which is
    // exactly the multi-activity vertical this pass has to cover.
    const spec = minimalSpec();
    spec.selectedFeatures.promotions = true;
    spec.promotions = [
      {
        code: "card-reload",
        name: "Card Reload Bonus",
        eventType: { code: "card_reload", name: "Card Reload" },
        targets: [
          { kind: "COUNTER", config: { counterTargetTypeCode: "RELOAD_AMOUNT", targetValue: 30 } },
        ],
        eventRules: [{ award: { type: "FLAT_POINTS", value: 10 } }],
      },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    const codes = careRegistrations().map((r) => r.eventTypeCode);

    // Both the program's own activity and the promotion's are offered to care.
    // Note the promotion path records no `eventType` ref in the execution log,
    // which is why the registration pass tracks activity codes of its own
    // rather than reading them back out of `created`.
    expect(codes.length).toBe(2);
    expect(codes.some((c) => c?.includes("card") === true)).toBe(true);
    // No activity is registered twice, however many stages defined event types.
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("registers without filtering by kind", async () => {
    // Coverage on day one matters more than a tidy list; pruning is the
    // administrator's job through the registry surface.
    const result = await runProgramExecutor(eventBasedSpec(), devCtx());

    expect(result.status).toBe("success");
    for (const registration of careRegistrations()) {
      expect(registration.surfaces).toEqual(["CUSTOMER_CARE"]);
    }
  });

  it("registers exactly the activities the run created, and nothing else", async () => {
    // The registration pass is driven entirely off the run's created entities,
    // so it can never offer care an activity this run did not create.
    const result = await runProgramExecutor(minimalSpec(), devCtx());

    expect(result.status).toBe("success");
    const created = createdActivityCodes(result);
    const registered = careRegistrations().map((r) => r.eventTypeCode);
    expect([...registered].sort()).toEqual([...created].sort());
  });

  it("still offers the activity to care when its configuration already exists", async () => {
    // Load-bearing since the e2e reset project began pre-seeding the `purchase`
    // event type via direct API calls (loom-loyalty#745). The wizard then adopts
    // the existing configuration instead of creating one, so the config create
    // 409s and never reaches `created`. Registration must NOT be conditional on
    // that create succeeding, or a re-run against a seeded tenant would leave
    // care with an empty picker — which surfaces as a broken scenario, not as
    // the missing registration it actually is.
    vi.mocked(eventEngineManagementCreateEventTypeConfiguration).mockRejectedValue(
      Object.assign(new Error("Conflict: already exists"), { statusCode: 409 })
    );

    const result = await runProgramExecutor(eventBasedSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    // The activity is offered to care regardless of whether this run created its
    // configuration or adopted an existing one.
    expect(careRegistrations().map((r) => r.eventTypeCode)).toContain("hotel_stay");
    expect(eventEngineManagementCreateEventTypeAction).toHaveBeenCalledTimes(1);
  });

  it("registers a shared activity once when two promotions bind to it", async () => {
    // Every wizard program defines at least one activity, so "a program with no
    // custom activity" is not reachable through a spec — the reachable
    // no-op branch is an activity that two stages both reference.
    const spec = minimalSpec();
    spec.selectedFeatures.promotions = true;
    spec.promotions = [
      {
        code: "reload-a",
        name: "Reload A",
        eventType: { code: "card_reload", name: "Card Reload" },
        targets: [],
        eventRules: [{ award: { type: "FLAT_POINTS", value: 10 } }],
      },
      {
        code: "reload-b",
        name: "Reload B",
        eventType: { code: "card_reload", name: "Card Reload" },
        targets: [],
        eventRules: [{ award: { type: "FLAT_POINTS", value: 20 } }],
      },
    ];

    const result = await runProgramExecutor(spec, devCtx());

    expect(result.status).toBe("success");
    const codes = careRegistrations().map((r) => r.eventTypeCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.filter((c) => c?.includes("card") === true)).toHaveLength(1);
  });

  it("does not fail program creation when a registration fails, and reports it as progress", async () => {
    // The program is the deliverable; the registration is a convenience.
    vi.mocked(eventEngineManagementCreateEventTypeAction).mockRejectedValue(
      new Error("registry unavailable")
    );
    const events: ProgressEvent[] = [];

    const result = await runProgramExecutor(
      eventBasedSpec(),
      devCtx({ onProgress: (e) => events.push(e) })
    );

    expect(result.status).toBe("success");
    const messages = events.map((e) => e.message ?? "").join(" ");
    expect(messages).toContain("Could not offer");
    expect(messages).toContain("hotel_stay");
    expect(messages).toContain("an administrator can add it in the registry");
  });

  it("reports a non-200 registration response without failing the run", async () => {
    vi.mocked(eventEngineManagementCreateEventTypeAction).mockResolvedValue({
      status: 403,
      data: undefined,
    } as never);
    const events: ProgressEvent[] = [];

    const result = await runProgramExecutor(
      eventBasedSpec(),
      devCtx({ onProgress: (e) => events.push(e) })
    );

    expect(result.status).toBe("success");
    expect(events.map((e) => e.message ?? "").join(" ")).toContain("Could not offer");
  });

  it("records each registration in the execution log so rollback can remove it", async () => {
    const result = await runProgramExecutor(eventBasedSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const logged = result.created.filter((ref) => ref.type === "eventTypeAction");
    expect(logged).toHaveLength(1);
    expect(logged[0].code).toBe("hotel_stay");
    // The id is what the DELETE endpoint needs.
    expect(logged[0].id).toBe("eta_hotel_stay");
  });

  it("logs nothing for a registration that failed", async () => {
    vi.mocked(eventEngineManagementCreateEventTypeAction).mockRejectedValue(new Error("nope"));

    const result = await runProgramExecutor(eventBasedSpec(), devCtx());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.created.filter((ref) => ref.type === "eventTypeAction")).toHaveLength(0);
  });
});

describe("runProgramExecutor — eventType.useExisting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllSuccess();
  });

  /** Reusing a pre-seeded system type (e.g. TRMNL's "check-in") rather than creating a new one. */
  function existingEventTypeSpec(): ProgramSpec {
    const spec = minimalSpec();
    spec.selectedFeatures.programType = "event-based";
    spec.eventType = {
      code: "check-in",
      name: "Check In",
      dataFields: [],
      useExisting: true,
    };
    return spec;
  }

  it("skips DataModelType/DataModel/EVENT_TYPE-data-type creation and only registers an EventTypeConfiguration", async () => {
    const result = await runProgramExecutor(existingEventTypeSpec(), devCtx());

    expect(result.status).toBe("success");
    // "check-in" is a reserved system code (SystemDataModelType.CHECK_IN) --
    // attempting to create it 400s ("reserved system or primitive code"), so
    // none of these three calls should ever be made for this event type.
    expect(dataModelManagementCreateDataModelType).not.toHaveBeenCalled();
    expect(dataModelManagementCreateDataModel).not.toHaveBeenCalled();
    expect(metadataManagementCreateDataType).not.toHaveBeenCalled();
    // The per-org EventTypeConfiguration registration is the only thing this
    // event type genuinely needs from program setup.
    expect(eventEngineManagementCreateEventTypeConfiguration).toHaveBeenCalledTimes(1);
    expect(eventEngineManagementCreateEventTypeConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ code: "check-in", eventTypeCode: "check-in", name: "Check In" })
    );
  });

  it("fires the test event against the existing event type's own code, unmodified", async () => {
    const result = await runProgramExecutor(existingEventTypeSpec(), devCtx());

    expect(result.status).toBe("success");
    expect(eventEnginePublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventTypeCode: "check-in" }),
      expect.anything()
    );
  });

  it("tolerates an EventTypeConfiguration that another program already registered", async () => {
    // The common real case: a system type like "check-in" (or a custom type
    // from an earlier program) already has a configuration by the time a
    // second program reuses it.
    vi.mocked(eventEngineManagementCreateEventTypeConfiguration).mockRejectedValue(
      Object.assign(new Error("Conflict: already exists"), { statusCode: 409 })
    );

    const result = await runProgramExecutor(existingEventTypeSpec(), devCtx());

    expect(result.status).toBe("success");
  });
});
