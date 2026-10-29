/**
 * Execution Helpers
 *
 * Pure utility functions used by the program executor. These were originally
 * located at `apps/hub/src/features/program-wizard/lib/execution-helpers.ts`
 * and moved here in M2b so both the wizard and the AI onboarding agent can
 * share the same helpers via @loom-loyalty/program-builder.
 */

import { isApiErrorCode } from "@loom-loyalty/sdk/core";

import type { WizardTier } from "./spec";

/**
 * Extract a human-readable error message from an unknown error value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "An unexpected error occurred";
}

/**
 * Wrap a SDK call with structured error surfacing.
 *
 * On thrown error, extracts `apiError.message` / `statusCode` / `code` /
 * `details` (the shape produced by `packages/sdk/src/core/sdk-client.ts`
 * when the API returns non-2xx) and rethrows a new Error prefixed with the
 * stage description, preserving the SDK's structured fields via
 * `Object.assign` so downstream pattern-matching (e.g. `result.error.code
 * === "DUPLICATE_RULE_CODE"`) keeps working.
 *
 * Use this around every executor SDK call. Without it, the wrapped Error
 * carries only the formatted message string and the structured error data
 * is lost — debuggers see "Failed to create X" with no clue what the API
 * actually said.
 */
export async function wrapApiCall<T>(stageDescription: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const apiError = (err ?? {}) as {
      message?: string;
      status?: number;
      statusCode?: number;
      code?: string;
      details?: unknown;
      requestId?: string;
      params?: unknown;
      fieldErrors?: unknown;
    };
    const detail = apiError.message ?? String(err);
    const status = apiError.statusCode ? ` (status ${String(apiError.statusCode)})` : "";
    const wrapped = new Error(`${stageDescription}${status}: ${detail}`);
    Object.assign(wrapped, {
      code: apiError.code,
      status: apiError.status,
      statusCode: apiError.statusCode,
      details: apiError.details,
      requestId: apiError.requestId,
      params: apiError.params,
      fieldErrors: apiError.fieldErrors,
    });
    throw wrapped;
  }
}

/**
 * Return tiers sorted by pointsThreshold ascending.
 *
 * This is the canonical order for rank assignment and base-tier detection.
 * Users may add tiers out of threshold order in the UI (e.g. Gold first,
 * then Silver); the execution engine must always produce rank=1 → lowest
 * threshold → base tier. Without this, the auto-award rule would give the
 * highest-threshold tier to every new customer on signup.
 */
export function getSortedTiers(tiers: WizardTier[] | undefined): WizardTier[] {
  return [...(tiers ?? [])].sort((a, b) => a.pointsThreshold - b.pointsThreshold);
}

/**
 * Return non-base tiers (pointsThreshold > 0) in sorted order.
 *
 * Base tier is the one with pointsThreshold === 0, by convention. This
 * helper is used by creating-tier-targets and creating-tier-progression-rules
 * to ensure they operate on the same set of tiers in the same order.
 */
export function getNonBaseTiers(tiers: WizardTier[] | undefined): WizardTier[] {
  return getSortedTiers(tiers).filter((t) => t.pointsThreshold > 0);
}

/**
 * Check whether an error indicates a 409 Conflict / already-exists state.
 *
 * Used to decide whether to swallow or re-throw in idempotent creation
 * paths. Previously these catches were empty `catch {}` blocks that
 * silently masked network errors and validation failures as "already
 * exists" — causing downstream stages to fail with misleading errors.
 *
 * Detection order:
 *
 * 0. **Catalog code first.** A `DUPLICATE_RESOURCE` or `CONFLICT` code from
 *    the API decides it outright. The checks below are the fallback for
 *    endpoints that do not send codes yet; remove them once every domain
 *    batch has shipped.
 *
 * 1. **Structured statusCode === 409 next.** Errors that pass through
 *    `wrapApiCall` carry the SDK's HTTP status as `error.statusCode`.
 *    Trust it. A 400 with a body that happens to contain "conflict:" or
 *    "duplicate key" is NOT an exists-error and must not be swallowed —
 *    substring matching on a structured 400 would have hidden it.
 *
 * 2. **Substring fallback** for errors without a statusCode (sync throws,
 *    re-thrown stage errors, plain `new Error("...")`). The phrases are
 *    intentionally tight — a bare `msg.includes("exists")` would also
 *    match 404 messages like "No such configuration exists" and silently
 *    drop them. Only match unambiguous "already created" wording:
 *      - "already exists" — standard 409 phrasing
 *      - 409 status code as a whole word — \b409\b avoids "4090 pending"
 *      - "duplicate key" / "duplicate entry" / "unique constraint"
 *      - "conflict:" — colon-terminated prefix common in HTTP bodies
 *
 *    "conflict error" was previously matched but removed because phrases
 *    like "merge conflict error in config" would false-match. Use the
 *    colon-prefixed form instead.
 */
export function isExistsError(error: unknown): boolean {
  if (isApiErrorCode(error, "DUPLICATE_RESOURCE", "CONFLICT")) return true;
  if (typeof error === "object" && error !== null) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number") {
      if (statusCode === 409) return true;
      // Some platform endpoints leak Postgres unique-constraint violations
      // as HTTP 500 instead of translating to 409 (notably metadata data
      // types when the (organization_id, metadata_type_id, code) key is
      // already used). The phrase "duplicate key value ... violates unique
      // constraint" is the standard Postgres template — accept it as a
      // conflict signal even though the status is wrong. Both substrings
      // are required so a 500 that merely mentions "duplicate" or
      // "constraint" alone doesn't false-match. Remove once the platform
      // returns 409 here.
      if (statusCode === 500) {
        const msg = getErrorMessage(error).toLowerCase();
        return msg.includes("duplicate key value") && msg.includes("violates unique constraint");
      }
      // Any other numeric statusCode short-circuits the substring fallback.
      // A 400 / 404 with phrasing like "already exists" or "conflict:" in
      // the body is intentionally NOT swallowed — the structured status is
      // authoritative.
      return false;
    }
  }
  const msg = getErrorMessage(error).toLowerCase();
  return (
    msg.includes("already exists") ||
    /\b409\b/.test(msg) ||
    msg.includes("duplicate key") ||
    msg.includes("duplicate entry") ||
    msg.includes("unique constraint") ||
    msg.includes("conflict:")
  );
}

/**
 * Swallow "already exists" errors, re-throw everything else with context.
 *
 * This replaces empty `catch {}` blocks that silently masked real
 * failures. Networking errors, auth errors, and validation errors now
 * propagate with a labelled message pointing at the entity that failed.
 */
export function ignoreIfExists(error: unknown, entityLabel: string): void {
  if (isExistsError(error)) {
    return;
  }
  throw new Error(`Failed to create ${entityLabel}: ${getErrorMessage(error)}`);
}

/**
 * Sanitize a program code to the first segment of an event type code.
 *
 * Event type codes must match the API regex ^[a-z]+(?:\.[a-z0-9]+)*$:
 *   - first segment must be letters only (no digits, no hyphens, no underscores)
 *   - subsequent segments (after a period) allow alphanumeric
 */
export function sanitizeProgramCodeForEventType(rawCode: string | undefined): string {
  return (rawCode || "program").toLowerCase().replace(/[^a-z]/g, "") || "program";
}

/**
 * Well-known platform-level event types that are NOT scoped to a program.
 * The platform fires `birthday` (global) when a customer's birthday hits;
 * a promotion bound to `<programcode>.birthday` would never match. Same for
 * `customer.created` (signup flow). Add to this set whenever the platform
 * introduces another global event type.
 */
export const GLOBAL_EVENT_TYPE_CODES: ReadonlySet<string> = new Set([
  "birthday",
  "customer.created",
]);

/**
 * Sanitize an LLM-emitted promotion event type code to the platform's
 * required shape (lowercase, period-separated segments). Falls back to
 * `promotion.event${fallbackIndex}` when the input strips to empty so two
 * prose-only inputs don't collide on the same dataModel/EVENT_TYPE.
 *
 * Exported so the executor and pre-scan derive the same scoped code.
 */
export function sanitizePromoEventCode(rawCode: string, fallbackIndex: number): string {
  return (
    rawCode
      .toLowerCase()
      .replace(/[_-]+/g, ".")
      .replace(/[^a-z0-9.]/g, "")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "") || `promotion.event${fallbackIndex}`
  );
}

/**
 * Apply program scoping to a sanitized promotion event code. Global event
 * types pass through as-is so promotions can bind to platform-level events.
 */
export function scopePromoEventTypeCode(
  sanitizedProgramCode: string,
  sanitizedPromoEventCode: string
): string {
  return GLOBAL_EVENT_TYPE_CODES.has(sanitizedPromoEventCode)
    ? sanitizedPromoEventCode
    : `${sanitizedProgramCode}.${sanitizedPromoEventCode}`;
}

/**
 * Re-exported from `@loom-loyalty/conventions`, which now owns both code
 * conventions and their generators. Kept here because this module has been the
 * import site for both since the resource-code work started, and because the
 * caveat below is specific to what this executor does with them.
 *
 * Prefer importing from `@loom-loyalty/conventions` in new code.
 *
 * `toResourceCode` exists because an EVENT TYPE code and a DATA MODEL TYPE code
 * are different namespaces with different rules, and this executor has
 * historically reused one as the other:
 *
 *   - event type codes are dot-namespaced (`myprogram.purchase`) and are NOT
 *     part of the resource-code migration — use `toEventTypeCode` for those
 *   - data model type codes must be hyphen-separated lowercase, so a dot or an
 *     underscore or any uppercase letter is rejected outright
 *
 * A code that reads fine as an event type therefore 400s as a data model type.
 *
 * **NOT for Metadata or MetadataType codes.** Their `code` is unconstrained —
 * no pattern, no length bound — so the API accepts any string, and `UPPER_SNAKE`
 * is a convention those values happen to follow rather than a rule. Lookups on
 * them are case-insensitive but separator-sensitive, so rewriting
 * `COUNTER_TARGET_TYPE` to `counter-target-type` stops matching the stored row.
 * Because nothing validates the field there is no 400 to reveal it: the lookup
 * just silently finds nothing.
 */
export {
  isEventTypeCode,
  isResourceCode,
  RESOURCE_CODE_PATTERN,
  toEventTypeCode,
  toResourceCode,
} from "@loom-loyalty/conventions";
