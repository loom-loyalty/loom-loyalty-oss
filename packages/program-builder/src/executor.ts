/**
 * Program Executor
 *
 * The heart of @loom-loyalty/program-builder. Takes a `ProgramSpec` and an
 * `ExecutorContext` and creates every entity needed for a working loyalty
 * program. Both the Hub wizard and the AI onboarding agent call this —
 * neither one contains any stage orchestration logic of its own.
 *
 * DESIGN NOTES:
 * -------------
 * - Calls orval-generated raw async functions directly (not hooks). Those
 *   functions route through `sdkFetch` which reads its baseUrl and
 *   tokenProvider from either the active `runWithSdkContext` scope (Node,
 *   ai-server) or module-level state (browser, wizard).
 * - Strict replay mode only in this slice. Skip-existing comes in a
 *   follow-up commit and shares most of the stage bodies with a pre-scan
 *   on top — by design.
 * - `ctx.persist` is called after EVERY stage transition. This is the
 *   Codex Eng Finding 2 fix: without it, browser refresh mid-run loses all
 *   entity IDs and the resume flow can't find tierCodeToTargetId. The
 *   callback is fail-closed — if it throws, the executor aborts.
 * - All stage bodies match the wizard's existing
 *   `apps/hub/src/features/program-wizard/steps/fire-event-step.tsx` logic.
 *   The parity test suite asserts identical results across both execution
 *   paths. Do NOT drift the wizard's logic from here.
 */

import {
  customerCreateCustomer,
  customerStatusManagementCreateBadge,
  customerStatusManagementCreateTier,
  customerStatusManagementGetBadgeByCode,
  dataModelManagementCreateDataModel,
  dataModelManagementCreateDataModelType,
  eventEngineManagementCreateEventRule,
  eventEngineManagementCreateEventTypeAction,
  eventEngineManagementCreateEventTypeConfiguration,
  eventEngineManagementCreateTarget,
  eventEngineManagementGetTargetByCode,
  eventEnginePublishEvent,
  metadataManagementCreateDataType,
  metadataManagementCreateMetadata,
  metadataManagementCreateMetadataType,
  offerManagementCreateOffer,
  programBankManagementCreateExpiryRule,
  programBankManagementCreatePendingRule,
  programBankManagementCreateProgramCurrency,
  programManagementCreateProgram,
  EntityType as SdkEntityType,
  type CreateCompletionTarget,
  type CreateCounterTarget,
  type CreateCouponOffer,
  type CreateCouponOfferCouponDiscountType,
  type CreateCustomEvent,
  type CreateDataModelType,
  type CreateDataType,
  type CreateMetadata,
  type CreateMetadataTypeCategory,
  type CreateMilestoneTarget,
  type CreateXOfYTarget,
  type EventEnginePublishEventParams,
} from "@loom-loyalty/sdk";

import {
  buildCurrencyPayload,
  buildCustomerPayload,
  buildEventRulePayload,
  buildExpiryRulePayload,
  buildPendingRulePayload,
  buildProgramPayload,
  buildTestEventData,
  calculateExpectedPoints,
  generateCode,
} from "./api-converters";
import {
  getErrorMessage,
  getNonBaseTiers,
  getSortedTiers,
  ignoreIfExists,
  sanitizeProgramCodeForEventType,
  sanitizePromoEventCode,
  scopePromoEventTypeCode,
  toResourceCode,
  wrapApiCall,
} from "./execution-helpers";
import { validateProgramSpec } from "./linter";
import { preScanKey, runPreScan, type PreScanKey } from "./pre-scan";
import { programSpecSchema, type ProgramSpec, type WizardBadge } from "./spec";
import { getTemplateById } from "./templates";
import type {
  EntityRef,
  EntityType,
  ExecutionResults,
  ExecutionStage,
  ExecutorContext,
  ExecutorResult,
  LintViolation,
  ProgressEvent,
} from "./types";
import { ExecutorError } from "./types";

/**
 * The SDK's `CreateDataModelType.parentTypeReference` field is generated
 * from a drifted OpenAPI spec — the real wire field the platform binds is
 * `parentDataModelTypeCode` (see `CreateUpdateDataModelTypeData.java`).
 * Sending `parentTypeReference` is silently ignored by the API.
 */
type CreateDataModelTypeWithParent = CreateDataModelType & { parentDataModelTypeCode?: string };

/**
 * Look up an entity in the pre-scan map by type and code.
 *
 * Returns the raw entity object from the target env (the shape depends on
 * the entity type's API response), or null if the entity is not present
 * or `preScanMap` is null.
 *
 * The `preScanMap` is null when `replayMode === 'strict'`. In strict mode
 * every stage always creates. In skip-existing mode the map is populated
 * by `runPreScan` before the stage loop begins and every create stage
 * calls this helper first to short-circuit.
 */
function checkSkipExisting<T>(
  preScanMap: Map<PreScanKey, unknown> | null,
  type: EntityType,
  code: string
): T | null {
  if (!preScanMap) return null;
  const found = preScanMap.get(preScanKey(type, code));
  return found === undefined ? null : (found as T);
}

/**
 * Return the last element of whichever array was pushed to most recently.
 * Used when emitting a progress event for a stage that might have either
 * created OR skipped its entity.
 */
function lastOfEither(created: EntityRef[], skipped: EntityRef[]): EntityRef | undefined {
  // Peek at the top of each stack; return whichever is non-empty. When
  // both are non-empty we prefer `created` (the active stage's outcome
  // is usually the most recent push there).
  return created[created.length - 1] ?? skipped[skipped.length - 1];
}

// ────────────────────────────────────────────────────────────────
// Stage ordering
// ────────────────────────────────────────────────────────────────

/**
 * The canonical order in which the executor visits stages.
 *
 * MUST match the order the wizard's existing `EXECUTION_STAGES` array uses
 * in `apps/hub/src/features/program-wizard/steps/fire-event-step.tsx`.
 * The parity test suite compares both outputs — any drift is a bug.
 *
 * Skipped stages (per feature flags) are filtered from this list in
 * `computeActiveStages` below. The executor iterates the filtered list.
 */
const STAGE_ORDER: readonly Exclude<ExecutionStage, "idle" | "linting" | "complete" | "error">[] = [
  "creating-metadata",
  "creating-program",
  "creating-expiry-rule",
  "creating-pending-rule",
  "creating-currency",
  "creating-tiers",
  "creating-badges",
  "creating-tier-targets",
  "creating-event-type",
  "creating-award-rule",
  "creating-base-tier-rule",
  "creating-tier-progression-rules",
  "creating-tier-bonus-rules",
  "creating-signup-bonus",
  "creating-birthday-bonus",
  "creating-promotions",
  "creating-customer",
  "firing-event",
] as const;

// Display-name lookups live in `template-doc/standard-types.ts` so the
// Preview Sheet picker can import them without pulling the executor's
// SDK chain.

/**
 * Map a wizard event type field type to the API's data model type code.
 */
function mapFieldTypeToDataModelType(fieldType: string): string {
  switch (fieldType) {
    case "string":
      return "STRING";
    case "number":
      return "NUMBER";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATETIME";
    default:
      return "STRING";
  }
}

/**
 * Decide which stages should run for a given spec.
 *
 * Mirrors the wizard's `activeStages` filter in fire-event-step.tsx lines
 * 300-335. Any divergence breaks parity.
 */
export function computeActiveStages(
  spec: ProgramSpec,
  env: ExecutorContext["env"]
): ReadonlyArray<(typeof STAGE_ORDER)[number]> {
  const {
    selectedFeatures,
    tiers,
    badges,
    autoAwardBaseTier,
    existingCurrencyCode,
    existingCurrencyId,
  } = spec;

  const hasBadgesEnabled = !!selectedFeatures?.badges && (badges?.length ?? 0) > 0;
  const hasTierProgression =
    !!selectedFeatures?.tiers && (tiers?.filter((t) => t.pointsThreshold > 0).length ?? 0) > 0;
  // The creating-metadata stage handles three independent obligations:
  // explicit spec.metadata rows, derived BADGE_TYPE data type for badges,
  // and derived COUNTER_TARGET_TYPE entries for tier progression.
  const needsExplicitMetadata = (spec.metadata?.length ?? 0) > 0;
  const needsMetadataCreation = needsExplicitMetadata || hasBadgesEnabled || hasTierProgression;

  const isUsingExistingCurrency = !!existingCurrencyCode && !!existingCurrencyId;

  return STAGE_ORDER.filter((stage) => {
    if (stage === "creating-metadata" && !needsMetadataCreation) return false;
    if (
      stage === "creating-currency" &&
      (!selectedFeatures?.programCurrency || isUsingExistingCurrency)
    )
      return false;
    if (stage === "creating-expiry-rule" && !selectedFeatures?.expiry) return false;
    if (stage === "creating-pending-rule" && !selectedFeatures?.pending) return false;
    if (stage === "creating-tiers" && !selectedFeatures?.tiers) return false;
    if (stage === "creating-badges" && (!selectedFeatures?.badges || (badges?.length ?? 0) === 0))
      return false;
    if (
      stage === "creating-tier-targets" &&
      (!selectedFeatures?.tiers ||
        !tiers ||
        tiers.filter((t) => t.pointsThreshold > 0).length === 0)
    )
      return false;
    if (stage === "creating-base-tier-rule" && (!selectedFeatures?.tiers || !autoAwardBaseTier))
      return false;
    if (
      stage === "creating-tier-progression-rules" &&
      (!selectedFeatures?.tiers ||
        !tiers ||
        tiers.filter((t) => t.pointsThreshold > 0).length === 0)
    )
      return false;
    if (
      stage === "creating-tier-bonus-rules" &&
      (!selectedFeatures?.tiers ||
        !tiers ||
        // Match the per-tier skip predicate inside `runCreatingTierBonusRules`:
        // both must use `> 1.0`. Using `!== 1.0` here would advance the
        // progress bar through a stage that the inner loop silently skips
        // when every tier has `earnMultiplier <= 1.0` (e.g. 0.5 from a
        // future LLM-extracted prose like "earn slightly less").
        tiers.filter((t) => t.earnMultiplier !== undefined && t.earnMultiplier > 1.0).length === 0)
    )
      return false;
    if (stage === "creating-signup-bonus" && !selectedFeatures?.signupBonus) return false;
    if (stage === "creating-birthday-bonus" && !selectedFeatures?.birthdayBonus) return false;
    if (
      stage === "creating-promotions" &&
      (!selectedFeatures?.promotions || (spec.promotions?.length ?? 0) === 0)
    )
      return false;
    // Customer + firing-event only run in dev env (per S1.4 in the plan).
    // Prod runs skip them entirely — test data should not land in prod.
    if ((stage === "creating-customer" || stage === "firing-event") && env === "prod") return false;
    // Explicit opt-out wins. The linter's `missing-test-customer` rule
    // already rejected the partial-spec case (no flag + no testCustomer).
    if ((stage === "creating-customer" || stage === "firing-event") && spec.skipTestRun === true)
      return false;
    return true;
  });
}

// ────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────

/**
 * The executor's pre-flight: the structural parse, then the linter. Returns
 * the same violations `runProgramExecutor` would answer `lint-failed` with,
 * without touching the API, so a caller can refuse a spec before asking the
 * user to approve it.
 *
 * The structural parse is the LLM trust boundary: the AI onboarding agent
 * passes LLM-generated specs through `execute_program_spec` with a loose
 * passthrough schema. The linter assumes a well-typed spec; without this
 * parse, a malformed spec (wrong types, arrays where objects expected,
 * __proto__ keys) can crash the linter or slip past it into the API payload
 * builders. The wizard path also benefits: wizard state bugs surface as
 * structured violations.
 */
export function checkProgramSpec(
  spec: ProgramSpec,
  options: Pick<ExecutorContext, "requireExplicitMetadata"> = {}
): { ok: true } | { ok: false; violations: LintViolation[] } {
  const parseResult = programSpecSchema.safeParse(spec);
  if (!parseResult.success) {
    return {
      ok: false,
      violations: parseResult.error.issues.map((issue) => ({
        severity: "error" as const,
        code: "spec-shape-invalid",
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const lintResult = validateProgramSpec(spec, {
    requireExplicitMetadata: options.requireExplicitMetadata,
  });
  return lintResult.ok ? { ok: true } : { ok: false, violations: lintResult.violations };
}

/**
 * Execute a program spec against the API, creating every entity in the
 * correct order. Returns a structured `ExecutorResult` in every case —
 * success, lint-failed, conflict-diff, or aborted. Never throws to the
 * caller; the result carries any error.
 */
export async function runProgramExecutor(
  spec: ProgramSpec,
  ctx: ExecutorContext
): Promise<ExecutorResult> {
  // ─── 0-1. Structural validation + lint ──────────────────────
  const check = checkProgramSpec(spec, {
    requireExplicitMetadata: ctx.requireExplicitMetadata,
  });
  if (!check.ok) {
    return { status: "lint-failed", violations: check.violations };
  }

  // ─── 2. Pre-scan for skip-existing mode ────────────────────
  // The pre-scan's expected-shape builders (pre-scan.ts) and
  // SHAPE_FIELDS (shape-diff.ts) were aligned to the real SDK response
  // schemas in the M1-M3 PR: Program.type, ProgramCurrency.currencyType,
  // and CounterTarget.counterTargetType are all nested Metadata objects
  // resolved via dot-notation lookup in getField. Tier identity at the
  // shape-diff level is cosmetic (name only) — the fatal identity check
  // lives on the CounterTarget (targetValue). Skip-existing callers
  // should now get accurate conflict detection against real target env
  // responses.
  let preScanMap: Map<PreScanKey, unknown> | null = null;
  if (ctx.replayMode === "skip-existing") {
    const preScan = await runPreScan(spec);

    // Fatal conflicts short-circuit: no writes made, caller renders the
    // diff for user resolution. The wizard / AI chat surfaces a
    // PromotionDiff component populated from this result.
    if (preScan.conflicts.length > 0) {
      return {
        status: "conflict-diff",
        conflicts: preScan.conflicts,
        wouldCreate: preScan.wouldCreate,
        wouldSkip: preScan.wouldSkip,
      };
    }

    preScanMap = preScan.codeToExisting;
  }

  // ─── 3. Execute stages ──────────────────────────────────────
  const results: ExecutionResults = {};
  const created: EntityRef[] = [];
  const skipped: EntityRef[] = [];
  const tierCodeToTargetId = new Map<string, string>();
  // Every custom activity this run defines, for the customer-care registration
  // pass below. Accumulated at each creation site rather than derived from
  // `created`, because the promotion path records no `eventType` ref there and
  // a promotion's activity still needs offering to care agents (R18).
  const customActivityCodes = new Set<string>();
  let publishedEventTypeCode: string | undefined;
  let currentStage: ExecutionStage = "idle";

  const activeStages = computeActiveStages(spec, ctx.env);
  const totalStages = activeStages.length;

  function emitProgress(
    stage: ExecutionStage,
    action: ProgressEvent["action"],
    ref?: EntityRef,
    message?: string
  ): void {
    if (!ctx.onProgress) return;
    const idx = activeStages.indexOf(stage as (typeof STAGE_ORDER)[number]);
    const percent = totalStages > 0 ? Math.round((idx / totalStages) * 100) : 0;
    const event: ProgressEvent = {
      stage,
      action,
      percent,
    };
    if (ref !== undefined) event.ref = ref;
    if (message !== undefined) event.message = message;
    ctx.onProgress(event);
  }

  async function persist(): Promise<void> {
    if (!ctx.persist) return;
    try {
      // Sync the in-memory Map into the results object before persisting
      // so resume can reconstruct it. Note: this intentionally replaces
      // the field rather than merging, since it reflects the complete
      // set of known target IDs at the moment of persistence.
      if (tierCodeToTargetId.size > 0) {
        results.tierCodeToTargetId = Object.fromEntries(tierCodeToTargetId);
      }
      await ctx.persist({ ...results });
    } catch (err) {
      // Persistence failure is fail-closed per Codex Eng Finding 2 +
      // user TODO 3. The caller promised it would honor persistence;
      // failing to persist means the resume flow is broken, so we
      // refuse to continue creating entities we can't recover from.
      throw new ExecutorError(
        currentStage,
        null,
        err,
        `Failed to persist partial results: ${getErrorMessage(err)}`
      );
    }
  }

  try {
    for (const stage of activeStages) {
      currentStage = stage;
      emitProgress(stage, "started");

      switch (stage) {
        case "creating-metadata":
          await runCreatingMetadata(spec);
          // Metadata stages don't participate in skip-existing (dev-only).
          emitProgress(stage, "created");
          await persist();
          break;

        case "creating-program":
          await runCreatingProgram(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-expiry-rule":
          await runCreatingExpiryRule(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-pending-rule":
          await runCreatingPendingRule(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-currency":
          await runCreatingCurrency(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-tiers":
          await runCreatingTiers(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created");
          await persist();
          break;

        case "creating-badges":
          await runCreatingBadges(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created");
          await persist();
          break;

        case "creating-tier-targets":
          await runCreatingTierTargets(
            spec,
            results,
            created,
            skipped,
            tierCodeToTargetId,
            preScanMap
          );
          emitProgress(stage, "created");
          await persist();
          break;

        case "creating-event-type": {
          const eventTypeCode = await runCreatingEventType(
            spec,
            results,
            created,
            skipped,
            preScanMap,
            customActivityCodes
          );
          publishedEventTypeCode = eventTypeCode;
          emitProgress(stage, "created");
          await persist();
          break;
        }

        case "creating-award-rule":
          await runCreatingAwardRule(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-base-tier-rule":
          await runCreatingBaseTierRule(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-tier-progression-rules":
          await runCreatingTierProgressionRules(
            spec,
            results,
            created,
            skipped,
            tierCodeToTargetId,
            preScanMap
          );
          emitProgress(stage, "created");
          await persist();
          break;

        case "creating-tier-bonus-rules":
          await runCreatingTierBonusRules(
            spec,
            results,
            created,
            skipped,
            preScanMap,
            publishedEventTypeCode
          );
          emitProgress(stage, "created");
          await persist();
          break;

        case "creating-signup-bonus":
          await runCreatingSignupBonus(spec, results, created, skipped, preScanMap);
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-birthday-bonus":
          await runCreatingBirthdayBonus(
            spec,
            results,
            created,
            skipped,
            preScanMap,
            customActivityCodes
          );
          emitProgress(stage, "created", lastOfEither(created, skipped));
          await persist();
          break;

        case "creating-promotions":
          await runCreatingPromotions(
            spec,
            results,
            created,
            skipped,
            preScanMap,
            publishedEventTypeCode,
            customActivityCodes
          );
          emitProgress(stage, "created");
          await persist();
          break;

        case "creating-customer":
          // Customer stage is dev-only — skip-existing not applicable.
          await runCreatingCustomer(spec, results, created);
          emitProgress(stage, "created", created[created.length - 1]);
          await persist();
          break;

        case "firing-event":
          await runFiringEvent(spec, results, publishedEventTypeCode);
          emitProgress(stage, "created");
          await persist();
          break;
      }
    }

    // Make every custom activity this run created recordable by a care agent
    // without a further manual step. Runs once after all stages, so it covers
    // every place an event type gets created (the main event-type stage, the
    // birthday stage, and the promotion stages) through one code path.
    await registerCustomActivitiesForCare(customActivityCodes, created, emitProgress, currentStage);
    await persist();

    return { status: "success", created, skipped, results };
  } catch (err) {
    const execErr =
      err instanceof ExecutorError
        ? err
        : new ExecutorError(currentStage, null, err, getErrorMessage(err));
    emitProgress(currentStage, "errored", undefined, execErr.message);

    // Abort-path persist: the main loop calls persist() AFTER each
    // successful stage, but a mid-stage failure never triggered a
    // persist — so the caller's checkpoint was stale by one stage and
    // resume lost the partial state from the stage that actually
    // failed. The correctness reviewer flagged this as CRITICAL: a tier
    // target that was created inside `runCreatingTierTargets` but
    // failed before the stage finished would lose its targetId from
    // the persisted envelope, breaking resume. Fix: call persist() one
    // last time before returning aborted, inside its own try/catch so
    // a broken persist callback cannot mask the original ExecutorError.
    // The in-loop sync in `runCreatingTierTargets` (results.targetIds +
    // results.tierCodeToTargetId) guarantees that by the time we reach
    // this catch, `results` reflects every successfully-created target
    // in the failed stage.
    if (ctx.persist) {
      try {
        // Mirror the inner `persist()` closure's Map-sync: replay the
        // tierCodeToTargetId into results before the final write so
        // resume can reconstruct the in-flight state. We call
        // ctx.persist directly (not the inner closure) because the
        // inner closure rethrows as ExecutorError, which would clobber
        // the real execErr we're trying to surface.
        if (tierCodeToTargetId.size > 0) {
          results.tierCodeToTargetId = Object.fromEntries(tierCodeToTargetId);
        }
        await ctx.persist({ ...results });
      } catch (persistErr) {
        // Log via progress event with a clear indicator — the caller's
        // persist is broken, but the original error is what they care
        // about. Don't swallow the executor error for a persist bug.
        emitProgress(
          currentStage,
          "errored",
          undefined,
          `persist-on-abort failed: ${getErrorMessage(persistErr)}; original error: ${execErr.message}`
        );
      }
    }

    return {
      status: "aborted",
      stage: currentStage,
      error: execErr,
      partialResults: results,
    };
  }
}

/**
 * Register every custom activity this run created for the customer-care surface.
 *
 * A new vertical's activities are exactly the ones a care agent will need to
 * record by hand, and the registry starts with no care rows at all — so a
 * program built through the wizard would otherwise ship with an empty care
 * picker. Every custom activity is registered without filtering by kind:
 * coverage on day one matters more than a list that stays tidy on its own, and
 * there is no builder-side rule to get wrong. An administrator prunes anything
 * that should not be hand-recorded.
 *
 * A registration is a convenience, not the deliverable — the program is. A
 * failure here is therefore reported through the progress channel and does not
 * fail program creation.
 *
 * Successful registrations are appended to `created` so the caller's rollback
 * path removes them when a run is rolled back.
 */
async function registerCustomActivitiesForCare(
  customActivityCodes: Set<string>,
  created: EntityRef[],
  emitProgress: (
    stage: ExecutionStage,
    action: ProgressEvent["action"],
    ref?: EntityRef,
    message?: string
  ) => void,
  stage: ExecutionStage
): Promise<void> {
  for (const eventTypeCode of customActivityCodes) {
    try {
      const response = await eventEngineManagementCreateEventTypeAction({
        eventTypeCode,
        surfaces: ["CUSTOMER_CARE"],
      });
      if (response.status === 200 && response.data?.eventTypeActionId) {
        created.push({
          type: "eventTypeAction",
          id: response.data.eventTypeActionId,
          code: eventTypeCode,
          name: `Customer care: ${eventTypeCode}`,
        });
      } else {
        emitProgress(
          stage,
          "created",
          undefined,
          `Could not offer "${eventTypeCode}" to customer care (status ${String(response.status)}). The program was created; an administrator can add it in the registry.`
        );
      }
    } catch (err) {
      emitProgress(
        stage,
        "created",
        undefined,
        `Could not offer "${eventTypeCode}" to customer care: ${getErrorMessage(err)}. The program was created; an administrator can add it in the registry.`
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Stage implementations
// ────────────────────────────────────────────────────────────────

async function runCreatingMetadata(spec: ProgramSpec): Promise<void> {
  // Metadata creations use `ignoreIfExists` because metadata types and
  // metadata instances are SHARED across programs in the same org. On a
  // retry after partial failure, or when concurrent runs race here, the
  // duplicate must be treated as success.

  // 1. Iterate spec.metadata explicitly — TYPE-only rows (no `code`) call
  //    create-metadata-type; instance rows call create-metadata. There is
  //    no implicit auto-creation from program/currency typeCodes anymore.
  for (const record of spec.metadata ?? []) {
    if (record.code === undefined || record.code === "") {
      try {
        // SDK narrows category to a closed enum; spec keeps it open for
        // future categories — runtime accepts any string, so cast at the
        // boundary instead of mirroring the enum across packages.
        await wrapApiCall(`Failed to create metadata type "${record.typeCode}"`, () =>
          metadataManagementCreateMetadataType({
            category: record.category as CreateMetadataTypeCategory,
            code: record.typeCode,
            name: record.name,
            ...(record.description ? { description: { en: record.description } } : {}),
          })
        );
      } catch (err) {
        ignoreIfExists(err, `metadata type "${record.typeCode}"`);
      }
      continue;
    }
    try {
      await wrapApiCall(`Failed to create ${record.typeCode} metadata "${record.code}"`, () =>
        metadataManagementCreateMetadata({
          typeCode: record.typeCode,
          code: record.code!,
          name: record.name,
        })
      );
    } catch (err) {
      ignoreIfExists(err, `${record.typeCode} metadata "${record.code}"`);
    }
  }

  // 2. BADGE_TYPE data type (required before badges can be created)
  if (spec.selectedFeatures?.badges && (spec.badges?.length ?? 0) > 0) {
    try {
      const badgeDataTypePayload: CreateDataType = {
        typeCode: "BADGE_TYPE",
        code: "ACHIEVEMENT",
        name: "Achievement Badge",
        dataModelCode: "BADGE",
      };
      await wrapApiCall("Failed to create BADGE_TYPE data type ACHIEVEMENT", () =>
        metadataManagementCreateDataType(badgeDataTypePayload)
      );
    } catch (err) {
      ignoreIfExists(err, "BADGE_TYPE data type ACHIEVEMENT");
    }
  }

  // 3. COUNTER_TARGET_TYPE metadata for tier progression
  if (spec.selectedFeatures?.tiers) {
    const nonBaseTiers = getNonBaseTiers(spec.tiers);
    const counterTypeCodes = new Set<string>();
    for (const tier of nonBaseTiers) {
      const code = tier.counterTargetTypeCode ?? spec.currency?.currencyTypeCode ?? "POINTS_EARNED";
      counterTypeCodes.add(code.toUpperCase().replace(/-/g, "_"));
    }
    for (const code of counterTypeCodes) {
      try {
        const counterTypePayload: CreateMetadata = {
          typeCode: "COUNTER_TARGET_TYPE",
          code,
          name: code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " "),
        };
        await wrapApiCall(`Failed to create COUNTER_TARGET_TYPE metadata "${code}"`, () =>
          metadataManagementCreateMetadata(counterTypePayload)
        );
      } catch (err) {
        ignoreIfExists(err, `COUNTER_TARGET_TYPE ${code}`);
      }
    }
  }
}

async function runCreatingProgram(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const code = spec.program.code ?? "";

  // Skip-existing short-circuit: if the pre-scan already found this
  // program in the target env, pull its ID from the existing entity
  // and record the skip.
  const existing = checkSkipExisting<{ programId?: string }>(preScanMap, "program", code);
  if (existing) {
    const programId = existing.programId;
    if (!programId) {
      throw new Error("Existing program matched by code but has no programId");
    }
    results.programId = programId;
    // Surface programCode here too so callers can trust the field on
    // both create and adopt paths.
    results.programCode = code;
    skipped.push({
      type: "program",
      id: programId,
      code,
      ...(spec.program.name !== undefined && { name: spec.program.name }),
    });
    return;
  }

  const payload = buildProgramPayload(spec);
  const response = await wrapApiCall("Failed to create program", () =>
    programManagementCreateProgram(payload)
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create program (status ${String(response.status)})`);
  }
  const programId = response.data.programId;
  if (!programId) {
    throw new Error("Program created but server returned no programId");
  }
  results.programId = programId;
  // `?? code` is defensive — `Program.code` is non-optional in the SDK
  // schema, the fallback only fires on a contract violation.
  results.programCode = response.data.code ?? code;
  created.push({
    type: "program",
    id: programId,
    code,
    ...(spec.program.name !== undefined && { name: spec.program.name }),
  });
}

async function runCreatingExpiryRule(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for expiry rule");

  const payload = buildExpiryRulePayload(spec, programId);
  if (!payload) return;

  const existing = checkSkipExisting<{ expiryRuleId?: string }>(
    preScanMap,
    "expiryRule",
    payload.code
  );
  if (existing) {
    const expiryRuleId = existing.expiryRuleId;
    if (expiryRuleId) {
      results.expiryRuleId = expiryRuleId;
      skipped.push({ type: "expiryRule", id: expiryRuleId, code: payload.code });
      return;
    }
    // No ID on the existing record — fall through and create.
  }

  const response = await wrapApiCall("Failed to create expiry rule", () =>
    programBankManagementCreateExpiryRule(payload)
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create expiry rule (status ${String(response.status)})`);
  }
  const expiryRuleId = response.data.expiryRuleId;
  if (!expiryRuleId) {
    throw new Error("Expiry rule created but server returned no expiryRuleId");
  }
  results.expiryRuleId = expiryRuleId;
  created.push({ type: "expiryRule", id: expiryRuleId, code: payload.code });
}

async function runCreatingPendingRule(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for pending rule");

  const payload = buildPendingRulePayload(spec, programId);
  if (!payload) return;

  const existing = checkSkipExisting<{ pendingRuleId?: string }>(
    preScanMap,
    "pendingRule",
    payload.code
  );
  if (existing) {
    const pendingRuleId = existing.pendingRuleId;
    if (pendingRuleId) {
      results.pendingRuleId = pendingRuleId;
      skipped.push({ type: "pendingRule", id: pendingRuleId, code: payload.code });
      return;
    }
  }

  const response = await wrapApiCall("Failed to create pending rule", () =>
    programBankManagementCreatePendingRule(payload)
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create pending rule (status ${String(response.status)})`);
  }
  const pendingRuleId = response.data.pendingRuleId;
  if (!pendingRuleId) {
    throw new Error("Pending rule created but server returned no pendingRuleId");
  }
  results.pendingRuleId = pendingRuleId;
  created.push({ type: "pendingRule", id: pendingRuleId, code: payload.code });
}

async function runCreatingCurrency(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for currency");

  const payload = buildCurrencyPayload(
    spec,
    programId,
    results.expiryRuleId,
    results.pendingRuleId
  );

  const existing = checkSkipExisting<{ programCurrencyId?: string }>(
    preScanMap,
    "currency",
    payload.code
  );
  if (existing) {
    const currencyId = existing.programCurrencyId;
    if (currencyId) {
      results.currencyId = currencyId;
      skipped.push({
        type: "currency",
        id: currencyId,
        code: payload.code,
        name: payload.name,
      });
      return;
    }
  }

  const response = await wrapApiCall("Failed to create currency", () =>
    programBankManagementCreateProgramCurrency(payload)
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create currency (status ${String(response.status)})`);
  }
  const currencyId = response.data.programCurrencyId;
  if (!currencyId) {
    throw new Error("Currency created but server returned no programCurrencyId");
  }
  results.currencyId = currencyId;
  results.currencyCode = payload.code;
  created.push({ type: "currency", id: currencyId, code: payload.code, name: payload.name });
}

async function runCreatingTiers(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for tiers");

  // SORT tiers ascending so rank 1 is always the lowest threshold.
  // Without this the wizard's old bug returns: users add tiers in arbitrary
  // order in the UI and the base tier ends up at the wrong rank.
  const sortedTiers = getSortedTiers(spec.tiers);
  const tierCodes: string[] = [];

  for (let i = 0; i < sortedTiers.length; i++) {
    const tierData = sortedTiers[i];
    if (!tierData) continue;

    // Per-tier skip-existing check. Tiers are addressed by code so the
    // "id" field on the skipped EntityRef is omitted (tier has no tierId).
    const existingTier = checkSkipExisting<{ code?: string }>(preScanMap, "tier", tierData.code);
    if (existingTier) {
      tierCodes.push(existingTier.code ?? tierData.code);
      skipped.push({ type: "tier", code: tierData.code, name: tierData.name });
      continue;
    }

    const tierPayload = {
      code: tierData.code,
      name: tierData.name,
      rank: i + 1,
      programIds: [programId],
      description: tierData.description ? { en: tierData.description } : undefined,
    };

    const response = await wrapApiCall(`Failed to create tier "${tierData.name}"`, () =>
      customerStatusManagementCreateTier(tierPayload)
    );
    if (response.status !== 200 || !response.data) {
      throw new Error(
        `Failed to create tier "${tierData.name}" (status ${String(response.status)})`
      );
    }
    tierCodes.push(response.data.code);
    created.push({ type: "tier", code: tierData.code, name: tierData.name });
  }

  results.tierCodes = tierCodes;
}

async function runCreatingBadges(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for badges");

  const badgeIds: string[] = [];
  const badges = spec.badges ?? [];

  for (const badgeData of badges) {
    // Per-badge skip-existing check.
    const existingBadge = checkSkipExisting<{ badgeId?: string }>(
      preScanMap,
      "badge",
      badgeData.code
    );
    if (existingBadge) {
      const badgeId = existingBadge.badgeId;
      if (badgeId) {
        badgeIds.push(badgeId);
        skipped.push({
          type: "badge",
          id: badgeId,
          code: badgeData.code,
          name: badgeData.name,
        });
        continue;
      }
      // Pre-scan found the badge but it had no badgeId — fall through
      // and create. The backend will surface a 409 if it really exists.
    }

    const badgePayload = {
      code: badgeData.code,
      name: badgeData.name,
      typeCode: "ACHIEVEMENT",
      programIds: [programId],
      description: badgeData.description ? { en: badgeData.description } : undefined,
    };

    try {
      const response = await wrapApiCall(`Failed to create badge "${badgeData.name}"`, () =>
        customerStatusManagementCreateBadge(badgePayload)
      );
      if (response.status !== 200 || !response.data) {
        throw new Error(
          `Failed to create badge "${badgeData.name}" (status ${String(response.status)})`
        );
      }
      const badgeId = response.data.badgeId;
      if (!badgeId) {
        throw new Error(`Badge "${badgeData.name}" created but server returned no badgeId`);
      }
      badgeIds.push(badgeId);
      created.push({ type: "badge", id: badgeId, code: badgeData.code, name: badgeData.name });
    } catch (err) {
      // 409 recovery: when the badge already exists (prior aborted run
      // in the same org), `ignoreIfExists` rethrows anything that isn't
      // a 409. If we reach the next line, it WAS a 409 — so the badge
      // exists server-side and we need its ID to (a) track it for
      // rollback and (b) surface it in the success summary. Fetch via
      // by-code and push the recovered ID to the results. Without this,
      // the wizard would silently "succeed" with no badge in the UI
      // and rollback would orphan the badge entirely.
      ignoreIfExists(err, `badge "${badgeData.name}"`);
      try {
        const recovery = await customerStatusManagementGetBadgeByCode(badgeData.code);
        if (recovery.status === 200 && recovery.data?.badgeId) {
          const badgeId = recovery.data.badgeId;
          badgeIds.push(badgeId);
          skipped.push({ type: "badge", id: badgeId, code: badgeData.code, name: badgeData.name });
        }
      } catch {
        // By-code lookup itself failed. Leave the badge out of results —
        // the wizard's subsequent stages don't depend on badgeIds, so
        // this degrades gracefully. The caller's rollback walker won't
        // touch this badge (it's not in the log), but the run still
        // completes. Logged at debug level only to avoid scary output
        // for an already-recovered-path.
      }
    }
  }

  results.badgeIds = badgeIds;
}

async function runCreatingTierTargets(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  tierCodeToTargetId: Map<string, string>,
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for tier targets");

  // Future-resume hook: seed the in-memory Map from any persisted state.
  //
  // CURRENT STATE (honest): `runProgramExecutor` always initializes
  // `const results: ExecutionResults = {}` at entry and takes no
  // `initialResults` parameter, so on a fresh executor invocation
  // `results.tierCodeToTargetId` is always undefined and this seed
  // loop is a no-op. The correctness re-reviewer flagged this as
  // unreachable dead code — it is. It stays deliberately because:
  //   1. The abort-path persist (the P0 #2 fix) writes
  //      `results.tierCodeToTargetId` on every failure, so the
  //      persistence envelope IS populated. The caller just can't
  //      feed it back in yet.
  //   2. Adding an `initialResults` parameter to `runProgramExecutor`
  //      is the proper fix to enable resume, but it's a public-API
  //      change that belongs in the wizard-resume work (see TODOS.md
  //      "Wizard mid-run resume from persisted envelope").
  //   3. Removing this block would require re-adding it when resume
  //      lands. Leaving it with an honest comment preserves the hook
  //      without misleading future readers.
  if (results.tierCodeToTargetId) {
    for (const [code, id] of Object.entries(results.tierCodeToTargetId)) {
      tierCodeToTargetId.set(code, id);
    }
  }

  const targetIds: string[] = [];
  const nonBaseTiers = getNonBaseTiers(spec.tiers);

  for (const tierData of nonBaseTiers) {
    const targetCode = generateCode(`${spec.program.code ?? "program"}-${tierData.code}-target`);

    // Resume-path shortcut: if we already have an ID for this tier from a
    // prior attempt, skip the create call entirely.
    if (tierCodeToTargetId.has(tierData.code)) {
      const existingId = tierCodeToTargetId.get(tierData.code);
      if (existingId) targetIds.push(existingId);
      continue;
    }

    // Skip-existing check: the pre-scan may have found this target already.
    const existingTarget = checkSkipExisting<{ targetId?: string }>(
      preScanMap,
      "target",
      targetCode
    );
    if (existingTarget) {
      const targetId = existingTarget.targetId;
      if (targetId) {
        targetIds.push(targetId);
        tierCodeToTargetId.set(tierData.code, targetId);
        skipped.push({ type: "target", id: targetId, code: targetCode, name: tierData.name });
        continue;
      }
    }

    const rawCounterTypeCode =
      tierData.counterTargetTypeCode ?? spec.currency?.currencyTypeCode ?? "POINTS_EARNED";
    const resolvedCounterTypeCode = rawCounterTypeCode.toUpperCase().replace(/-/g, "_");

    const targetPayload: CreateCounterTarget = {
      code: targetCode,
      name: `${tierData.name} Progression Target`,
      programIds: [programId],
      scope: "GLOBAL",
      type: "COUNTER",
      targetValue: tierData.pointsThreshold,
      counterTargetTypeCode: resolvedCounterTypeCode,
    };

    let targetId: string | undefined;
    let fromExistingLookup = false;
    try {
      const response = await wrapApiCall(
        `Failed to create target for tier "${tierData.name}"`,
        () =>
          eventEngineManagementCreateTarget(
            targetPayload as Parameters<typeof eventEngineManagementCreateTarget>[0]
          )
      );
      if (response.status !== 200 || !response.data) {
        throw new Error(
          `Failed to create target for tier "${tierData.name}" (status ${String(response.status)})`
        );
      }
      targetId = response.data.targetId;
    } catch (err) {
      // `ignoreIfExists` rethrows anything that isn't a 409. If it returns,
      // the target already exists — but we do NOT yet know its server-side
      // ID. Previously this branch hit `continue` without setting
      // tierCodeToTargetId, which caused runCreatingTierProgressionRules
      // to build rules with no `promotionTargetId` and break tier
      // progression for every retry-after-partial-failure flow (correctness
      // + adversarial reviewers both flagged this as P0/CRITICAL).
      //
      // The fix: on 409, look up the existing target by code and adopt
      // its id. CRITICAL: the recovery path MUST assert that the existing
      // target belongs to this run's program (`existing.programIds`
      // contains `programId`). An orphan target from a deleted program
      // can coincidentally share the same code (dev environments where
      // programs are torn down but children leak). Without the ownership
      // check, the tier progression rule would reference a target that
      // belongs to a DIFFERENT program — silent cross-program
      // contamination, flagged as P1 in the adversarial re-review.
      ignoreIfExists(err, `target ${targetCode}`);
      const targetRef: EntityRef = { type: "target", code: targetCode, name: tierData.name };
      try {
        const lookup = await eventEngineManagementGetTargetByCode(targetCode);
        if (lookup.status !== 200 || !lookup.data) {
          throw new Error(
            `Target ${targetCode} reported as already existing, but get-by-code returned status ${lookup.status}`
          );
        }
        const existing = lookup.data as {
          targetId?: string;
          counterTargetId?: string;
          programIds?: string[];
        };
        // Ownership check — fail-closed on cross-program collisions.
        if (!Array.isArray(existing.programIds) || !existing.programIds.includes(programId)) {
          throw new Error(
            `Target ${targetCode} exists but is not associated with program ${programId} (programIds=${JSON.stringify(existing.programIds ?? null)}). Refusing to bind a cross-program target — either the pre-scan found an orphan from a deleted program, or another org has created a target with the same code.`
          );
        }
        targetId = existing.targetId ?? existing.counterTargetId;
        if (!targetId) {
          throw new Error(
            `Target ${targetCode} already exists but neither targetId nor counterTargetId was returned by get-by-code`
          );
        }
        fromExistingLookup = true;
      } catch (lookupErr) {
        // Re-throw as an ExecutorError with a populated ref so the UI
        // and log scrapers see the failing target code. The outer catch
        // in runProgramExecutor's main try/catch passes ExecutorError
        // instances through unchanged (see `err instanceof ExecutorError`).
        const lookupMsg = lookupErr instanceof Error ? lookupErr.message : String(lookupErr);
        throw new ExecutorError(
          "creating-tier-targets",
          targetRef,
          lookupErr,
          `Target ${targetCode} creation failed with 409 conflict, but recovery via get-by-code also failed: ${lookupMsg}`
        );
      }
    }

    if (!targetId) {
      throw new Error(`Target created for tier ${tierData.name} but server returned no targetId`);
    }
    targetIds.push(targetId);
    tierCodeToTargetId.set(tierData.code, targetId);
    // Abort-path persist fix: sync results INSIDE the loop so a mid-stage
    // failure (e.g. tier 3 of 5 throws a 500 on create) still captures the
    // targetIds for tiers 1-2 in `results.tierCodeToTargetId`. The outer
    // catch can then persist the partial state before returning aborted,
    // and resume paths can read the partial Map without losing already-
    // created targets. Previously this only happened after the loop.
    results.targetIds = [...targetIds];
    results.tierCodeToTargetId = Object.fromEntries(tierCodeToTargetId);
    if (fromExistingLookup) {
      // The target existed before this run — record as skipped rather
      // than created so the caller's UI reflects reality.
      skipped.push({ type: "target", id: targetId, code: targetCode, name: tierData.name });
    } else {
      created.push({ type: "target", id: targetId, code: targetCode, name: tierData.name });
    }
  }

  // Final assignment is redundant with the in-loop sync above, but keeping
  // it as a belt-and-suspenders guarantee in case the loop body is
  // refactored to skip the in-loop assignment.
  results.targetIds = targetIds;
  results.tierCodeToTargetId = Object.fromEntries(tierCodeToTargetId);
}

/**
 * The platform's system base type for custom events.
 *
 * It declares the real event envelope fields (eventTypeCode, eventDateTime,
 * description, lineItems). Without it as the parent, a generated JSON schema
 * carries only its own elements plus additionalProperties:false, so the event
 * engine's hard validation rejects the envelope fields as unknown on publish.
 *
 * KEBAB-CASE, matching the platform's resource-code convention. An organization
 * is seeded with `custom-event`; the old `CUSTOM_EVENT` spelling 404s against a
 * platform carrying the convention change, and the wizard then cannot create a
 * custom event type at all.
 *
 * Sequenced with the backend: this must land alongside the platform image that
 * ships the convention, because the two spellings 404 against each other. If
 * this file and the running platform ever disagree, that is the symptom.
 */
const CUSTOM_EVENT_PARENT_TYPE_CODE = "custom-event";

/**
 * System data model type for transaction-shaped events (purchases, visits --
 * anything with an amount/date, descending from EVENT the same way
 * custom-event does, but pre-defining the transaction-specific fields
 * (eligibleAmount, transactionDateTime, etc.) that custom-event does not).
 * A data model created under custom-event only has whatever elements are
 * explicitly declared for it plus the base event envelope -- it does NOT
 * inherit these fields, so a transactional event's real payload 400s against
 * it with "property 'eligibleAmount' is not defined in the schema and the
 * schema does not allow additional properties" (confirmed live).
 */
const TRANSACTION_PARENT_TYPE_CODE = "transaction";

/**
 * The birthday campaign event's DataModelType code.
 *
 * Declared once because three calls have to agree on it: the DataModelType
 * create, the DataModel that references that type, and the EVENT_TYPE data type
 * that references that DataModel. They previously disagreed — the type was
 * created as `birthday` while the other two still referenced `BIRTHDAY`. A type
 * code resolves by exact match, so those references miss on any tenant that does
 * not already carry the uppercase spelling, and provisioning throws.
 *
 * Always derive it through `toResourceCode` so the value stays convention-
 * compliant everywhere it is referenced.
 */
const BIRTHDAY_TYPE_CODE = toResourceCode("birthday");

async function runCreatingEventType(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null,
  customActivityCodes: Set<string>
): Promise<string> {
  // Two flows: custom event type (event-based programs) vs synthesized
  // per-program event type (transactional programs). Faithful port of the
  // wizard's logic from fire-event-step.tsx:740-928.
  //
  // The EVENT_TYPE metadata type itself is seeded by platform org init —
  // every org has it by the time the wizard runs. We skip create here
  // because the platform leaks the unique-constraint violation as a 500
  // (not 409), which the strict isExistsError check intentionally won't
  // swallow.

  if (spec.eventType) {
    // ─── Event-based: user-provided custom event type ───
    let dataModelId: string | undefined;

    if (spec.eventType.useExisting) {
      // Reusing an event type that already exists -- a pre-seeded system
      // type (e.g. "check-in", added for TRMNL device check-ins -- see
      // SystemDataModelType.CHECK_IN) or a custom type another program
      // already created. Its DataModelType/DataModel/EVENT_TYPE data type
      // all already exist; creating them again would either 409/500 as a
      // reserved-code violation (system types) or be redundant (existing
      // custom types). Only the EventTypeConfiguration registration below
      // is genuinely per-program-setup, so that's the only call made here.
    } else {
      // The linter validates field.name via eventDataFieldSchema (z.string().min(1)).
      // If we reach here, all fields have valid names.
      const elements = spec.eventType.dataFields.map((field) => ({
        inputAttribute: field.name,
        outputAttribute: field.name,
        name: field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, " $1"),
        typeCode: mapFieldTypeToDataModelType(field.type),
        required: field.required,
      }));

      // The data-model side needs a RESOURCE code, which is a different namespace
      // from the event-type code. Event type codes are dot-namespaced
      // (`myprogram.purchase`) and are not part of the resource-code migration;
      // DataModelType.code must be hyphen-separated lowercase, so a dotted or
      // uppercase event code 400s when reused verbatim. The two stay linked through
      // the EVENT_TYPE data type's separate `dataModelCode` field below, so they no
      // longer have to be the same string.
      const eventDataModelTypeCode = toResourceCode(spec.eventType.code);

      // Register the DataModelType first — DataModel create requires it.
      try {
        const eventDataModelTypePayload: CreateDataModelTypeWithParent = {
          code: eventDataModelTypeCode,
          name: spec.eventType.name,
          description: spec.eventType.description ? { en: spec.eventType.description } : undefined,
          parentDataModelTypeCode: CUSTOM_EVENT_PARENT_TYPE_CODE,
        };
        await wrapApiCall(`Failed to create data model type "${spec.eventType.code}"`, () =>
          dataModelManagementCreateDataModelType(eventDataModelTypePayload)
        );
      } catch (err) {
        ignoreIfExists(err, `data model type ${spec.eventType.code}`);
      }

      const dataModelPayload = {
        typeCode: eventDataModelTypeCode,
        elements,
      };
      try {
        const dataModelResponse = await wrapApiCall(
          `Failed to create data model "${spec.eventType.code}"`,
          () => dataModelManagementCreateDataModel(dataModelPayload)
        );
        if (dataModelResponse.status !== 200 || !dataModelResponse.data) {
          throw new Error(
            `Failed to create data model "${spec.eventType.code}" (status ${String(dataModelResponse.status)})`
          );
        }
        dataModelId = dataModelResponse.data.dataModelId;
      } catch (err) {
        ignoreIfExists(err, `data model ${spec.eventType.code}`);
      }

      // Create EVENT_TYPE data type value — links the event type code to
      // its DataModel schema. Required before EventTypeConfiguration.
      try {
        await wrapApiCall(`Failed to create EVENT_TYPE data type "${spec.eventType.code}"`, () =>
          metadataManagementCreateDataType({
            typeCode: "EVENT_TYPE",
            // `code` stays the event-type code; only the data-model link uses the
            // resource code.
            code: spec.eventType!.code,
            name: spec.eventType!.name,
            dataModelCode: eventDataModelTypeCode,
          })
        );
      } catch (err) {
        ignoreIfExists(err, `EVENT_TYPE data type ${spec.eventType.code}`);
      }
    }

    // Offer this activity to care agents once it exists (R18). Recorded here
    // rather than derived from `created` because not every creation site logs an
    // `eventType` ref — the promotion path deliberately does not.
    customActivityCodes.add(spec.eventType.code);

    // Create EventTypeConfiguration — required for the event engine to
    // recognize this event type code when events are published. Without
    // this, publishEvent fails with "EventType 'xxx' unable to be resolved"
    // on fresh tenants that don't have pre-seeded EventTypeConfigurations.
    try {
      const configResponse = await wrapApiCall(
        `Failed to create event type configuration "${spec.eventType.code}"`,
        () =>
          eventEngineManagementCreateEventTypeConfiguration({
            code: spec.eventType!.code,
            eventTypeCode: spec.eventType!.code,
            name: spec.eventType!.name,
            saveUnprocessedEvent: false,
          })
      );
      if (configResponse.status === 200 && configResponse.data?.eventTypeConfigurationId) {
        results.eventTypeId = configResponse.data.eventTypeConfigurationId;
        created.push({
          type: "eventType",
          id: configResponse.data.eventTypeConfigurationId,
          code: spec.eventType.code,
          name: spec.eventType.name,
        });
      }
    } catch (err) {
      // If the config already exists (e.g., re-run on same tenant),
      // best-effort: use dataModelId for results.eventTypeId if available.
      // On a true re-run where DataModel also hit ignoreIfExists,
      // dataModelId may be undefined and eventTypeId stays unset. This is
      // harmless — no downstream consumer currently reads it.
      ignoreIfExists(err, `event type configuration ${spec.eventType.code}`);
      if (dataModelId) {
        results.eventTypeId = dataModelId;
        created.push({
          type: "eventType",
          id: dataModelId,
          code: spec.eventType.code,
          name: spec.eventType.name,
        });
      }
    }

    return spec.eventType.code;
  }

  // ─── Transactional: synthesize per-program event type ───
  const sanitizedProgramCode = sanitizeProgramCodeForEventType(spec.program.code);
  const template = spec.awardRule.templateId ? getTemplateById(spec.awardRule.templateId) : null;
  const baseEventTypeCode = template?.eventTypeCode ?? "purchase";
  const eventTypeCode = `${sanitizedProgramCode}.${baseEventTypeCode}`;
  // Resource-code shape, not UPPER_SNAKE. DataModelType.code is validated
  // against ^[a-z0-9]+(?:-[a-z0-9]+)*$, so the previous
  // `.toUpperCase().replace(/[.-]/g, "_")` produced a code the API rejects
  // outright — uppercase and underscores both fail the pattern.
  const dataModelCode = toResourceCode(`${sanitizedProgramCode}-${baseEventTypeCode}`);
  const eventName = `${baseEventTypeCode.charAt(0).toUpperCase() + baseEventTypeCode.slice(1)} Event`;

  // 1. Create the DataModelType first
  try {
    const transactionalDataModelTypePayload: CreateDataModelTypeWithParent = {
      code: dataModelCode,
      name: `${baseEventTypeCode.charAt(0).toUpperCase() + baseEventTypeCode.slice(1)} Event Schema`,
      description: {
        en: `Schema for ${baseEventTypeCode} events in the ${spec.program.name ?? "loyalty"} program`,
      },
      // Transaction, not custom-event: this branch generates the data model
      // for a real transactional event (purchase/visit), which needs the
      // transaction-shaped envelope (eligibleAmount, transactionDateTime,
      // etc.) that only TRANSACTION pre-defines -- custom-event gives the
      // base event envelope but 400s on those fields as unrecognized
      // (confirmed live). See TRANSACTION_PARENT_TYPE_CODE's own comment.
      parentDataModelTypeCode: TRANSACTION_PARENT_TYPE_CODE,
    };
    await wrapApiCall(`Failed to create data model type "${dataModelCode}"`, () =>
      dataModelManagementCreateDataModelType(transactionalDataModelTypePayload)
    );
  } catch (err) {
    ignoreIfExists(err, `data model type ${dataModelCode}`);
  }

  // 2b. Create the DataModel instance
  try {
    await wrapApiCall(`Failed to create data model "${dataModelCode}"`, () =>
      dataModelManagementCreateDataModel({
        typeCode: dataModelCode,
        elements: [
          // Not required: the wizard's own internal test-fire path
          // (buildTestEventData) sends a bare top-level `amount`, but the
          // real production purchase event (demo-dataset-generator's
          // buildPurchaseEvent) never does -- it only sends the `transaction`
          // parent type's own `eligibleAmount` Money field. Marking this
          // required 400s real traffic with "$: required property 'amount'
          // not found" (confirmed live, against a brand-new org+program code
          // so there was no stale DataModel involved).
          {
            inputAttribute: "amount",
            outputAttribute: "amount",
            name: "Amount",
            typeCode: "NUMBER",
            required: false,
          },
          // The `transaction` parent type does not auto-inherit these onto
          // this data model's own generated schema (confirmed live: without
          // them declared here, a real event submission 400s with "required
          // property 'transactionDateTime'/'transactionId' not found") --
          // CreateTransaction's SDK type marks both as required top-level
          // fields, so this data model must declare them itself.
          {
            inputAttribute: "transactionId",
            outputAttribute: "transactionId",
            name: "Transaction ID",
            typeCode: "STRING",
            required: true,
          },
          {
            inputAttribute: "transactionDateTime",
            outputAttribute: "transactionDateTime",
            name: "Transaction Date Time",
            typeCode: "STRING",
            required: true,
          },
        ],
      })
    );
  } catch (err) {
    ignoreIfExists(err, `data model ${dataModelCode}`);
  }

  // 3. Create EVENT_TYPE data type value
  const eventDataTypePayload: CreateDataType = {
    typeCode: "EVENT_TYPE",
    code: eventTypeCode,
    name: eventName,
    dataModelCode,
  };
  try {
    const response = await wrapApiCall(
      `Failed to create EVENT_TYPE data type "${eventTypeCode}"`,
      () => metadataManagementCreateDataType(eventDataTypePayload)
    );
    if (response.status !== 200) {
      throw new Error(
        `Failed to create EVENT_TYPE data type "${eventTypeCode}" (status ${String(response.status)})`
      );
    }
  } catch (err) {
    ignoreIfExists(err, `EVENT_TYPE data type ${eventTypeCode}`);
  }

  // 4. Create event type configuration — the only sub-stage subject to
  //    skip-existing. The other three (metadata type, data model type,
  //    data model, data type) are idempotent via ignoreIfExists because
  //    they're org-wide shared state with no cross-env conflict concerns.
  const eventTypeConfigCode = `${sanitizedProgramCode}.${baseEventTypeCode}.config`;
  const existingConfig = checkSkipExisting<{ eventTypeConfigurationId?: string }>(
    preScanMap,
    "eventType",
    eventTypeConfigCode
  );
  if (existingConfig?.eventTypeConfigurationId) {
    results.eventTypeId = existingConfig.eventTypeConfigurationId;
    skipped.push({
      type: "eventType",
      id: existingConfig.eventTypeConfigurationId,
      code: eventTypeConfigCode,
      name: eventName,
    });
  } else {
    try {
      const response = await wrapApiCall(
        `Failed to create event type config for "${eventTypeCode}"`,
        () =>
          eventEngineManagementCreateEventTypeConfiguration({
            code: eventTypeConfigCode,
            eventTypeCode,
            name: eventName,
            saveUnprocessedEvent: false,
          })
      );
      if (response.status !== 200 || !response.data) {
        throw new Error(
          `Failed to create event type config for "${eventTypeCode}" (status ${String(response.status)})`
        );
      }
      results.eventTypeId = response.data.eventTypeConfigurationId;
      if (response.data.eventTypeConfigurationId) {
        created.push({
          type: "eventType",
          id: response.data.eventTypeConfigurationId,
          code: eventTypeCode,
          name: eventName,
        });
      }
    } catch (err) {
      ignoreIfExists(err, `event type config ${eventTypeCode}`);
    }
  }

  customActivityCodes.add(eventTypeCode);
  return eventTypeCode;
}

async function runCreatingAwardRule(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for award rule");

  const eventRuleCurrencyCode =
    spec.existingCurrencyCode ?? spec.currency?.code ?? results.currencyCode;
  const payload = buildEventRulePayload(
    spec,
    programId,
    results.currencyId,
    eventRuleCurrencyCode,
    Object.values(results.tierCodeToTargetId ?? {})
  );

  const existing = checkSkipExisting<{ eventRuleId?: string }>(
    preScanMap,
    "eventRule",
    payload.code ?? ""
  );
  if (existing?.eventRuleId) {
    results.eventRuleId = existing.eventRuleId;
    skipped.push({
      type: "eventRule",
      id: existing.eventRuleId,
      code: payload.code ?? "",
      name: payload.name,
    });
    return;
  }

  const response = await wrapApiCall("Failed to create award rule", () =>
    eventEngineManagementCreateEventRule(payload)
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create award rule (status ${String(response.status)})`);
  }
  const eventRuleId = response.data.eventRuleId;
  if (!eventRuleId) {
    throw new Error("Award rule created but server returned no eventRuleId");
  }
  results.eventRuleId = eventRuleId;
  created.push({
    type: "eventRule",
    id: eventRuleId,
    code: payload.code ?? "",
    name: payload.name,
  });
}

async function runCreatingBaseTierRule(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for base tier rule");

  const baseTier = getSortedTiers(spec.tiers)[0];
  if (!baseTier) throw new Error("No base tier found");
  // Defense-in-depth (WV006): if the linter is bypassed (e.g. AI onboarding),
  // refuse to issue a non-base tier on signup rather than fail silently.
  if (baseTier.pointsThreshold !== 0) {
    throw new Error(
      `Base tier rule expects pointsThreshold === 0, got ${baseTier.pointsThreshold} for tier "${baseTier.code}". ` +
        `This indicates the linter was bypassed — check validateProgramSpec is wired upstream.`
    );
  }

  const baseTierRulePayload = {
    code: generateCode(`${spec.program.code ?? "program"}-base-tier`),
    name: `${spec.program.name ?? "Program"} Base Tier on Signup`,
    category: "BASE" as const,
    eventTypeCode: "customer.created",
    programIds: [programId],
    eventExpression: { true: {} },
    eventActionsExpression: {
      true: {
        actions: [
          {
            issueCustomerTier: {
              tierCode: baseTier.code,
              issueLifetimeTier: true,
            },
          },
        ],
      },
    },
  };

  const existing = checkSkipExisting<{ eventRuleId?: string }>(
    preScanMap,
    "eventRule",
    baseTierRulePayload.code
  );
  if (existing?.eventRuleId) {
    results.baseTierRuleId = existing.eventRuleId;
    skipped.push({
      type: "eventRule",
      id: existing.eventRuleId,
      code: baseTierRulePayload.code,
      name: baseTierRulePayload.name,
    });
    return;
  }

  const response = await wrapApiCall("Failed to create base tier rule", () =>
    eventEngineManagementCreateEventRule(
      baseTierRulePayload as Parameters<typeof eventEngineManagementCreateEventRule>[0]
    )
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create base tier rule (status ${String(response.status)})`);
  }
  const baseTierRuleId = response.data.eventRuleId;
  if (!baseTierRuleId) {
    throw new Error("Base tier rule created but server returned no eventRuleId");
  }
  results.baseTierRuleId = baseTierRuleId;
  created.push({
    type: "eventRule",
    id: baseTierRuleId,
    code: baseTierRulePayload.code,
    name: baseTierRulePayload.name,
  });
}

async function runCreatingTierProgressionRules(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  tierCodeToTargetId: Map<string, string>,
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for tier progression");

  const tierProgressionRuleIds: string[] = [];
  const nonBaseTiers = getNonBaseTiers(spec.tiers);

  for (const tierData of nonBaseTiers) {
    const targetCode = generateCode(`${spec.program.code ?? "program"}-${tierData.code}-target`);
    const targetId = tierCodeToTargetId.get(tierData.code);

    // Publishing the progression rule below (eventTypeCode "target.achieved",
    // eventSubTypeIdentifier targetCode) 500s server-side with "Cannot publish
    // an EventRule without a matching EventTypeConfiguration" unless a
    // configuration matching that exact (eventTypeCode, eventSubTypeIdentifier)
    // pair already exists — same requirement the base earning rule's own event
    // type already satisfies a few hundred lines above. EventTypeConfiguration
    // is deliberately scoped per-target (not a wildcard shared across all
    // targets) even though the backend supports a null/wildcard
    // eventSubTypeIdentifier, for precise per-target tracking.
    try {
      const configResponse = await wrapApiCall(
        `Failed to create event type configuration for tier "${tierData.name}" progression`,
        () =>
          eventEngineManagementCreateEventTypeConfiguration({
            code: `${targetCode}-etc`,
            eventTypeCode: "target.achieved",
            eventSubTypeIdentifier: targetCode,
            name: `${tierData.name} Tier Progression Event`,
            saveUnprocessedEvent: false,
          })
      );
      if (configResponse.status !== 200 || !configResponse.data?.eventTypeConfigurationId) {
        throw new Error(
          `Failed to create event type configuration for tier "${tierData.name}" progression ` +
            `(status ${String(configResponse.status)})`
        );
      }
    } catch (err) {
      ignoreIfExists(err, `event type configuration for tier ${tierData.name} progression`);
    }

    const progressionRulePayload = {
      code: generateCode(`${spec.program.code ?? "program"}-${tierData.code}-progression`),
      name: `${tierData.name} Tier Progression`,
      category: "PROMOTION" as const,
      eventTypeCode: "target.achieved",
      eventSubTypeIdentifier: targetCode,
      programIds: [programId],
      // promotionTargetId only set if we have it. The backend can
      // match progression rules by eventSubTypeIdentifier alone.
      ...(targetId ? { promotionTargetId: targetId } : {}),
      eventExpression: { true: {} },
      eventActionsExpression: {
        true: {
          actions: [
            {
              issueCustomerTier: {
                tierCode: tierData.code,
                issueLifetimeTier: false,
              },
            },
          ],
        },
      },
    };

    // Skip-existing check: is this progression rule already present?
    const existing = checkSkipExisting<{ eventRuleId?: string }>(
      preScanMap,
      "eventRule",
      progressionRulePayload.code
    );
    if (existing?.eventRuleId) {
      tierProgressionRuleIds.push(existing.eventRuleId);
      skipped.push({
        type: "eventRule",
        id: existing.eventRuleId,
        code: progressionRulePayload.code,
        name: progressionRulePayload.name,
      });
      continue;
    }

    let ruleResponse;
    try {
      ruleResponse = await wrapApiCall(
        `Failed to create progression rule for tier "${tierData.name}"`,
        () =>
          eventEngineManagementCreateEventRule(
            progressionRulePayload as Parameters<typeof eventEngineManagementCreateEventRule>[0]
          )
      );
      if (ruleResponse.status !== 200 || !ruleResponse.data) {
        throw new Error(
          `Failed to create progression rule for tier "${tierData.name}" (status ${String(ruleResponse.status)})`
        );
      }
    } catch (err) {
      ignoreIfExists(err, `progression rule for tier ${tierData.name}`);
      continue;
    }

    const ruleId = ruleResponse.data.eventRuleId;
    if (!ruleId) {
      throw new Error(
        `Progression rule for ${tierData.name} created but server returned no eventRuleId`
      );
    }
    tierProgressionRuleIds.push(ruleId);
    created.push({
      type: "eventRule",
      id: ruleId,
      code: progressionRulePayload.code,
      name: progressionRulePayload.name,
    });
  }

  results.tierProgressionRuleIds = tierProgressionRuleIds;
}

async function runCreatingSignupBonus(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for signup bonus");
  if (!spec.signupBonusConfig) throw new Error("Signup bonus configuration required");

  const signupCurrencyCode = spec.existingCurrencyCode ?? spec.currency?.code;
  if (!signupCurrencyCode) {
    throw new Error("Sign-up bonus requires a program currency to be enabled and configured.");
  }

  const signupBonusPayload = {
    code: generateCode(`${spec.program.code ?? "program"}-signup-bonus`),
    name: `${spec.program.name ?? "Program"} Sign-up Bonus`,
    category: "ORGANIZATION_DEFINED" as const,
    eventTypeCode: "customer.created",
    programIds: [programId],
    eventExpression: { true: {} },
    eventActionsExpression: {
      true: {
        actions: [
          {
            issueProgramCurrency: {
              programId,
              programCurrencyCode: signupCurrencyCode,
              defaultResult: spec.signupBonusConfig.bonusPoints,
              isFixedAmount: true,
              targetIdsToIncrement: Object.values(results.tierCodeToTargetId ?? {}),
              registerTargets: true,
              synchronous: false,
            },
          },
        ],
      },
    },
  };

  const existing = checkSkipExisting<{ eventRuleId?: string }>(
    preScanMap,
    "eventRule",
    signupBonusPayload.code
  );
  if (existing?.eventRuleId) {
    results.signupBonusRuleId = existing.eventRuleId;
    skipped.push({
      type: "eventRule",
      id: existing.eventRuleId,
      code: signupBonusPayload.code,
      name: signupBonusPayload.name,
    });
    return;
  }

  const response = await wrapApiCall("Failed to create signup bonus rule", () =>
    eventEngineManagementCreateEventRule(
      signupBonusPayload as Parameters<typeof eventEngineManagementCreateEventRule>[0]
    )
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create signup bonus rule (status ${String(response.status)})`);
  }
  const signupBonusRuleId = response.data.eventRuleId;
  if (!signupBonusRuleId) {
    throw new Error("Signup bonus rule created but server returned no eventRuleId");
  }
  results.signupBonusRuleId = signupBonusRuleId;
  created.push({
    type: "eventRule",
    id: signupBonusRuleId,
    code: signupBonusPayload.code,
    name: signupBonusPayload.name,
  });
}

async function runCreatingBirthdayBonus(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null,
  customActivityCodes: Set<string>
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for birthday bonus");
  if (!spec.birthdayBonusConfig) throw new Error("Birthday bonus configuration required");

  // Ensure "birthday" event type chain exists. Unlike "customer.created"
  // (pre-seeded on all tenants), "birthday" is a campaign event that may not
  // exist on fresh tenants. Create the full chain idempotently.
  try {
    const birthdayDataModelTypePayload: CreateDataModelTypeWithParent = {
      code: BIRTHDAY_TYPE_CODE,
      name: "Birthday Event Schema",
      description: { en: "Schema for birthday campaign events" },
      // See runCreatingEventType: without CUSTOM_EVENT as parent, the
      // generated schema rejects the real event envelope fields.
      parentDataModelTypeCode: CUSTOM_EVENT_PARENT_TYPE_CODE,
    };
    await dataModelManagementCreateDataModelType(birthdayDataModelTypePayload);
  } catch (err) {
    ignoreIfExists(err, "birthday data model type");
  }

  try {
    // TODO(known-bug): the platform's createDataModel rejects an empty
    // `elements` array (`createDataModelData.elements: must not be empty`),
    // so this used to silently fail on fresh tenants — `ignoreIfExists`
    // only swallows 409s, not validation errors. Until the platform-side
    // fix lands (existing GH issue), include a single placeholder
    // `customerId` element so the create succeeds. The birthday event
    // payload doesn't actually need an `elements` shape — the event-rule
    // expression only matches on the `birthday` event type — but the
    // create endpoint demands non-empty.
    await dataModelManagementCreateDataModel({
      typeCode: BIRTHDAY_TYPE_CODE,
      elements: [
        {
          inputAttribute: "customerId",
          outputAttribute: "customerId",
          name: "Customer ID",
          typeCode: "STRING",
          required: true,
        },
      ],
    });
  } catch (err) {
    ignoreIfExists(err, "birthday data model");
  }

  try {
    await metadataManagementCreateDataType({
      typeCode: "EVENT_TYPE",
      // Metadata's own code, NOT a resource code — Metadata/MetadataType are
      // permanently excluded from the resource-code convention. It has to keep
      // matching the `eventTypeCode` used by the event rule below and the entry
      // added to `customActivityCodes`, so it stays a literal.
      code: "birthday",
      name: "Birthday Event",
      // This one DOES reference the DataModelType created above (the DataModel
      // is identified by its type code), so it tracks the shared constant.
      dataModelCode: BIRTHDAY_TYPE_CODE,
    });
  } catch (err) {
    ignoreIfExists(err, "birthday EVENT_TYPE data type");
  }

  customActivityCodes.add("birthday");

  try {
    const configResp = await eventEngineManagementCreateEventTypeConfiguration({
      code: "birthday",
      eventTypeCode: "birthday",
      name: "Birthday Event",
      saveUnprocessedEvent: false,
    });
    if (configResp.status === 200 && configResp.data?.eventTypeConfigurationId) {
      created.push({
        type: "eventType",
        id: configResp.data.eventTypeConfigurationId,
        code: "birthday",
        name: "Birthday Event",
      });
    }
  } catch (err) {
    ignoreIfExists(err, "birthday event type configuration");
  }

  const birthdayCurrencyCode = spec.existingCurrencyCode ?? spec.currency?.code;
  if (!birthdayCurrencyCode) {
    throw new Error("Birthday bonus requires a program currency to be enabled and configured.");
  }

  const birthdayBonusPayload = {
    code: generateCode(`${spec.program.code ?? "program"}-birthday-bonus`),
    name: `${spec.program.name ?? "Program"} Birthday Bonus`,
    category: "ORGANIZATION_DEFINED" as const,
    eventTypeCode: "birthday",
    programIds: [programId],
    eventExpression: { true: {} },
    eventActionsExpression: {
      true: {
        actions: [
          {
            issueProgramCurrency: {
              programId,
              programCurrencyCode: birthdayCurrencyCode,
              defaultResult: spec.birthdayBonusConfig.bonusPoints,
              isFixedAmount: true,
              targetIdsToIncrement: Object.values(results.tierCodeToTargetId ?? {}),
              registerTargets: true,
              synchronous: false,
            },
          },
        ],
      },
    },
  };

  const existing = checkSkipExisting<{ eventRuleId?: string }>(
    preScanMap,
    "eventRule",
    birthdayBonusPayload.code
  );
  if (existing?.eventRuleId) {
    results.birthdayBonusRuleId = existing.eventRuleId;
    skipped.push({
      type: "eventRule",
      id: existing.eventRuleId,
      code: birthdayBonusPayload.code,
      name: birthdayBonusPayload.name,
    });
    return;
  }

  const response = await wrapApiCall("Failed to create birthday bonus rule", () =>
    eventEngineManagementCreateEventRule(
      birthdayBonusPayload as Parameters<typeof eventEngineManagementCreateEventRule>[0]
    )
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create birthday bonus rule (status ${String(response.status)})`);
  }
  const birthdayBonusRuleId = response.data.eventRuleId;
  if (!birthdayBonusRuleId) {
    throw new Error("Birthday bonus rule created but server returned no eventRuleId");
  }
  results.birthdayBonusRuleId = birthdayBonusRuleId;
  created.push({
    type: "eventRule",
    id: birthdayBonusRuleId,
    code: birthdayBonusPayload.code,
    name: birthdayBonusPayload.name,
  });
}

async function runCreatingCustomer(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[]
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for customer");

  const payload = buildCustomerPayload(spec, programId);
  const response = await wrapApiCall("Failed to create customer", () =>
    customerCreateCustomer(payload)
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to create customer (status ${String(response.status)})`);
  }
  const customerId = response.data.customerId;
  if (!customerId) {
    throw new Error("Customer created but server returned no customerId");
  }
  results.customerId = customerId;
  created.push({
    type: "customer",
    id: customerId,
    code: spec.testCustomer?.externalId ?? "",
    name: `${spec.testCustomer?.firstName ?? ""} ${spec.testCustomer?.lastName ?? ""}`.trim(),
  });
}

async function runFiringEvent(
  spec: ProgramSpec,
  results: ExecutionResults,
  publishedEventTypeCode: string | undefined
): Promise<void> {
  const customerId = results.customerId;
  if (!customerId) throw new Error("Customer ID required for test event");
  if (!spec.awardRule) throw new Error("Award rule configuration required");
  if (!publishedEventTypeCode) {
    throw new Error(
      "No published event type code set — creating-event-type must run before firing-event"
    );
  }

  const testEventData = buildTestEventData(
    spec.awardRule.templateId,
    customerId,
    spec.awardRule.templateConfig
  );
  const template = getTemplateById(spec.awardRule.templateId);
  const description = `Test event for ${template?.name ?? "custom rule"}`;

  // Every eventTypeCode this executor publishes (e.g. "coffee-loyalty.purchase")
  // is a tenant-scoped custom code created by runCreatingEventType — never the
  // platform's built-in "transaction" type. The API's polymorphic event
  // deserializer resolves any unrecognized eventTypeCode to its generic
  // CustomEvent shape (eventTypeCode + description are the only real fields;
  // everything else rides along as an open additional-properties bag read by
  // the event's DataModel, e.g. "amount"). There is no eventTarget/eventData
  // wrapper on the request body — the entity being targeted is a QUERY PARAM
  // (entityType/entityId), not a body field. (The OpenAPI spec incorrectly
  // exposes eventTarget/eventData/eventMetadata as request-body properties —
  // those are internal dispatch-envelope fields, not part of the wire format.)
  //
  // The generated `CreateCustomEvent` type is currently over-narrow — a
  // schema-generation quirk resolves this polymorphic endpoint's type to a
  // single concrete example rather than the genuine open shape, so it's not
  // a real contract requirement. `as unknown as` bypasses that accidental
  // narrowing; the real, open shape is documented above and unchanged.
  const eventPayload = {
    eventTypeCode: publishedEventTypeCode,
    description,
    eventDateTime: new Date().toISOString(),
    ...testEventData,
  } as unknown as CreateCustomEvent & Record<string, unknown>;

  const publishParams: EventEnginePublishEventParams & { entityId?: string } = {
    entityType: SdkEntityType.CUSTOMER,
    entityId: customerId,
  };

  const response = await wrapApiCall("Failed to fire test event", () =>
    eventEnginePublishEvent(eventPayload, publishParams)
  );
  if (response.status !== 200 || !response.data) {
    throw new Error(`Failed to fire test event (status ${String(response.status)})`);
  }

  results.testEventId = response.data.eventId;
  results.testEventStatus = response.data.status;
  results.expectedPoints = calculateExpectedPoints(
    spec.awardRule.templateId,
    spec.awardRule.templateConfig,
    testEventData
  );
}

async function runCreatingTierBonusRules(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null,
  publishedEventTypeCode: string | undefined
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for tier bonus rules");

  const ruleIds: string[] = [];
  const programCode = spec.program.code ?? "program";
  const currencyCode =
    spec.existingCurrencyCode ?? spec.currency?.code ?? results.currencyCode ?? "";
  if (!currencyCode) {
    throw new Error("Currency code required for tier bonus rules");
  }
  // Bind to the SAME event type the base earn rule was created against.
  // `runCreatingEventType` already published it and stashed the code in
  // `publishedEventTypeCode` for the outer closure. Falling back to
  // `<program>.purchase` keeps the legacy default working for transactional
  // templates that never set `eventType` on the spec.
  const scopedEventTypeCode =
    publishedEventTypeCode ?? `${sanitizeProgramCodeForEventType(programCode)}.purchase`;

  for (const tier of spec.tiers) {
    // Skip tiers without a bonus: undefined, exactly 1.0 (standard rate),
    // or sub-1.0 (no positive bonus to add — a negative bonusFraction
    // would SUBTRACT currency from every purchase on that tier).
    if (tier.earnMultiplier === undefined || tier.earnMultiplier <= 1.0) continue;
    const ruleCode = generateCode(`${programCode}-${tier.code}-multiplier`);
    const ruleName = `${tier.name} Earn Multiplier`;

    const existing = checkSkipExisting<{ eventRuleId?: string }>(preScanMap, "eventRule", ruleCode);
    if (existing?.eventRuleId) {
      ruleIds.push(existing.eventRuleId);
      skipped.push({ type: "eventRule", id: existing.eventRuleId, code: ruleCode, name: ruleName });
      continue;
    }

    const bonusFraction = tier.earnMultiplier - 1;
    const payload = {
      code: ruleCode,
      name: ruleName,
      category: "TIER" as const,
      eventTypeCode: scopedEventTypeCode,
      programIds: [programId],
      eventExpression: {
        currentTier: { tierCode: tier.code, revalidateTier: true },
      },
      eventTargetsExpression: { true: {} },
      processItemsIndividually: false,
      eventActionsExpression: {
        true: {
          actions: [
            {
              issueProgramCurrency: {
                programId,
                programCurrencyCode: currencyCode,
                // This rule is scoped to `scopedEventTypeCode` — the same
                // transactional purchase event type the base points-per-dollar
                // award rule targets, never a custom event-based one. A real
                // purchase event's persisted eventData has no top-level
                // `amount` -- only the `transaction` parent type's own
                // Money-typed `eligibleAmount` (same confirmed shape as the
                // points-per-dollar template fix). The old path silently
                // matched nothing, so tier bonus currency was never issued.
                path: "$.eventData.eligibleAmount.amount",
                preOperation: { multiply: { operand: bonusFraction } },
                targetIdsToIncrement: Object.values(results.tierCodeToTargetId ?? {}),
                registerTargets: true,
                synchronous: false,
              },
            },
          ],
        },
      },
    };

    const response = await wrapApiCall(`Failed to create tier bonus rule for "${tier.name}"`, () =>
      eventEngineManagementCreateEventRule(
        payload as Parameters<typeof eventEngineManagementCreateEventRule>[0]
      )
    );
    if (response.status !== 200 || !response.data) {
      throw new Error(
        `Failed to create tier bonus rule for "${tier.name}" (status ${String(response.status)})`
      );
    }
    const ruleId = response.data.eventRuleId;
    if (!ruleId) {
      throw new Error(
        `Tier bonus rule for "${tier.name}" created but server returned no eventRuleId`
      );
    }
    ruleIds.push(ruleId);
    created.push({ type: "eventRule", id: ruleId, code: ruleCode, name: ruleName });
  }

  results.tierBonusRuleIds = ruleIds;
}

async function runCreatingPromotions(
  spec: ProgramSpec,
  results: ExecutionResults,
  created: EntityRef[],
  skipped: EntityRef[],
  preScanMap: Map<PreScanKey, unknown> | null,
  publishedEventTypeCode: string | undefined,
  customActivityCodes: Set<string>
): Promise<void> {
  const programId = results.programId;
  if (!programId) throw new Error("Program ID required for promotions");
  if (!spec.promotions || spec.promotions.length === 0) return;

  const currencyCode =
    spec.existingCurrencyCode ?? spec.currency?.code ?? results.currencyCode ?? "";
  if (!currencyCode) {
    throw new Error("Currency code required for promotions");
  }
  const promotionResults: NonNullable<ExecutionResults["promotions"]> = [];
  const programCode = sanitizeProgramCodeForEventType(spec.program.code ?? "program");
  // Track event type codes we've already created within this run. Two
  // promotions can sanitize to the same code (e.g. `drink_modification`
  // and `drink.modification` both → `drink.modification`); without this
  // check the second create 409s, `ignoreIfExists` swallows it, and the
  // second promotion silently shares the first's data model shape —
  // including any required `dataFields` it expected to declare.
  //
  // Seed with the base earning rule's event type code so a promotion that
  // happens to sanitize to the same code (e.g. a "Purchase Points" promo →
  // `<programcode>.purchase`, matching the base earn rule) also throws
  // instead of silently rebinding to the base shape.
  const usedEventTypeCodes = new Set<string>();
  if (publishedEventTypeCode) usedEventTypeCodes.add(publishedEventTypeCode);

  for (let promoIndex = 0; promoIndex < spec.promotions.length; promoIndex++) {
    const promo = spec.promotions[promoIndex]!;
    const promoSummary: {
      code: string;
      eventTypeId?: string;
      targetIds: string[];
      eventRuleIds: string[];
      offerIds: string[];
    } = {
      code: promo.code,
      targetIds: [],
      eventRuleIds: [],
      offerIds: [],
    };

    // 1. Event type — full chain (data model type → data model → EVENT_TYPE
    //    data type → event type configuration). Mirrors `runCreatingEventType`
    //    so the platform recognizes the code when publishEvent fires. Each
    //    step is idempotent via `ignoreIfExists` so promotions that share an
    //    event type with the base earn rule or with each other don't fail.
    //
    // Sanitize + scope the LLM-provided event type code via the shared
    // helpers so pre-scan and executor derive identical codes. Fallback
    // index keeps two prose-only inputs from colliding on the same entity.
    const sanitizedPromoEventCode = sanitizePromoEventCode(promo.eventType.code, promoIndex);
    const scopedEventTypeCode = scopePromoEventTypeCode(programCode, sanitizedPromoEventCode);
    // Share, don't recreate. Two promotions can legitimately bind to the
    // same event type (e.g. both fire on `purchase` with different
    // `conditions`). When the code already lives in `usedEventTypeCodes`
    // — either from an earlier promotion in this run or from the base
    // earning rule seeded above — skip the dataModelType/dataModel/
    // EVENT_TYPE/config create chain and reuse the existing entities. Targets
    // and event rules still get created for this promotion below.
    const alreadyCreated = usedEventTypeCodes.has(scopedEventTypeCode);
    if (!alreadyCreated) {
      usedEventTypeCodes.add(scopedEventTypeCode);
      // A promotion's activity is a custom activity too, and a care agent may
      // well need to record one by hand.
      customActivityCodes.add(scopedEventTypeCode);
      // Pre-scan first: if the event type config already exists in the
      // target env, seed the ID from it and skip the entire create chain.
      // The earlier `runCreatingPromotions` path relied solely on
      // `ignoreIfExists` to absorb 409s — that quieted the failure but left
      // `promoSummary.eventTypeId` empty, lying to downstream tools about
      // what landed.
      const existingEventTypeConfig = checkSkipExisting<{
        eventTypeConfigurationId?: string;
        eventTypeId?: string;
      }>(preScanMap, "eventType", scopedEventTypeCode);
      const existingEventTypeId =
        existingEventTypeConfig?.eventTypeConfigurationId ?? existingEventTypeConfig?.eventTypeId;
      if (existingEventTypeId) {
        promoSummary.eventTypeId = existingEventTypeId;
        skipped.push({
          type: "eventType",
          id: existingEventTypeId,
          code: scopedEventTypeCode,
          name: promo.eventType.name,
        });
      } else {
        // Declared outside the try blocks below: the data model, the data type
        // and the config are each created in their own block and all three need
        // this value.
        //
        // Always dotted here (`<program>.<promo>`), so it can never be a valid
        // DataModelType code. See the event-based branch above.
        const promoDataModelTypeCode = toResourceCode(scopedEventTypeCode);
        try {
          const promoDataModelTypePayload: CreateDataModelTypeWithParent = {
            code: promoDataModelTypeCode,
            name: promo.eventType.name,
            // See runCreatingEventType: without CUSTOM_EVENT as parent, the
            // generated schema rejects the real event envelope fields.
            parentDataModelTypeCode: CUSTOM_EVENT_PARENT_TYPE_CODE,
          };
          await dataModelManagementCreateDataModelType(promoDataModelTypePayload);
        } catch (err) {
          ignoreIfExists(err, `data model type ${scopedEventTypeCode}`);
        }
        try {
          await dataModelManagementCreateDataModel({
            typeCode: promoDataModelTypeCode,
            elements:
              (promo.eventType.dataFields ?? []).length > 0
                ? promo.eventType.dataFields!.map((f) => ({
                    inputAttribute: f.name,
                    outputAttribute: f.name,
                    name: f.name,
                    typeCode: mapFieldTypeToDataModelType(f.type),
                    required: f.required,
                  }))
                : [
                    // The platform requires non-empty elements. Promotion event
                    // types extracted by the LLM rarely declare explicit
                    // dataFields, so synthesize a minimal customerId placeholder.
                    {
                      inputAttribute: "customerId",
                      outputAttribute: "customerId",
                      name: "Customer ID",
                      typeCode: "STRING",
                      required: true,
                    },
                  ],
          });
        } catch (err) {
          ignoreIfExists(err, `data model ${scopedEventTypeCode}`);
        }
        try {
          await metadataManagementCreateDataType({
            typeCode: "EVENT_TYPE",
            code: scopedEventTypeCode,
            name: promo.eventType.name,
            dataModelCode: promoDataModelTypeCode,
          });
        } catch (err) {
          ignoreIfExists(err, `EVENT_TYPE data type ${scopedEventTypeCode}`);
        }
        try {
          const etResponse = await wrapApiCall(
            `Failed to create event type configuration "${scopedEventTypeCode}" for promotion "${promo.code}"`,
            () =>
              eventEngineManagementCreateEventTypeConfiguration({
                code: scopedEventTypeCode,
                eventTypeCode: scopedEventTypeCode,
                name: promo.eventType.name,
                saveUnprocessedEvent: false,
              })
          );
          if (etResponse.status === 200 && etResponse.data) {
            const evtId =
              (etResponse.data as { eventTypeConfigurationId?: string }).eventTypeConfigurationId ??
              (etResponse.data as { eventTypeId?: string }).eventTypeId;
            if (evtId) promoSummary.eventTypeId = evtId;
          }
        } catch (err) {
          ignoreIfExists(err, `event type configuration ${scopedEventTypeCode}`);
        }
      }
    }

    // 2. Targets — dispatch per `kind` (COMPLETION / COUNTER / MILESTONE /
    //    X_OF_Y) onto the platform's `CreateTarget` discriminated union.
    //    Each kind has required `config` fields; when any are missing we
    //    skip Target creation for this promotion and emit a progress
    //    message so the user sees the gap. Event rules still fire on the
    //    `conditions` predicate — most promotions don't need a Target at
    //    all (day-of-week, attribute checks, threshold gates live in
    //    `eventExpression`).
    for (let ti = 0; ti < promo.targets.length; ti++) {
      const t = promo.targets[ti]!;
      // Base goes through generateCode's 40-char slice; the `-target-N`
      // disambiguator is appended AFTER so two long-named targets can't
      // truncate to the same code and collide on the platform's idempotency
      // check.
      const targetCode = `${generateCode(`${spec.program.code ?? "program"}-${promo.code}`)}-target-${ti}`;
      const existingTarget = checkSkipExisting<{ targetId?: string }>(
        preScanMap,
        "target",
        targetCode
      );
      if (existingTarget?.targetId) {
        promoSummary.targetIds.push(existingTarget.targetId);
        skipped.push({
          type: "target",
          id: existingTarget.targetId,
          code: targetCode,
          name: promo.name,
        });
        continue;
      }
      const targetName = `${promo.name} Target ${ti + 1}`;
      const built = buildPromotionTargetPayload(t, programId, targetCode, targetName);
      if ("skipped" in built) {
        // Surface the skip via `results.warnings` so the UI/CLI can show
        // "X promotion targets were skipped — fill in the missing
        // typeCode and re-run". Without this the executor silently
        // continues, the event rule still fires on `conditions`, but
        // the user has no signal that the Target wasn't created.
        if (!results.warnings) results.warnings = [];
        results.warnings.push(`Promotion "${promo.code}" target ${ti}: ${built.skipped}`);
        continue;
      }
      // Fresh orgs have the *_TARGET_TYPE metadata types seeded but ZERO
      // instances. The platform's target create accepts any string code,
      // then later fails to resolve the foreign reference (HTTP 500
      // "Entity of type 'CounterTargetType' and identifier '...' resolution
      // error"). Mirror the tier-progression COUNTER_TARGET_TYPE create
      // pattern: ensure the instance exists for whichever code the LLM
      // emitted. Idempotent via ignoreIfExists.
      const targetTypeInstance = targetTypeMetadataFor(t);
      if (targetTypeInstance) {
        try {
          await metadataManagementCreateMetadata({
            typeCode: targetTypeInstance.metadataTypeCode,
            code: targetTypeInstance.code,
            name:
              targetTypeInstance.code.charAt(0) +
              targetTypeInstance.code.slice(1).toLowerCase().replace(/_/g, " "),
          });
        } catch (err) {
          ignoreIfExists(err, `${targetTypeInstance.metadataTypeCode} ${targetTypeInstance.code}`);
        }
      }
      try {
        const tResponse = await wrapApiCall(
          `Failed to create target for promotion "${promo.code}"`,
          () =>
            eventEngineManagementCreateTarget(
              built.payload as Parameters<typeof eventEngineManagementCreateTarget>[0]
            )
        );
        if (tResponse.status === 200 && tResponse.data) {
          const tid = tResponse.data.targetId;
          if (tid) {
            promoSummary.targetIds.push(tid);
            created.push({ type: "target", id: tid, code: targetCode, name: promo.name });
          }
        }
      } catch (err) {
        ignoreIfExists(err, `target ${targetCode}`);
      }
    }

    // 3. Coupon Offer — when the promotion has any FREE_ITEM rule, the
    //    executor needs a shared Coupon Offer entity that the rule's
    //    `issueCustomerCoupon` action references. One offer per
    //    promotion: FREE_ITEM rules on the same promo share a single
    //    couponOfferCode. Pre-scan absorbs the create on rerun.
    let promotionOfferCode: string | undefined;
    const hasFreeItemRule = promo.eventRules.some((r) => r.award.type === "FREE_ITEM");
    if (hasFreeItemRule) {
      const offerCode = `${generateCode(`${spec.program.code ?? "program"}-${promo.code}`)}-offer`;
      // Avoid the double-"Reward" surface bug when the promotion name
      // already ends in "Reward" (e.g. "Birthday Reward" → otherwise
      // "Birthday Reward Reward" in the platform UI).
      const offerName = / Reward$/i.test(promo.name) ? promo.name : `${promo.name} Reward`;
      const existingOffer = checkSkipExisting<{ offerId?: string }>(preScanMap, "offer", offerCode);
      if (existingOffer?.offerId) {
        promoSummary.offerIds.push(existingOffer.offerId);
        skipped.push({
          type: "offer",
          id: existingOffer.offerId,
          code: offerCode,
          name: offerName,
        });
        promotionOfferCode = offerCode;
      } else {
        // Fresh orgs come with the COUPON_TYPE metadata type but ZERO
        // instances. The platform's @NotBlank only checks the string is
        // present, so an offer create with an unknown couponTypeCode
        // succeeds — but later joins (e.g. listing offers) throw 500
        // "Entity of type 'CouponType' and identifier '...' resolution
        // error". Ensure the metadata instance exists before referencing
        // it. Idempotent via ignoreIfExists for reruns or shared codes.
        const resolvedCouponTypeCode = promo.couponTypeCode || "STANDARD";
        try {
          await metadataManagementCreateDataType({
            typeCode: "COUPON_TYPE",
            code: resolvedCouponTypeCode,
            name: resolvedCouponTypeCode.charAt(0) + resolvedCouponTypeCode.slice(1).toLowerCase(),
            dataModelCode: "COUPON",
          });
        } catch (err) {
          ignoreIfExists(err, `COUPON_TYPE metadata instance ${resolvedCouponTypeCode}`);
        }

        const offerPayload: CreateCouponOffer = {
          code: offerCode,
          name: offerName,
          programIds: [programId],
          type: "COUPON",
          // Platform's @NotBlank validator rejects an empty couponTypeCode
          // at runtime even though the SDK marks it optional.
          couponTypeCode: resolvedCouponTypeCode,
          // Platform's @NotNull rejects null maxDiscountValue for COUPON
          // offers even though the SDK marks it optional. Mirror the Hub
          // UI's offer-form-sheet convention: 0 = "no discount cap".
          maxDiscountValue: 0,
          // Platform's @NotNull also rejects null couponDiscountType. The
          // LLM picks based on the promotion's intent; FIXED_AMOUNT is the
          // sensible fallback for FREE_ITEM rules (the free item has a
          // fixed dollar value the coupon redeems).
          couponDiscountType:
            (promo.couponDiscountType as CreateCouponOfferCouponDiscountType) || "FIXED_AMOUNT",
        } as CreateCouponOffer;
        try {
          const oResponse = await wrapApiCall(
            `Failed to create coupon offer for promotion "${promo.code}"`,
            () =>
              offerManagementCreateOffer(
                offerPayload as Parameters<typeof offerManagementCreateOffer>[0]
              )
          );
          if (oResponse.status === 200 && oResponse.data) {
            const oid = (oResponse.data as { offerId?: string }).offerId;
            if (oid) {
              promoSummary.offerIds.push(oid);
              created.push({ type: "offer", id: oid, code: offerCode, name: offerName });
            }
          }
          // Set promotionOfferCode unconditionally on success: a 200 with a
          // null/missing offerId is a backend bug we don't retry, but the
          // rule's `couponOfferCode` reference can still be wired by code.
          promotionOfferCode = offerCode;
        } catch (err) {
          ignoreIfExists(err, `coupon offer ${offerCode}`);
          // `ignoreIfExists` swallows 409s. The offer DOES exist; we just
          // didn't capture its server ID. Wire the action's
          // `couponOfferCode` by the deterministic code we computed.
          promotionOfferCode = offerCode;
        }
      }
    }

    // 4. Event rules — one per declared eventRule on the promotion.
    for (let ri = 0; ri < promo.eventRules.length; ri++) {
      const rule = promo.eventRules[ri]!;
      // Same shape as target code: disambiguator appended AFTER the
      // generateCode slice so `rule-0` and `rule-1` can't collide on a
      // long-named promotion.
      const ruleCode = `${generateCode(`${spec.program.code ?? "program"}-${promo.code}`)}-rule-${ri}`;
      const ruleName = `${promo.name} Rule ${ri + 1}`;
      const existingRule = checkSkipExisting<{ eventRuleId?: string }>(
        preScanMap,
        "eventRule",
        ruleCode
      );
      if (existingRule?.eventRuleId) {
        promoSummary.eventRuleIds.push(existingRule.eventRuleId);
        skipped.push({
          type: "eventRule",
          id: existingRule.eventRuleId,
          code: ruleCode,
          name: ruleName,
        });
        continue;
      }

      const isBaseTransactionalEvent = scopedEventTypeCode === publishedEventTypeCode;
      const action = buildPromotionAction(
        rule,
        programId,
        currencyCode,
        promotionOfferCode,
        isBaseTransactionalEvent
      );

      const payload = {
        code: ruleCode,
        name: ruleName,
        category: "PROMOTION" as const,
        eventTypeCode: scopedEventTypeCode,
        programIds: [programId],
        ...(promoSummary.targetIds[0] ? { promotionTargetId: promoSummary.targetIds[0] } : {}),
        eventExpression: buildPromotionExpression(rule.conditions),
        eventTargetsExpression: { true: {} },
        processItemsIndividually: false,
        eventActionsExpression: { true: { actions: [action] } },
      };

      try {
        const response = await wrapApiCall(
          `Failed to create event rule for promotion "${promo.code}"`,
          () =>
            eventEngineManagementCreateEventRule(
              payload as unknown as Parameters<typeof eventEngineManagementCreateEventRule>[0]
            )
        );
        // Mirror runCreatingTierBonusRules: a non-200 response without a
        // ruleId means the create silently failed but didn't throw. Treating
        // it as success (the prior code path) made the promotion record
        // claim victory while the rule was never created — invisible
        // production bug. Throw instead so the executor halts and the user
        // sees the failure in the progress log.
        if (response.status !== 200 || !response.data?.eventRuleId) {
          throw new Error(
            `Failed to create event rule for promotion "${promo.code}" (status ${String(response.status)})`
          );
        }
        const ruleId = response.data.eventRuleId;
        promoSummary.eventRuleIds.push(ruleId);
        created.push({ type: "eventRule", id: ruleId, code: ruleCode, name: ruleName });
      } catch (err) {
        ignoreIfExists(err, `event rule ${ruleCode}`);
      }
    }

    promotionResults.push(promoSummary);
  }

  results.promotions = promotionResults;
}

export function buildPromotionExpression(
  conditions: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!conditions || Object.keys(conditions).length === 0) return { true: {} };
  if (typeof conditions["equalsPath"] === "string" && "equalsValue" in conditions) {
    return {
      equals: {
        path: conditions["equalsPath"],
        value: conditions["equalsValue"],
      },
    };
  }
  if (typeof conditions["hasTier"] === "string") {
    return {
      currentTier: { tierCode: conditions["hasTier"], revalidateTier: true },
    };
  }
  // Unknown condition shape — fall back to always-fires rather than passing
  // arbitrary LLM-emitted keys through to the platform's event-engine
  // validator. Either the platform rejects them (400) or silently ignores
  // them and the rule fires on every event (over-payment risk).
  return { true: {} };
}

/**
 * Coerce a number-or-string LLM-emitted value into a finite number, or
 * `null` if it can't be parsed. JSON-mode and structured-output models
 * frequently quote numeric values (e.g. `"0.25"` instead of `0.25`); the
 * previous `typeof value === "number" ? value : <default>` path silently
 * collapsed all strings into the default, masking real failure.
 */
function coercePromotionAwardValue(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildPromotionAction(
  rule: { award: { type: "FLAT_POINTS" | "MULTIPLIER" | "FREE_ITEM"; value: number | string } },
  programId: string,
  currencyCode: string,
  couponOfferCode?: string,
  isBaseTransactionalEvent = false
): Record<string, unknown> {
  if (rule.award.type === "FLAT_POINTS" && currencyCode) {
    const parsed = coercePromotionAwardValue(rule.award.value);
    if (parsed === null) {
      throw new Error(
        `Promotion FLAT_POINTS award value is not a finite number: ${JSON.stringify(rule.award.value)}`
      );
    }
    return {
      issueProgramCurrency: {
        programId,
        programCurrencyCode: currencyCode,
        defaultResult: parsed,
        isFixedAmount: true,
        // Deliberately not wired to tierCodeToTargetId — promotional currency tier progress is an open product question.
        targetIdsToIncrement: [],
        registerTargets: true,
        synchronous: false,
      },
    };
  }
  if (rule.award.type === "MULTIPLIER" && currencyCode) {
    const operand = coercePromotionAwardValue(rule.award.value);
    if (operand === null) {
      throw new Error(
        `Promotion MULTIPLIER award value is not a finite number: ${JSON.stringify(rule.award.value)}`
      );
    }
    return {
      issueProgramCurrency: {
        programId,
        programCurrencyCode: currencyCode,
        path: isBaseTransactionalEvent ? "$.eventData.eligibleAmount.amount" : "$.eventData.amount",
        preOperation: { multiply: { operand } },
        // Deliberately not wired to tierCodeToTargetId — promotional currency tier progress is an open product question.
        targetIdsToIncrement: [],
        registerTargets: true,
        synchronous: false,
      },
    };
  }
  // FREE_ITEM: issue a Coupon Offer the platform redeems for the
  // described item. `couponOfferCode` is the deterministic code of the
  // Coupon Offer the executor created (or matched via pre-scan) earlier
  // in the same `runCreatingPromotions` iteration. Missing it is a bug
  // — every FREE_ITEM rule must have an offer wired up.
  if (!couponOfferCode) {
    throw new Error(
      `Promotion FREE_ITEM rule requires a couponOfferCode (executor invariant — call buildPromotionAction with the offer code after creating the offer entity).`
    );
  }
  return {
    issueCustomerCoupon: {
      couponOfferCode,
      synchronous: false,
      defaultResult: true,
    },
  };
}

/**
 * Resolve which *_TARGET_TYPE metadata instance the promotion target
 * references, so the executor can seed it before creating the target.
 * Returns null when the target's config doesn't declare a typeCode (the
 * skip-warning path in `buildPromotionTargetPayload` will surface that).
 */
function targetTypeMetadataFor(target: {
  kind: "COMPLETION" | "COUNTER" | "MILESTONE" | "X_OF_Y";
  config: Record<string, unknown>;
}): { metadataTypeCode: string; code: string } | null {
  const map = {
    COMPLETION: {
      configKey: "completionTargetTypeCode",
      metadataTypeCode: "COMPLETION_TARGET_TYPE",
    },
    COUNTER: { configKey: "counterTargetTypeCode", metadataTypeCode: "COUNTER_TARGET_TYPE" },
    MILESTONE: { configKey: "milestoneTargetTypeCode", metadataTypeCode: "MILESTONE_TARGET_TYPE" },
    X_OF_Y: { configKey: "xOfYTargetTypeCode", metadataTypeCode: "X_OF_Y_TARGET_TYPE" },
  } as const;
  const entry = map[target.kind];
  const code = target.config[entry.configKey];
  if (typeof code !== "string" || code.length === 0) return null;
  return { metadataTypeCode: entry.metadataTypeCode, code };
}

/**
 * Build a `CreateTarget` payload for a `WizardPromotionTarget`, dispatching
 * over the four platform target kinds. Returns either:
 *   - `{ payload }` for a valid config that can be created
 *   - `{ skipped: reason }` when required config fields are missing, so
 *     the caller can surface a warning and continue without crashing
 *
 * Exported for unit tests; consumed by `runCreatingPromotions`.
 */
export function buildPromotionTargetPayload(
  target: {
    kind: "COMPLETION" | "COUNTER" | "MILESTONE" | "X_OF_Y";
    config: Record<string, unknown>;
  },
  programId: string,
  targetCode: string,
  targetName: string
):
  | {
      payload:
        | CreateCompletionTarget
        | CreateCounterTarget
        | CreateMilestoneTarget
        | CreateXOfYTarget;
    }
  | { skipped: string } {
  const baseFields = {
    code: targetCode,
    name: targetName,
    programIds: [programId],
    scope: "GLOBAL" as const,
    durationPeriod: {
      durationPeriodType: "CALENDAR",
      durationPeriod: "YEARS",
      durationPeriodValue: 1,
    },
    requiresRegistration: false,
    retroAfterRegistration: false,
  };
  switch (target.kind) {
    case "COMPLETION": {
      const typeCode = stringOrNull(target.config["completionTargetTypeCode"]);
      if (typeCode === null) {
        return {
          skipped: "COMPLETION target requires completionTargetTypeCode in config",
        };
      }
      const payload = {
        ...baseFields,
        type: "COMPLETION",
        completionTargetTypeCode: typeCode,
      } as unknown as CreateCompletionTarget;
      return { payload };
    }
    case "COUNTER": {
      const typeCode = stringOrNull(target.config["counterTargetTypeCode"]);
      if (typeCode === null) {
        return {
          skipped: "COUNTER target requires counterTargetTypeCode in config",
        };
      }
      const targetValue =
        typeof target.config["targetValue"] === "number" ? target.config["targetValue"] : 1;
      const payload = {
        ...baseFields,
        type: "COUNTER",
        targetValue,
        counterTargetTypeCode: typeCode,
        isCappingTarget: false,
      } as unknown as CreateCounterTarget;
      return { payload };
    }
    case "MILESTONE": {
      const typeCode = stringOrNull(target.config["milestoneTargetTypeCode"]);
      const items = Array.isArray(target.config["items"]) ? target.config["items"] : null;
      if (typeCode === null) {
        return {
          skipped: "MILESTONE target requires milestoneTargetTypeCode in config",
        };
      }
      if (items === null || items.length === 0) {
        return {
          skipped: "MILESTONE target requires a non-empty items[] array in config",
        };
      }
      const payload = {
        ...baseFields,
        type: "MILESTONE",
        milestoneTargetTypeCode: typeCode,
        items,
      } as unknown as CreateMilestoneTarget;
      return { payload };
    }
    case "X_OF_Y": {
      const typeCode = stringOrNull(target.config["xofYTargetTypeCode"]);
      const itemTargetIds = Array.isArray(target.config["itemTargetIds"])
        ? target.config["itemTargetIds"]
        : null;
      const targetValue =
        typeof target.config["targetValue"] === "number" ? target.config["targetValue"] : null;
      if (typeCode === null) {
        return {
          skipped: "X_OF_Y target requires xofYTargetTypeCode in config",
        };
      }
      if (itemTargetIds === null || itemTargetIds.length === 0) {
        return {
          skipped: "X_OF_Y target requires a non-empty itemTargetIds[] array in config",
        };
      }
      if (targetValue === null) {
        return {
          skipped: "X_OF_Y target requires a numeric targetValue in config",
        };
      }
      const payload = {
        ...baseFields,
        type: "X_OF_Y",
        targetValue,
        itemTargetIds: itemTargetIds as string[],
        xofYTargetTypeCode: typeCode,
      } as unknown as CreateXOfYTarget;
      return { payload };
    }
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Re-export a no-op reference to `WizardBadge` so the TypeScript import
// surface stays stable if the spec.ts name changes in a future refactor.
// (Prevents drift in consumer tree-shaking.)
export type { WizardBadge };
