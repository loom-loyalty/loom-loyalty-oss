/**
 * Shared policy for the AI-output verification gate: which entity types
 * require the checkbox before production enablement, and the checkbox's
 * copy. Kept as a leaf module (no component imports) so both
 * RequestEnableDialog and BulkEnableDialog can depend on it without a
 * circular import through the shared AiVerificationCheckbox component.
 */
import type { EntityType } from "@loom-loyalty/sdk";

/**
 * Entity types whose AI assistant (ExpressionAiBuilder) can produce the
 * expression logic that gates production enablement. No field exists yet
 * that records whether a given entity's *current* version was actually
 * AI-assisted (the wizard's `aiDrafted` state is session-local and
 * discarded on save), so the verification requirement below applies to
 * every request for these entity types, not only AI-assisted ones. Revisit
 * once a persisted AI-provenance field ships.
 */
export const AI_VERIFICATION_ENTITY_TYPES = ["event-rule", "customer-audience"] as const;

// The SDK's generated EntityType enum uses upper-snake-case for the same
// entities (e.g. BulkEnableDialog receives "EVENT_RULE", not "event-rule") —
// no existing mapping bridges the two vocabularies. `satisfies` ties this
// list to the real enum members so a rename or removal in the generated SDK
// is a compile error here, instead of silently disabling the gate for that
// entity type.
const AI_VERIFICATION_ENTITY_TYPES_UPPER_SNAKE = [
  "EVENT_RULE",
  "CUSTOMER_AUDIENCE",
] as const satisfies readonly EntityType[];

/** True when `entityType` (in either the kebab-case form RequestEnableDialog's
 * own `entityType` prop uses, or the SDK EntityType enum's upper-snake form
 * used by callers like BulkEnableDialog) requires the AI-output verification
 * checkbox. */
export function isAiVerificationRequiredEntityType(entityType: string): boolean {
  return (
    (AI_VERIFICATION_ENTITY_TYPES as readonly string[]).includes(entityType) ||
    (AI_VERIFICATION_ENTITY_TYPES_UPPER_SNAKE as readonly string[]).includes(entityType)
  );
}

/** Checkbox label and, until a durable audit record exists, the interim
 * attestation line appended to the submitted reason (see the append step
 * in RequestEnableDialog's submit handler). */
export const AI_VERIFICATION_COPY =
  "I have reviewed any AI-generated output as part of this entity and confirm its validity.";
