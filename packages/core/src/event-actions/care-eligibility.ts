/**
 * Shared policy for which activities a customer care agent may be offered.
 *
 * Kept as a leaf module (no component imports) so the activity picker, the
 * registry administration surface, and their tests can all depend on one policy
 * without a circular import. Same shape and same rationale as
 * `packages/ui/src/entity/environment-workflow/ai-verification.ts`.
 *
 * The policy sits *between* the registry and the picker rather than inside
 * either. That placement is what makes the engine-announced exclusion
 * enforceable: the registry can return an engine-announced activity, a row
 * added by mistake, and the policy still withholds it.
 *
 * ## Why the classification is hardcoded here
 *
 * The registry deliberately carries no classification field. It used to, and a
 * tenant who could write their own registry could send
 * `{"eventTypeCode": "tier.issued", "inbound": true}` and switch off forgery
 * protection for their own organization. Classification is now compiled into
 * the platform catalogue and the column is gone. The registry can change which
 * console offers an activity, never what the submission guard will accept.
 *
 * That enum is not published to the frontend, so this list is a mirror of it.
 * Its source of truth is `EventTypeCode` in the API:
 * `api/event-engine/event-engine-domain/src/main/java/com/loomloyalty/api/eventengine/domain/event/event/EventTypeCode.java`
 *
 * The catalogue holds 35 codes: 22 the engine announces about itself and 13 the
 * caller asserts. `CATALOGUE_SIZE` and the per-list tests exist so that adding a
 * code to one list without accounting for it in the others fails loudly rather
 * than drifting silently.
 */

/**
 * Activities the engine announces about itself. Submitting one is forgery: it
 * drives downstream rules from a statement the platform never made.
 *
 * These can never be offered to a care agent on any surface. The platform's
 * gate on them requires a non-production environment and the developer scope,
 * and care agents work in production, so the branch is permanently closed to
 * them. This is not a curation choice; a registry row for one of these on the
 * care surface is a mistake, and the picker must withhold it.
 */
export const ENGINE_ANNOUNCED_ACTIVITY_CODES = [
  "customer.created",
  "customer.updated",
  "coupon.issued",
  "coupon.cancelled",
  "badge.issued",
  "tier.issued",
  "target.achieved",
  "target.cancelled",
  "target.registered",
  "target.unachieved",
  "target.counter.cycle.achieved",
  "target.counter.cycle.unachieved",
  "target.milestone.item.achieved",
  "target.milestone.item.unachieved",
  "target.xofy.item.achieved",
  "target.xofy.item.unachieved",
  "external-offer.issued",
  "external-offer.cancelled",
  "audience.member.added",
  "audience.member.removed",
  "flow.started",
  "flow.exited",
] as const;

/**
 * Activities the caller asserts that already have a bespoke mutation sheet on
 * the customer page. Those sheets write to their domain endpoints directly and
 * keep that behavior. Recording covers what has no sheet, so offering these
 * twice would give an agent two paths with different consequences.
 */
export const SHEET_SERVED_ACTIVITY_CODES = [
  "coupon.issue",
  "coupon.use",
  "badge.issue",
  "tier.issue",
] as const;

/**
 * The event lifecycle codes. These are the mechanisms for correcting and
 * cancelling an already-recorded activity, not activities to record, so they
 * never appear in the picker even though the caller asserts them.
 */
export const LIFECYCLE_ACTIVITY_CODES = ["event.cancel", "event.update"] as const;

/**
 * The caller-asserted platform activities with no bespoke sheet. These are the
 * platform activities a care agent may record; everything else offerable is
 * tenant-defined.
 *
 * Listed explicitly rather than derived so the catalogue arithmetic below can
 * check it, and so a reviewer can see the offer set without cross-referencing
 * three exclusion lists.
 */
export const OFFERABLE_PLATFORM_ACTIVITY_CODES = [
  "transaction",
  "event",
  "receipt.submitted",
  "coupon.hold",
  "coupon.return",
  "external-offer.issue",
  "external-offer.cancel",
] as const;

/**
 * Size of the platform catalogue (`EventTypeCode`). Every code is exactly one
 * of: engine-announced, sheet-served, lifecycle, or offerable-platform. If the
 * lists stop partitioning the catalogue, the arithmetic test fails.
 */
export const CATALOGUE_SIZE = 35;

const EXCLUDED_CODES: ReadonlySet<string> = new Set<string>([
  ...ENGINE_ANNOUNCED_ACTIVITY_CODES,
  ...SHEET_SERVED_ACTIVITY_CODES,
  ...LIFECYCLE_ACTIVITY_CODES,
]);

/** True when the activity is one the engine announces about itself. */
export function isEngineAnnouncedActivity(activityCode: string): boolean {
  return (ENGINE_ANNOUNCED_ACTIVITY_CODES as readonly string[]).includes(activityCode);
}

/**
 * Whether a care agent may be offered this activity.
 *
 * An unknown code is offerable. Tenant-defined activities are absent from the
 * platform catalogue by definition, which is what makes them tenant-defined,
 * and they classify as caller-asserted, so they need no registration to be
 * submittable. A hotel stay or a laundromat check-in reaches the picker through
 * exactly this branch.
 */
export function isCareOfferableActivity(activityCode: string): boolean {
  return !EXCLUDED_CODES.has(activityCode);
}
