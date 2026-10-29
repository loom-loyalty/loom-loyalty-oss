/**
 * Pre-scan module for skip-existing replay mode.
 *
 * Pure read-only side of the executor. Given a `ProgramSpec` and an
 * `ExecutorContext`, fetches every entity the executor WOULD create from
 * the target environment to determine:
 *   - Which entities already exist with matching shape (skip them)
 *   - Which entities collide with a divergent shape (abort with conflict-diff)
 *   - Which entities don't exist (create normally)
 *
 * Design notes:
 *
 * 1. **Deterministic codes.** Every entity the executor creates has a
 *    caller-deterministic code — either from the spec directly or from a
 *    pure function over the spec (`api-converters.ts` helpers). This
 *    module computes all those codes up front without making any create
 *    calls, then fetches them in order.
 *
 * 2. **Program first.** The program entity is the root. If it doesn't
 *    exist, NOTHING else can exist yet (everything else references the
 *    program by ID). So if `getProgramByCode` returns 404, we short-circuit
 *    and return an empty conflict list — all stages will run as if strict
 *    mode.
 *
 * 3. **404 is expected.** `sdkFetch` throws on any non-ok response. A 404
 *    from a get-by-code endpoint means "entity not found" — that's a
 *    normal pre-scan outcome, not a real error. This module catches 404s
 *    and treats them as "not present". Any other error (500, network,
 *    auth) propagates to the caller.
 *
 * 4. **Fail-open on per-entity errors.** If fetching the program succeeds
 *    but fetching, say, a badge fails with a 500, we don't abort the
 *    whole pre-scan — we mark that specific entity as "not present"
 *    (conservative, the executor will attempt to create it and hit the
 *    real conflict there). The rationale: pre-scan is an optimization.
 *    If it can't run reliably, the executor's per-stage creation path
 *    is the ground truth.
 *
 *    IMPORTANT nuance: 404 is always "not present" (cheap lookup, trust
 *    the answer). Other errors are "uncertain, create anyway and let
 *    the backend arbitrate".
 *
 * 5. **Expiry and pending rules use list+filter.** Per P0.5b findings,
 *    the API doesn't expose `/expiry-rules/by-code/{code}` or
 *    `/pending-rules/by-code/{code}`. The fallback is a paginated list
 *    call plus client-side filter. For typical orgs this is 1 page;
 *    for large orgs, could be multi-page (noted as a perf followup).
 */

import {
  customerStatusManagementGetBadgeByCode,
  customerStatusManagementGetTierByCode,
  eventEngineManagementGetEventRuleByCode,
  eventEngineManagementGetEventTypeConfigurationByCode,
  eventEngineManagementGetTargetByCode,
  programBankManagementGetProgramCurrencyByCode,
  programBankManagementListExpiryRules,
  programBankManagementListPendingRules,
  programManagementGetProgramByCode,
} from "@loom-loyalty/sdk";

import { generateCode } from "./api-converters";
import {
  getNonBaseTiers,
  sanitizeProgramCodeForEventType,
  sanitizePromoEventCode,
  scopePromoEventTypeCode,
} from "./execution-helpers";
import { computeEntityShapeDiff, hasFatalDiff } from "./shape-diff";
import type { ProgramSpec } from "./spec";
import { getTemplateById } from "./templates";
import type { ConflictEntry, EntityRef, EntityType } from "./types";

// ────────────────────────────────────────────────────────────────
// 404 detection
// ────────────────────────────────────────────────────────────────

/**
 * sdkFetch throws an `ApiError` (plain object with `statusCode`) on any
 * non-ok HTTP response. 404 means "entity not found" — a normal outcome
 * of a get-by-code pre-scan, not a real error.
 */
function isNotFoundError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const e = err as { statusCode?: unknown; status?: unknown };
  return e.statusCode === 404 || e.status === 404;
}

/**
 * Any other HTTP error (500, network, auth) is "uncertain" — pre-scan
 * treats the entity as "not present" and lets the real executor stage
 * surface the problem with full error context.
 */
function isUncertainError(err: unknown): boolean {
  if (isNotFoundError(err)) return false;
  return true;
}

/**
 * Wrap a get-by-code call so 404 → null, other errors → null (uncertain).
 * Returns the `data` field from the successful response, or null.
 */
async function tryGetByCode<T>(
  fetcher: () => Promise<{ data: T | void; status: number; headers: Headers }>
): Promise<T | null> {
  try {
    const response = await fetcher();
    return (response.data as T | undefined) ?? null;
  } catch (err) {
    if (isNotFoundError(err)) return null;
    if (isUncertainError(err)) return null;
    // unreachable — kept for exhaustiveness
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// Expected-code computation
// ────────────────────────────────────────────────────────────────

/**
 * The full set of entity codes the executor plans to create for this
 * spec, computed WITHOUT running the executor. Every value here is
 * derived from the spec + pure helpers.
 */
interface PlannedCodes {
  program: string | null;
  currency: string | null;
  expiryRule: string | null;
  pendingRule: string | null;
  tiers: string[];
  badges: string[];
  tierTargets: string[];
  eventTypeConfig: string | null;
  awardRule: string | null;
  baseTierRule: string | null;
  tierProgressionRules: string[];
  signupBonusRule: string | null;
  birthdayBonusRule: string | null;
  /**
   * Codes the `runCreatingTierBonusRules` stage will create. One per tier
   * with `earnMultiplier > 1.0`. Without these in pre-scan, a second
   * `runProgramExecutor` run halts on a 409 in the stage's `wrapApiCall`.
   */
  tierBonusRules: string[];
  /**
   * Codes the `runCreatingPromotions` stage will create for each promotion.
   * Promotion event-rule and target creates use `ignoreIfExists` today, but
   * without pre-scan the executor's `promoSummary.{eventRuleIds,targetIds}`
   * come back empty on rerun and downstream tools can't tell what landed.
   */
  promotionEventTypeConfigs: string[];
  promotionTargets: string[];
  promotionEventRules: string[];
}

function planCodes(spec: ProgramSpec): PlannedCodes {
  const programCode = spec.program.code ?? null;
  const programName = spec.program.name ?? "Program";

  // Currency: reuse existing if specified, else either the spec's code or
  // the generated default (matches `buildCurrencyPayload` logic).
  let currencyCode: string | null = null;
  if (
    spec.selectedFeatures?.programCurrency &&
    !spec.existingCurrencyCode &&
    programCode !== null
  ) {
    currencyCode = spec.currency?.code ?? `${programCode}-points`;
  }

  const expiryRuleCode =
    spec.selectedFeatures?.expiry && programCode !== null ? `${programCode}-expiry` : null;
  const pendingRuleCode =
    spec.selectedFeatures?.pending && programCode !== null ? `${programCode}-pending` : null;

  const tierCodes = spec.selectedFeatures?.tiers ? (spec.tiers ?? []).map((t) => t.code) : [];

  const badgeCodes = spec.selectedFeatures?.badges ? (spec.badges ?? []).map((b) => b.code) : [];

  const nonBaseTiers = getNonBaseTiers(spec.tiers);
  const tierTargetCodes =
    spec.selectedFeatures?.tiers && programCode !== null
      ? nonBaseTiers.map((t) => generateCode(`${programCode}-${t.code}-target`))
      : [];

  // Event type code (for the configuration lookup). Transactional programs
  // synthesize `{programCode}.{templateEventType}.config`; event-based
  // programs use the user's event type code as-is (stored via the
  // data model, not the event type config — so no config lookup needed).
  let eventTypeConfigCode: string | null = null;
  if (programCode !== null && !spec.eventType) {
    const sanitized = sanitizeProgramCodeForEventType(programCode);
    const template = spec.awardRule?.templateId ? getTemplateById(spec.awardRule.templateId) : null;
    const baseEventTypeCode = template?.eventTypeCode ?? "purchase";
    eventTypeConfigCode = `${sanitized}.${baseEventTypeCode}.config`;
  }

  // Award rule code: either user-provided or generated from templateId.
  let awardRuleCode: string | null = null;
  if (programCode !== null && spec.awardRule) {
    awardRuleCode =
      spec.awardRule.rulePayload?.code ?? `${programCode}-${spec.awardRule.templateId}`;
  }

  const baseTierRuleCode =
    spec.autoAwardBaseTier && programCode !== null
      ? generateCode(`${programCode}-base-tier`)
      : null;

  const tierProgressionRuleCodes =
    spec.selectedFeatures?.tiers && programCode !== null
      ? nonBaseTiers.map((t) => generateCode(`${programCode}-${t.code}-progression`))
      : [];

  const signupBonusRuleCode =
    spec.selectedFeatures?.signupBonus && programCode !== null
      ? generateCode(`${programCode}-signup-bonus`)
      : null;

  const birthdayBonusRuleCode =
    spec.selectedFeatures?.birthdayBonus && programCode !== null
      ? generateCode(`${programCode}-birthday-bonus`)
      : null;

  // Tier-bonus rules — one per tier with `earnMultiplier > 1.0`. The
  // predicate must mirror both the stage gate in `computeActiveStages`
  // (executor.ts:246) and the per-tier skip in `runCreatingTierBonusRules`
  // (executor.ts:2010); a future LLM extracting `earnMultiplier: 0.5`
  // must NOT pre-plan a bonus rule.
  const tierBonusRuleCodes =
    spec.selectedFeatures?.tiers && programCode !== null
      ? (spec.tiers ?? [])
          .filter((t) => t.earnMultiplier !== undefined && t.earnMultiplier > 1.0)
          .map((t) => generateCode(`${programCode}-${t.code}-multiplier`))
      : [];

  // Promotion-derived codes mirror runCreatingPromotions exactly.
  // The sanitized `programCode` for promotions matches what the executor
  // computes at executor.ts:2093 (sanitizeProgramCodeForEventType).
  const promotionEventTypeConfigCodes: string[] = [];
  const promotionTargetCodes: string[] = [];
  const promotionEventRuleCodes: string[] = [];
  if (
    spec.selectedFeatures?.promotions &&
    programCode !== null &&
    (spec.promotions?.length ?? 0) > 0
  ) {
    const sanitizedProgramCode = sanitizeProgramCodeForEventType(programCode);
    const seen = new Set<string>();
    for (let promoIndex = 0; promoIndex < spec.promotions!.length; promoIndex++) {
      const promo = spec.promotions![promoIndex]!;
      const sanitized = sanitizePromoEventCode(promo.eventType.code, promoIndex);
      const scoped = scopePromoEventTypeCode(sanitizedProgramCode, sanitized);
      // Two promotions can share an event type; only scan the config code once.
      if (!seen.has(scoped)) {
        promotionEventTypeConfigCodes.push(scoped);
        seen.add(scoped);
      }
      const promoCodePrefix = generateCode(`${programCode}-${promo.code}`);
      for (let ti = 0; ti < promo.targets.length; ti++) {
        const t = promo.targets[ti]!;
        // Only COUNTER targets with an explicit typeCode currently create
        // a platform Target. PR #494 extends the predicate to the other
        // kinds; rebase here on top of that change.
        if (typeof t.config["counterTargetTypeCode"] === "string") {
          promotionTargetCodes.push(`${promoCodePrefix}-target-${ti}`);
        }
      }
      for (let ri = 0; ri < promo.eventRules.length; ri++) {
        promotionEventRuleCodes.push(`${promoCodePrefix}-rule-${ri}`);
      }
    }
  }

  void programName; // reserved for future use (match heuristics on display name)

  return {
    program: programCode,
    currency: currencyCode,
    expiryRule: expiryRuleCode,
    pendingRule: pendingRuleCode,
    tiers: tierCodes,
    badges: badgeCodes,
    tierTargets: tierTargetCodes,
    eventTypeConfig: eventTypeConfigCode,
    awardRule: awardRuleCode,
    baseTierRule: baseTierRuleCode,
    tierProgressionRules: tierProgressionRuleCodes,
    signupBonusRule: signupBonusRuleCode,
    birthdayBonusRule: birthdayBonusRuleCode,
    tierBonusRules: tierBonusRuleCodes,
    promotionEventTypeConfigs: promotionEventTypeConfigCodes,
    promotionTargets: promotionTargetCodes,
    promotionEventRules: promotionEventRuleCodes,
  };
}

// ────────────────────────────────────────────────────────────────
// Pre-scan result
// ────────────────────────────────────────────────────────────────

/**
 * Key into the existing-entity map: `${entityType}:${code}`.
 *
 * Different entity types can share a code (e.g. a tier and an event rule
 * can both be called "silver-tier") without collision because we qualify
 * the key by type.
 */
export type PreScanKey = `${EntityType}:${string}`;

export function preScanKey(type: EntityType, code: string): PreScanKey {
  return `${type}:${code}` as PreScanKey;
}

/**
 * The structured result of a pre-scan.
 */
export interface PreScanResult {
  /** Entities found in the target env, keyed by `${type}:${code}`. Values
   *  are the raw API response data (shape depends on entity type). */
  codeToExisting: Map<PreScanKey, unknown>;

  /** Entities that exist in the target env with a divergent shape. */
  conflicts: ConflictEntry[];

  /** Entities planned for creation that do NOT exist (will be created). */
  wouldCreate: EntityRef[];

  /** Entities that already exist with matching shape (will be skipped). */
  wouldSkip: EntityRef[];
}

// ────────────────────────────────────────────────────────────────
// Pre-scan runner
// ────────────────────────────────────────────────────────────────

/**
 * Run the full pre-scan for a spec. Called by the executor at the top
 * of `runProgramExecutor` when `replayMode === 'skip-existing'`.
 *
 * Does no writes. Returns a structured result the executor inspects to
 * decide between strict-mode create, skip, or abort-with-conflict-diff.
 */
export async function runPreScan(spec: ProgramSpec): Promise<PreScanResult> {
  const codeToExisting = new Map<PreScanKey, unknown>();
  const conflicts: ConflictEntry[] = [];
  const wouldCreate: EntityRef[] = [];
  const wouldSkip: EntityRef[] = [];

  const plannedCodes = planCodes(spec);

  // ─── 1. Program ─────────────────────────────────────────────
  if (plannedCodes.program === null) {
    // Nothing to scan (no program code yet). Caller will surface the
    // linter violation before execution anyway.
    return { codeToExisting, conflicts, wouldCreate, wouldSkip };
  }

  const existingProgram = await tryGetByCode(() =>
    programManagementGetProgramByCode(plannedCodes.program!)
  );

  // Classify the program entity
  const programRef: EntityRef = {
    type: "program",
    code: plannedCodes.program,
    ...(spec.program.name !== undefined && { name: spec.program.name }),
  };

  if (existingProgram === null) {
    // Short-circuit: program doesn't exist in target env, so nothing
    // downstream can exist either. Every planned entity will be created.
    wouldCreate.push(programRef);
    for (const code of plannedCodes.tiers) wouldCreate.push({ type: "tier", code });
    for (const code of plannedCodes.badges) wouldCreate.push({ type: "badge", code });
    for (const code of plannedCodes.tierTargets) wouldCreate.push({ type: "target", code });
    if (plannedCodes.currency !== null)
      wouldCreate.push({ type: "currency", code: plannedCodes.currency });
    if (plannedCodes.expiryRule !== null)
      wouldCreate.push({ type: "expiryRule", code: plannedCodes.expiryRule });
    if (plannedCodes.pendingRule !== null)
      wouldCreate.push({ type: "pendingRule", code: plannedCodes.pendingRule });
    if (plannedCodes.eventTypeConfig !== null)
      wouldCreate.push({ type: "eventType", code: plannedCodes.eventTypeConfig });
    if (plannedCodes.awardRule !== null)
      wouldCreate.push({ type: "eventRule", code: plannedCodes.awardRule });
    if (plannedCodes.baseTierRule !== null)
      wouldCreate.push({ type: "eventRule", code: plannedCodes.baseTierRule });
    for (const code of plannedCodes.tierProgressionRules)
      wouldCreate.push({ type: "eventRule", code });
    if (plannedCodes.signupBonusRule !== null)
      wouldCreate.push({ type: "eventRule", code: plannedCodes.signupBonusRule });
    if (plannedCodes.birthdayBonusRule !== null)
      wouldCreate.push({ type: "eventRule", code: plannedCodes.birthdayBonusRule });
    for (const code of plannedCodes.tierBonusRules) wouldCreate.push({ type: "eventRule", code });
    for (const code of plannedCodes.promotionEventTypeConfigs)
      wouldCreate.push({ type: "eventType", code });
    for (const code of plannedCodes.promotionTargets) wouldCreate.push({ type: "target", code });
    for (const code of plannedCodes.promotionEventRules)
      wouldCreate.push({ type: "eventRule", code });
    return { codeToExisting, conflicts, wouldCreate, wouldSkip };
  }

  // Program exists. Record it and run shape-diff.
  codeToExisting.set(preScanKey("program", plannedCodes.program), existingProgram);
  classifyExisting(
    "program",
    programRef,
    buildExpectedProgramShape(spec),
    existingProgram,
    wouldSkip,
    conflicts
  );

  // Extract the program's server-side ID from the existing response so
  // child entity expected-shape builders can populate programIds. The
  // programBankManagement response uses `programId` as the field name.
  // Fall back to undefined if the shape doesn't have it — the shape-diff
  // null-equivalence rule handles that gracefully, and the builders
  // conditionally spread programIds only when the id is present.
  const existingProgramId =
    existingProgram && typeof existingProgram === "object"
      ? ((existingProgram as unknown as Record<string, unknown>).programId as string | undefined)
      : undefined;

  // ─── 2. Other entities (program exists, check children) ────
  await scanEntityByCode(
    "currency",
    plannedCodes.currency,
    (code) => programBankManagementGetProgramCurrencyByCode(code),
    () => buildExpectedCurrencyShape(spec, existingProgramId),
    codeToExisting,
    conflicts,
    wouldCreate,
    wouldSkip,
    spec.currency?.name
  );

  // Tiers
  for (const tierCode of plannedCodes.tiers) {
    const tierName = spec.tiers?.find((t) => t.code === tierCode)?.name;
    await scanEntityByCode(
      "tier",
      tierCode,
      (code) => customerStatusManagementGetTierByCode(code),
      () => buildExpectedTierShape(spec, tierCode),
      codeToExisting,
      conflicts,
      wouldCreate,
      wouldSkip,
      tierName
    );
  }

  // Badges
  for (const badgeCode of plannedCodes.badges) {
    const badgeName = spec.badges?.find((b) => b.code === badgeCode)?.name;
    await scanEntityByCode(
      "badge",
      badgeCode,
      (code) => customerStatusManagementGetBadgeByCode(code),
      () => buildExpectedBadgeShape(spec, badgeCode, existingProgramId),
      codeToExisting,
      conflicts,
      wouldCreate,
      wouldSkip,
      badgeName
    );
  }

  // Tier targets
  for (const targetCode of plannedCodes.tierTargets) {
    await scanEntityByCode(
      "target",
      targetCode,
      (code) => eventEngineManagementGetTargetByCode(code),
      () => buildExpectedTargetShape(spec, targetCode, existingProgramId),
      codeToExisting,
      conflicts,
      wouldCreate,
      wouldSkip
    );
  }

  // Event type configuration
  if (plannedCodes.eventTypeConfig !== null) {
    await scanEntityByCode(
      "eventType",
      plannedCodes.eventTypeConfig,
      (code) => eventEngineManagementGetEventTypeConfigurationByCode(code),
      () => buildExpectedEventTypeShape(spec),
      codeToExisting,
      conflicts,
      wouldCreate,
      wouldSkip
    );
  }

  // Event rules (award + base-tier + progression + signup + birthday +
  // tier-bonus + promotion). All scanned by code only — the expected rule
  // payload depends on backend expression normalization, so shape-diff
  // is deferred. A code match means "skip" for these.
  const eventRuleCodes: string[] = [];
  if (plannedCodes.awardRule !== null) eventRuleCodes.push(plannedCodes.awardRule);
  if (plannedCodes.baseTierRule !== null) eventRuleCodes.push(plannedCodes.baseTierRule);
  eventRuleCodes.push(...plannedCodes.tierProgressionRules);
  if (plannedCodes.signupBonusRule !== null) eventRuleCodes.push(plannedCodes.signupBonusRule);
  if (plannedCodes.birthdayBonusRule !== null) eventRuleCodes.push(plannedCodes.birthdayBonusRule);
  eventRuleCodes.push(...plannedCodes.tierBonusRules);
  eventRuleCodes.push(...plannedCodes.promotionEventRules);

  for (const ruleCode of eventRuleCodes) {
    await scanEntityByCode(
      "eventRule",
      ruleCode,
      (code) => eventEngineManagementGetEventRuleByCode(code),
      () => null,
      codeToExisting,
      conflicts,
      wouldCreate,
      wouldSkip
    );
  }

  // Promotion event type configurations — separate from the base earn
  // rule's event type config (which has the `.config` suffix). These are
  // the scoped `<programCode>.<promoEventCode>` codes used directly as
  // both the config code and eventTypeCode on the promotion rule.
  for (const configCode of plannedCodes.promotionEventTypeConfigs) {
    await scanEntityByCode(
      "eventType",
      configCode,
      (code) => eventEngineManagementGetEventTypeConfigurationByCode(code),
      // Shape comparison deferred — the config's `name` and other fields
      // can drift across re-imports without semantic conflict.
      () => null,
      codeToExisting,
      conflicts,
      wouldCreate,
      wouldSkip
    );
  }

  // Promotion targets — only counter-target codes today; PR #494 extends
  // the planner to other kinds. Code-only match for now.
  for (const targetCode of plannedCodes.promotionTargets) {
    await scanEntityByCode(
      "target",
      targetCode,
      (code) => eventEngineManagementGetTargetByCode(code),
      () => null,
      codeToExisting,
      conflicts,
      wouldCreate,
      wouldSkip
    );
  }

  // Expiry and pending rules (list+filter fallback — no by-code endpoint)
  if (plannedCodes.expiryRule !== null) {
    const found = await findExpiryRuleByCode(plannedCodes.expiryRule);
    const ref: EntityRef = { type: "expiryRule", code: plannedCodes.expiryRule };
    if (found === null) {
      wouldCreate.push(ref);
    } else {
      codeToExisting.set(preScanKey("expiryRule", plannedCodes.expiryRule), found);
      classifyExisting(
        "expiryRule",
        ref,
        buildExpectedExpiryRuleShape(spec),
        found,
        wouldSkip,
        conflicts
      );
    }
  }
  if (plannedCodes.pendingRule !== null) {
    const found = await findPendingRuleByCode(plannedCodes.pendingRule);
    const ref: EntityRef = { type: "pendingRule", code: plannedCodes.pendingRule };
    if (found === null) {
      wouldCreate.push(ref);
    } else {
      codeToExisting.set(preScanKey("pendingRule", plannedCodes.pendingRule), found);
      classifyExisting(
        "pendingRule",
        ref,
        buildExpectedPendingRuleShape(spec),
        found,
        wouldSkip,
        conflicts
      );
    }
  }

  return { codeToExisting, conflicts, wouldCreate, wouldSkip };
}

// ────────────────────────────────────────────────────────────────
// Helper: scan one entity by code
// ────────────────────────────────────────────────────────────────

async function scanEntityByCode(
  type: EntityType,
  code: string | null,
  fetcher: (code: string) => Promise<{ data: unknown | void; status: number; headers: Headers }>,
  expectedShapeFn: () => unknown,
  codeToExisting: Map<PreScanKey, unknown>,
  conflicts: ConflictEntry[],
  wouldCreate: EntityRef[],
  wouldSkip: EntityRef[],
  name?: string
): Promise<void> {
  if (code === null) return;

  const existing = await tryGetByCode(() => fetcher(code));
  const ref: EntityRef = { type, code };
  if (name !== undefined) ref.name = name;

  if (existing === null) {
    wouldCreate.push(ref);
    return;
  }

  codeToExisting.set(preScanKey(type, code), existing);
  classifyExisting(type, ref, expectedShapeFn(), existing, wouldSkip, conflicts);
}

/**
 * Run shape-diff and sort the found entity into either `wouldSkip` (no
 * fatal mismatch) or `conflicts` (at least one fatal field differs).
 *
 * When `expected` is null, the caller has opted out of shape comparison
 * for this entity type (e.g. event rules where the expected payload
 * depends on runtime IDs). In that case we treat the match as
 * "code-only" and record a skip.
 */
function classifyExisting(
  type: EntityType,
  ref: EntityRef,
  expected: unknown,
  actual: unknown,
  wouldSkip: EntityRef[],
  conflicts: ConflictEntry[]
): void {
  if (expected === null) {
    wouldSkip.push(ref);
    return;
  }

  const diff = computeEntityShapeDiff(type, expected, actual);
  if (hasFatalDiff(diff)) {
    conflicts.push({ ref, kind: "shape-diff", diff });
    return;
  }

  wouldSkip.push(ref);
}

// ────────────────────────────────────────────────────────────────
// Expected shape builders
// ────────────────────────────────────────────────────────────────
// These produce the "expected" side of a shape-diff. They only include
// the fields listed in SHAPE_FIELDS for each entity type — no need to
// match every field the executor would send to the API.

function buildExpectedProgramShape(spec: ProgramSpec): Record<string, unknown> {
  // SCHEMA ALIGNMENT: the SDK's `Program.type` is a nested `Metadata`
  // object, not a flat `typeCode`. Mirror the nesting so shape-diff's
  // `"type.code"` lookup resolves. This was missed in the original
  // M1-M3 P0 #3 fix and surfaced by the correctness re-review.
  return {
    type: { code: spec.program.typeCode },
    createAccountOnCustomerCreation: spec.program.createAccountOnCustomerCreation ?? true,
    name: spec.program.name,
    description: spec.program.description,
  };
}

function buildExpectedCurrencyShape(
  spec: ProgramSpec,
  programId?: string
): Record<string, unknown> {
  // SCHEMA ALIGNMENT (post-M3 correctness review): the SDK's
  // ProgramCurrency returns `currencyType` as a nested Metadata object,
  // NOT a flat `currencyTypeCode`. The shape-diff SHAPE_FIELDS uses the
  // nested path `"currencyType.code"`, so the expected shape MUST
  // mirror the nesting.
  //
  // programIds is populated when the caller knows the programId (i.e.
  // after the program stage has completed and we're pre-scanning the
  // next run). Pre-scan with an unknown programId leaves it undefined
  // and relies on the deepEqual null-equivalence rule.
  return {
    currencyType: { code: spec.currency?.currencyTypeCode ?? "points" },
    ...(programId ? { programIds: [programId] } : {}),
    name: spec.currency?.name ?? `${spec.program.name ?? "Program"} Points`,
  };
}

function buildExpectedTierShape(spec: ProgramSpec, tierCode: string): Record<string, unknown> {
  // SCHEMA ALIGNMENT: the SDK's Tier interface has NO threshold field.
  // The "pointsThreshold" exists only in the wizard's WizardTier spec
  // as a proxy for the downstream CounterTarget's targetValue.
  //
  // Tier identity fields per the adversarial re-review: `rank` orders
  // tiers in the progression ladder, `subscription` gates them behind
  // paid access, `durationPeriod` is the tier lifetime. All three are
  // fatal in SHAPE_FIELDS. The expected rank mirrors the executor's
  // runCreatingTiers logic: tiers sorted ascending by pointsThreshold
  // get rank 1, 2, 3 in order. `subscription` and `durationPeriod`
  // default to undefined on WizardTier (the wizard doesn't surface
  // either today) — an existing tier with a truthy value for either
  // is a fatal mismatch, which is the correct safety behavior.
  const sortedTiers = [...(spec.tiers ?? [])].sort(
    (a, b) => (a.pointsThreshold ?? 0) - (b.pointsThreshold ?? 0)
  );
  const index = sortedTiers.findIndex((t) => t.code === tierCode);
  const tier = spec.tiers?.find((t) => t.code === tierCode);
  // `WizardTier` doesn't expose subscription or durationPeriod (the
  // wizard UI doesn't surface them today). Expected values are therefore
  // undefined — the shape-diff null-equivalence rule accepts an existing
  // tier whose response fields are also undefined/null, but FAILS
  // CLOSED on an existing tier that has `subscription: true` or a
  // non-null `durationPeriod`. That's the correct safety behavior:
  // reusing a subscription-gated tier in a non-subscription wizard run
  // is a semantic identity mismatch.
  return {
    code: tierCode,
    name: tier?.name,
    rank: index >= 0 ? index + 1 : undefined,
    subscription: undefined,
    durationPeriod: undefined,
  };
}

function buildExpectedBadgeShape(
  spec: ProgramSpec,
  badgeCode: string,
  programId?: string
): Record<string, unknown> {
  // SCHEMA ALIGNMENT: Badge's fatal identity is `programIds` — the
  // reviewer flagged that the old builder never populated it, so every
  // existing badge produced a false-positive conflict (expected had no
  // programIds, actual did). Pass the programId through from the
  // caller so the expected shape mirrors the real response.
  const badge = spec.badges?.find((b) => b.code === badgeCode);
  return {
    ...(programId ? { programIds: [programId] } : {}),
    name: badge?.name,
    description: badge?.description,
  };
}

function buildExpectedTargetShape(
  spec: ProgramSpec,
  targetCode: string,
  programId?: string
): Record<string, unknown> {
  // SCHEMA ALIGNMENT: CounterTarget returns `counterTargetType` as a
  // nested Metadata object, NOT a flat `counterTypeCode`. The
  // shape-diff SHAPE_FIELDS now uses the nested path
  // `"counterTargetType.code"`, so the expected shape must mirror
  // the nesting.
  const nonBaseTiers = getNonBaseTiers(spec.tiers);
  const programCode = spec.program.code ?? "program";
  const tier = nonBaseTiers.find(
    (t) => generateCode(`${programCode}-${t.code}-target`) === targetCode
  );

  const rawCounterTypeCode =
    tier?.counterTargetTypeCode ?? spec.currency?.currencyTypeCode ?? "POINTS_EARNED";
  const resolvedCounterTypeCode = rawCounterTypeCode.toUpperCase().replace(/-/g, "_");

  return {
    type: "COUNTER",
    counterTargetType: { code: resolvedCounterTypeCode },
    ...(programId ? { programIds: [programId] } : {}),
    targetValue: tier?.pointsThreshold ?? 0,
    name: tier ? `${tier.name} Progression Target` : undefined,
  };
}

function buildExpectedEventTypeShape(spec: ProgramSpec): Record<string, unknown> {
  // Only used for the event type CONFIGURATION match. The code is the
  // primary identifier; name is warning-level in SHAPE_FIELDS.
  const sanitized = sanitizeProgramCodeForEventType(spec.program.code);
  const template = spec.awardRule?.templateId ? getTemplateById(spec.awardRule.templateId) : null;
  const baseEventTypeCode = template?.eventTypeCode ?? "purchase";
  return {
    code: `${sanitized}.${baseEventTypeCode}.config`,
  };
}

function buildExpectedExpiryRuleShape(spec: ProgramSpec): Record<string, unknown> {
  return {
    type: spec.expiryRule?.type,
    expiryPeriod: spec.expiryRule?.expiryPeriod,
    expiryPeriodValue: spec.expiryRule?.expiryPeriodValue,
  };
}

function buildExpectedPendingRuleShape(spec: ProgramSpec): Record<string, unknown> {
  return {
    type: spec.pendingRule?.type,
    pendingPeriod: spec.pendingRule?.pendingPeriod,
    pendingPeriodValue: spec.pendingRule?.pendingPeriodValue,
  };
}

// ────────────────────────────────────────────────────────────────
// Expiry / pending rule list fallback
// ────────────────────────────────────────────────────────────────

/**
 * Expiry rules have no by-code endpoint (verified in P0.5b). Use the
 * paginated list API with client-side filter.
 *
 * For typical orgs this is a single page (<100 rules). For large orgs
 * we'd need to page — flagged as a perf follow-up in the Phase 0 doc.
 */
async function findExpiryRuleByCode(code: string): Promise<unknown | null> {
  try {
    const response = await programBankManagementListExpiryRules({ page: 0, size: 100 });
    const content = (response.data as { content?: Array<{ code?: string }> } | undefined)?.content;
    if (!Array.isArray(content)) return null;
    return content.find((r) => r.code === code) ?? null;
  } catch (err) {
    if (isUncertainError(err)) return null;
    throw err;
  }
}

async function findPendingRuleByCode(code: string): Promise<unknown | null> {
  try {
    const response = await programBankManagementListPendingRules({ page: 0, size: 100 });
    const content = (response.data as { content?: Array<{ code?: string }> } | undefined)?.content;
    if (!Array.isArray(content)) return null;
    return content.find((r) => r.code === code) ?? null;
  } catch (err) {
    if (isUncertainError(err)) return null;
    throw err;
  }
}
