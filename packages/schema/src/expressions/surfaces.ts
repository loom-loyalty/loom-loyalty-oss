/**
 * Surface-scoped operator vocabularies.
 *
 * Event rules, customer audiences, and campaigns all emit the same Expression
 * AST, but they do NOT share the same operator set:
 *
 *  - **Event surface** (event-rule WHEN/WHAT): the tree is evaluated against a
 *    single inbound event. The five event-window/aggregate operators
 *    (`eventCount`, `eventSum`, `eventExists`, `lastEventTime`, `funnelStage`)
 *    have no meaning there — they are not valid for single-event evaluation —
 *    so they MUST be gated out of the event vocabulary.
 *  - **Customer surface** (audiences): evaluated over historical customer
 *    state, where the event-window operators are exactly the point. Everything
 *    the event surface can express is also valid here, except the
 *    metadata-hierarchy operators, which need event-engine resolvers.
 *
 * The allowlists are the authority for prompt grounding (surface-scoped
 * generation) and for client-side gating; they are intentionally
 * field-name-independent so they can be frozen ahead of the Zod bodies.
 */

/** Every operator name in the corrected DSL (34 total). */
export const ALL_OPERATORS = [
  // Composite (logical)
  "and",
  "or",
  "not",
  // Equality
  "equals",
  "notEquals",
  // Numeric comparison
  "greaterThan",
  "greaterThanEquals",
  "lessThan",
  "lessThanEquals",
  "between",
  // String
  "startsWith",
  "endsWith",
  "matches",
  "empty",
  "notEmpty",
  // Collection
  "in",
  "notIn",
  "containsAny",
  "containsAll",
  // Structural / meta
  "exists",
  "notExists",
  "true",
  // Domain (loyalty)
  "hasBadge",
  "currentTier",
  "targetCompleted",
  "hasProgramCurrency",
  // Metadata hierarchy (event-only)
  "isMetadataType",
  "inMetadataGroup",
  "isChildMetadata",
  // Event-window / aggregate (audience-only)
  "eventCount",
  "eventSum",
  "eventExists",
  "lastEventTime",
  "funnelStage",
] as const;

export type OperatorName = (typeof ALL_OPERATORS)[number];

/**
 * Audience-only operators. These are not valid for single-event evaluation on
 * the event surface, so they persist as dead rules if emitted there — the exact
 * silent-failure the DSL correction exists to prevent.
 */
export const AUDIENCE_ONLY_OPERATORS: readonly OperatorName[] = [
  "eventCount",
  "eventSum",
  "eventExists",
  "lastEventTime",
  "funnelStage",
] as const;

/**
 * Event-only operators. They need the metadata resolvers only the event engine
 * supplies, so the backend registers them with `surfaces = EVENT` and does not
 * offer them to customer segments.
 */
export const EVENT_ONLY_OPERATORS: readonly OperatorName[] = [
  "isMetadataType",
  "inMetadataGroup",
  "isChildMetadata",
] as const;

/** Operators valid on the event surface (event-rule WHEN/WHAT). */
export const EVENT_OPERATORS: readonly OperatorName[] = ALL_OPERATORS.filter(
  (op) => !AUDIENCE_ONLY_OPERATORS.includes(op)
);

/** Operators valid on the customer surface (audiences). */
export const CUSTOMER_OPERATORS: readonly OperatorName[] = ALL_OPERATORS.filter(
  (op) => !EVENT_ONLY_OPERATORS.includes(op)
);

/**
 * Operators removed from the DSL (rejected on ingest). `isMetadataType` and
 * `inMetadataGroup` used to be listed here; the backend now accepts them on the
 * event surface, so the list is empty. Kept so tooling can still guard removals.
 */
export const REMOVED_OPERATORS: readonly string[] = [];

/**
 * Operators valid on the feed surface (event feed skip conditions and condition checks). The
 * tree is evaluated against one file row, which carries no history or customer state, so only
 * in-row operators are allowed. Pattern matching belongs to the feed's PATTERN check, so
 * `matches` is left out. Keep this list in step with the operators the Platform API accepts there.
 */
export const FEED_OPERATORS: readonly OperatorName[] = [
  "and",
  "or",
  "not",
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanEquals",
  "lessThan",
  "lessThanEquals",
  "between",
  "startsWith",
  "endsWith",
  "empty",
  "notEmpty",
  "in",
  "notIn",
  "containsAny",
  "containsAll",
  "exists",
  "notExists",
  "true",
] as const;

/** A surface the AI expression generator grounds against. */
export type ExpressionSurface = "event" | "customer";

/** Every surface with an operator allowlist; feeds are edited by hand only. */
export type OperatorSurface = ExpressionSurface | "feed";

/** The operator allowlist for a given surface. */
export function operatorsForSurface(surface: OperatorSurface): readonly OperatorName[] {
  if (surface === "feed") return FEED_OPERATORS;
  return surface === "event" ? EVENT_OPERATORS : CUSTOMER_OPERATORS;
}

/** Whether an operator name is permitted on the given surface. */
export function isOperatorAllowed(surface: OperatorSurface, operator: string): boolean {
  return operatorsForSurface(surface).includes(operator as OperatorName);
}
