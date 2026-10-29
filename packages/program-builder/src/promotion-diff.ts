/**
 * computePromotionDiff — read-only dry-run API.
 *
 * Returns the same `created/skipped/conflicts` data as `runProgramExecutor`
 * would return, but WITHOUT making any create calls. The pre-scan is the
 * only side effect (and it's read-only).
 *
 * Used by:
 * - **BASIC-tier fallback** (orgs with no dev environment) — the wizard
 *   and AI chat call this against prod to render a PromotionDiff UI
 *   BEFORE any commit, then call `runProgramExecutor` only on user
 *   confirmation.
 * - **Dev → prod promotion gate** — after a successful dev run, the
 *   wizard calls this against prod to render the second-gate diff
 *   that the user has to approve before the prod commit.
 * - **Generic preview** — any caller that wants to see "what would
 *   happen if I ran this spec against this env" without side effects.
 *
 * Differences vs `runProgramExecutor`:
 * - Pure read. No creates, no metadata mutations, no test events.
 * - No `onProgress` callback (nothing is happening to report progress on).
 * - No `persist` (no state to persist).
 * - Returns a discriminated union with `'ok'` or `'lint-failed'` —
 *   no `'aborted'` because there are no writes that could partially
 *   complete.
 *
 * Per the plan's S1.2: this and `runProgramExecutor` share their pre-scan
 * implementation via the private `runPreScan` helper. Drift between the
 * two is structurally impossible because they call the same function.
 */

import { validateProgramSpec } from "./linter";
import { runPreScan } from "./pre-scan";
import type { ProgramSpec } from "./spec";
import type { ConflictEntry, EntityRef, EnvName, LintViolation } from "./types";

/**
 * Per-call context for `computePromotionDiff`.
 *
 * Note: `replayMode` is intentionally absent. A dry-run is always a
 * "what would skip-existing do here" question — strict mode dry-runs
 * don't have a useful semantic (the answer is always "everything
 * would be created or fail with collisions").
 */
export interface PromotionDiffContext {
  env: EnvName;
  environmentId: string;
}

/**
 * The result of `computePromotionDiff`.
 *
 * `'ok'` means the pre-scan ran successfully and the diff is ready
 * to render. The `created/skipped/conflicts` arrays answer "what
 * would happen if you ran the executor with `replayMode: 'skip-existing'`
 * right now":
 *   - `created` — entities the executor would create (not present in
 *     target env, or present with no usable identifier)
 *   - `skipped` — entities the executor would skip because they already
 *     exist with matching shape
 *   - `conflicts` — entities that exist in target env with a fatal
 *     shape mismatch. If this array is non-empty, the executor would
 *     refuse to run (return `conflict-diff`) and the user must resolve
 *     the conflicts before promotion can proceed.
 *
 * `'lint-failed'` means the spec itself is invalid. The pre-scan was
 * NOT run (no point fetching anything if the spec wouldn't execute).
 * Callers should resolve the lint violations before re-running the
 * dry-run.
 */
export type PromotionDiffResult =
  | {
      status: "ok";
      created: EntityRef[];
      skipped: EntityRef[];
      conflicts: ConflictEntry[];
    }
  | {
      status: "lint-failed";
      violations: LintViolation[];
    };

/**
 * Compute a promotion diff for a `ProgramSpec` against the current
 * runtime env. Read-only — no creates.
 *
 * IMPORTANT: this function uses the same SDK transport as the executor.
 * Callers must wrap it in `runWithSdkContext` from `@loom-loyalty/sdk`
 * when running on the server (Node) so the per-request JWT and base URL
 * are scoped correctly. Browser callers can rely on the SDK module-level
 * state (set via `setTokenProvider` / `setApiBaseUrl`).
 */
export async function computePromotionDiff(
  spec: ProgramSpec,
  // ctx is intentionally accepted but not currently consumed by the
  // pre-scan implementation — it's part of the public API so future
  // versions can route per-environment requests through env-aware SDK
  // clients without changing callers. The unused-parameter check is
  // disabled with the underscore prefix convention.
  _ctx: PromotionDiffContext
): Promise<PromotionDiffResult> {
  // 1. Lint the spec first. If it would fail to execute, the dry-run
  //    answer is "you have to fix the spec before promotion is meaningful".
  const lintResult = validateProgramSpec(spec);
  if (!lintResult.ok) {
    return { status: "lint-failed", violations: lintResult.violations };
  }

  // 2. Run the read-only pre-scan against the target env.
  const preScan = await runPreScan(spec);

  // 3. Convert the pre-scan result to the public dry-run shape. Note
  //    that `wouldCreate` and `wouldSkip` from the pre-scan are renamed
  //    to `created`/`skipped` here for API consistency with
  //    `ExecutorResult.success`. The semantic is "this is what the
  //    executor WOULD report if you ran it now".
  return {
    status: "ok",
    created: preScan.wouldCreate,
    skipped: preScan.wouldSkip,
    conflicts: preScan.conflicts,
  };
}
