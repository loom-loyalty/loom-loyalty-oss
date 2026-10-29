/**
 * Executor output types.
 *
 * These are the types produced by the (future) `runProgramExecutor`, the
 * linter, and the shape-diff module. The spec (inputs) lives in `./spec.ts`;
 * these types are everything on the output side.
 *
 * Keep these in sync with the plan at `docs/designs/ai-wizard-parity.md`
 * (section S1.1). This file is the canonical TypeScript definition.
 */

// ────────────────────────────────────────────────────────────────
// Environment
// ────────────────────────────────────────────────────────────────

/**
 * Environment the executor runs against. Callers pass one of these; the
 * BASIC-tier fallback maps "no dev env available" → `prod` at the call site,
 * not inside the executor. The executor only sees `dev` or `prod`.
 */
export type EnvName = "dev" | "prod";

// ────────────────────────────────────────────────────────────────
// Entity references
// ────────────────────────────────────────────────────────────────

/**
 * Every entity type the executor can create or diff against.
 *
 * Note: `metadata`, `metadataType`, and `customer` are dev-env-only creations.
 * They are NOT subject to cross-environment replay / shape-diff. See S1.4 in
 * the plan and the shape-diff module's handling.
 */
export type EntityType =
  | "program"
  | "currency"
  | "tier"
  | "badge"
  | "target"
  | "expiryRule"
  | "pendingRule"
  | "eventRule"
  | "eventType"
  | "eventTypeAction"
  | "offer"
  | "customer"
  | "metadataType"
  | "metadata";

/**
 * A reference to an entity the executor created, skipped, or found.
 *
 * The `code` is always populated and is the caller-deterministic identifier.
 * The `id` is populated once the server assigns one (may be absent for skipped
 * entities that were matched by code).
 */
export interface EntityRef {
  type: EntityType;
  id?: string;
  code: string;
  name?: string;
}

// ────────────────────────────────────────────────────────────────
// Execution stages + progress
// ────────────────────────────────────────────────────────────────

/**
 * Stages the executor moves through during a run.
 *
 * The order is defined by the executor's internal state machine (M2b). A run
 * may skip stages that aren't needed (e.g. `creating-expiry-rule` if the spec
 * has no expiry feature). Stages ALWAYS progress forward — no rollback.
 */
export type ExecutionStage =
  | "idle"
  | "linting"
  | "creating-metadata"
  | "creating-program"
  | "creating-expiry-rule"
  | "creating-pending-rule"
  | "creating-currency"
  | "creating-tiers"
  | "creating-badges"
  | "creating-tier-targets"
  | "creating-event-type"
  | "creating-award-rule"
  | "creating-base-tier-rule"
  | "creating-tier-progression-rules"
  | "creating-tier-bonus-rules"
  | "creating-signup-bonus"
  | "creating-birthday-bonus"
  | "creating-promotions"
  | "creating-customer"
  | "firing-event"
  | "complete"
  | "error";

/**
 * A progress event the executor emits to its caller via `ExecutorContext.onProgress`.
 *
 * `percent` is advisory only — callers that want a deterministic progress
 * bar should compute it from the stage order, not from this field.
 */
export interface ProgressEvent {
  stage: ExecutionStage;
  action: "started" | "created" | "skipped" | "errored";
  ref?: EntityRef;
  message?: string;
  /** 0-100, advisory */
  percent: number;
}

// ────────────────────────────────────────────────────────────────
// Linter violations
// ────────────────────────────────────────────────────────────────

/**
 * A violation produced by `validateProgramSpec` or `validateProgramSpecPartial`.
 *
 * `path` uses dot-notation for nested spec fields (e.g. `tiers[1].code`,
 * `autoAwardBaseTier`, `selectedFeatures.programCurrency`).
 *
 * `severity: 'error'` blocks execution — the executor refuses to run if any
 * error-level violation exists. `severity: 'warning'` is advisory and does
 * not block execution.
 *
 * `code` is a stable identifier (kebab-case). Callers that want to render
 * per-rule UI should switch on `code`, not on `message`.
 *
 * `fix` is a human-readable remediation hint, suitable for inline help text.
 */
export interface LintViolation {
  path: string;
  code: string;
  severity: "error" | "warning";
  message: string;
  fix?: string;
}

// ────────────────────────────────────────────────────────────────
// Shape diff (replay conflict detection)
// ────────────────────────────────────────────────────────────────

/**
 * A single field mismatch between the spec's expected entity and the
 * target-env's actual entity.
 *
 * `significance: 'fatal'` means the two entities represent meaningfully
 * different data — skip-existing replay must abort with a conflict-diff.
 * `significance: 'warning'` means the difference is cosmetic (e.g. display
 * name changed) — the replay may proceed and just skip the entity.
 */
export interface ShapeFieldDiff {
  path: string;
  expected: unknown;
  actual: unknown;
  significance: "fatal" | "warning";
}

/**
 * A shape diff for a single entity.
 *
 * Returned from `computeEntityShapeDiff` when the spec's entity has a
 * collision with an existing one in the target env.
 */
export interface ShapeDiff {
  type: EntityType;
  fields: ShapeFieldDiff[];
}

/**
 * A replay conflict entry — a single entity from the spec that collides
 * with an existing one in the target environment.
 *
 * `kind: 'code-only'` means we matched by code but haven't computed a deep
 * diff yet (or one isn't applicable — e.g. metadata types are org-wide and
 * always considered code-only matches).
 *
 * `kind: 'shape-diff'` includes the full field-level diff for UI rendering.
 */
export interface ConflictEntry {
  ref: EntityRef;
  kind: "code-only" | "shape-diff";
  diff?: ShapeDiff;
}

// ────────────────────────────────────────────────────────────────
// Executor errors
// ────────────────────────────────────────────────────────────────

/**
 * Error thrown or returned by the executor when a stage fails.
 *
 * Never extends the native Error hierarchy directly in this file because
 * the file is target-agnostic (Node + browser). We use a plain class and
 * let the executor rethrow as needed.
 */
export class ExecutorError extends Error {
  public readonly stage: ExecutionStage;
  public readonly ref: EntityRef | null;
  public readonly cause: unknown;

  constructor(stage: ExecutionStage, ref: EntityRef | null, cause: unknown, message: string) {
    super(message);
    this.name = "ExecutorError";
    this.stage = stage;
    this.ref = ref;
    this.cause = cause;
  }
}

/**
 * Thrown when a non-standard typeCode can't be resolved (no tenant
 * record, no `typeName` on spec). Caught by the executor's main loop
 * and surfaced as the `needs-type-pick` result variant — a structured
 * request for input, not a failure.
 */
export class NeedsTypePickError extends Error {
  public readonly kind: "PROGRAM_TYPE" | "CURRENCY_TYPE";
  public readonly typeCode: string;

  constructor(kind: "PROGRAM_TYPE" | "CURRENCY_TYPE", typeCode: string) {
    super(
      `Cannot resolve ${kind} "${typeCode}" — typeCode is not in the standard set, no metadata exists on the tenant, and no display name was supplied. Provide spec.${kind === "PROGRAM_TYPE" ? "program.typeName" : "currency.currencyTypeName"} or pick an existing code from the tenant.`
    );
    this.name = "NeedsTypePickError";
    this.kind = kind;
    this.typeCode = typeCode;
  }
}

// ────────────────────────────────────────────────────────────────
// Execution results
// ────────────────────────────────────────────────────────────────

/**
 * The accumulating results from an executor run.
 *
 * Populated stage-by-stage as entities are created. Carried in
 * `ExecutorResult.results` on success and `ExecutorResult.partialResults`
 * on abort. The persistence layer writes this incrementally so a browser
 * refresh or chat crash mid-run can resume from where it left off.
 */
export interface ExecutionResults {
  programId?: string;
  /** Canonical program code from the create-program SDK response. */
  programCode?: string;
  currencyId?: string;
  /** Currency code — stored so later stages (award rule) can reference it
   *  even when spec.currency.code wasn't populated (e.g., event-based wizard). */
  currencyCode?: string;
  expiryRuleId?: string;
  pendingRuleId?: string;
  eventRuleId?: string;
  signupBonusRuleId?: string;
  birthdayBonusRuleId?: string;
  /**
   * Tier codes created during `creating-tiers`. Note: tiers are addressed
   * by code throughout the API (the SDK's Tier type has no server-side
   * `tierId` field), so the code IS the canonical identifier.
   */
  tierCodes?: string[];
  badgeIds?: string[];
  targetIds?: string[];
  /**
   * Tier code → server-side targetId mapping. Carried in results (not just
   * component state) so resume after a partial failure can find existing
   * targets without re-creating them. Without this, a retry that succeeded
   * at creating-tier-targets would have an empty in-memory Map and crash
   * creating-tier-progression-rules with "Missing target for tier X". See
   * `apps/hub/src/features/program-wizard/steps/fire-event-step.tsx:264`
   * for the original wizard implementation that motivated this field.
   */
  tierCodeToTargetId?: Record<string, string>;
  baseTierRuleId?: string;
  tierProgressionRuleIds?: string[];
  /** Event rule IDs created during `creating-tier-bonus-rules`, one per non-1.0× tier. */
  tierBonusRuleIds?: string[];
  /**
   * Results of `creating-promotions`. One entry per promotion in spec.promotions,
   * holding the created event type / target / event rule IDs so downstream
   * tooling (apply-update, e2e assertions) can find them.
   */
  promotions?: Array<{
    code: string;
    eventTypeId?: string;
    targetIds: string[];
    eventRuleIds: string[];
    /**
     * Coupon Offer IDs created (or matched via pre-scan) for promotions
     * containing FREE_ITEM rules. One per promotion — all FREE_ITEM rules
     * on a promotion share the same offer (per #493). Empty for
     * promotions without FREE_ITEM rules. Always initialized (matches
     * the `targetIds` / `eventRuleIds` pattern).
     */
    offerIds: string[];
  }>;
  /**
   * Per-stage advisory messages surfaced during execution. Today only
   * `runCreatingPromotions` populates this — when a promotion target's
   * required config field (e.g. `completionTargetTypeCode`) is missing,
   * the executor skips Target creation and pushes a warning here so the
   * UI / CLI can surface "X promotion targets were skipped — fill in
   * the missing typeCode and re-run".
   */
  warnings?: string[];
  eventTypeId?: string;
  customerId?: string;
  testEventId?: string;
  /**
   * Client-side ESTIMATE of points the rule should award based on the
   * template configuration. Not the API-confirmed value — the publish
   * response doesn't return a synchronous awarded amount because rule
   * processing is async. The UI displays this as "expected" not "awarded"
   * so users aren't misled.
   */
  expectedPoints?: number;
  /** Status of the test event as reported by the publishEvent API. */
  testEventStatus?: string;
}

/**
 * The result of a call to `runProgramExecutor`.
 *
 * Exhaustive union of every terminal state:
 * - `success`: all stages ran to completion.
 * - `lint-failed`: the linter found error-level violations; no API calls were made.
 * - `conflict-diff`: pre-scan found a fatal shape mismatch; no writes were made.
 * - `aborted`: a stage failed mid-run; `partialResults` reflects what DID get created.
 */
export type ExecutorResult =
  | {
      status: "success";
      created: EntityRef[];
      skipped: EntityRef[];
      results: ExecutionResults;
    }
  | {
      status: "lint-failed";
      violations: LintViolation[];
    }
  | {
      status: "conflict-diff";
      conflicts: ConflictEntry[];
      wouldCreate: EntityRef[];
      wouldSkip: EntityRef[];
    }
  | {
      status: "aborted";
      stage: ExecutionStage;
      error: ExecutorError;
      partialResults: ExecutionResults;
    }
  | {
      /** Non-standard typeCode that needs a picker round-trip — caller
       *  patches spec with the chosen code or `typeName`, then re-runs. */
      status: "needs-type-pick";
      kind: "PROGRAM_TYPE" | "CURRENCY_TYPE";
      typeCode: string;
      partialResults: ExecutionResults;
    };

// ────────────────────────────────────────────────────────────────
// Executor context (input)
// ────────────────────────────────────────────────────────────────

/**
 * Per-run context passed to `runProgramExecutor`.
 *
 * The executor doesn't need an `sdkClient` field because cross-request
 * isolation is handled via `runWithSdkContext` from @loom-loyalty/sdk.
 * Callers wrap the executor call in that helper; the executor imports
 * orval-generated SDK functions directly and they read from the scoped
 * context via AsyncLocalStorage (Node) or module state (browser).
 */
export interface ExecutorContext {
  env: EnvName;
  environmentId: string;
  onProgress?: (event: ProgressEvent) => void;
  /**
   * Strict: fail on any pre-existing entity.
   * Skip-existing: pre-scan + shape-diff; skip matching entities, abort with
   * conflict-diff on fatal mismatches.
   *
   * Per-run, not per-entity-type. Mixed semantics are not supported in Phase 1.
   */
  replayMode: "strict" | "skip-existing";
  /**
   * Require metadata referenced by the spec to be declared in
   * `spec.metadata`. AI runs enable this because they cannot ensure metadata
   * exists out of band; interactive callers leave it unset.
   */
  requireExplicitMetadata?: boolean;
  /**
   * Persist a snapshot of `partialResults` after each stage transition.
   *
   * Wizard supplies a localStorage write keyed by
   * `loom-program-wizard-spec-v1-<orgId>`; AI server supplies a langgraph
   * checkpointer write keyed by thread ID. Without this, browser refresh or
   * chat crash mid-run loses all entity IDs and resume cannot find
   * tierCodeToTargetId / programId / etc.
   *
   * The callback MUST be idempotent — the executor may call it multiple
   * times with the same snapshot if a stage is re-run.
   */
  persist?: (partial: ExecutionResults) => Promise<void>;
}
