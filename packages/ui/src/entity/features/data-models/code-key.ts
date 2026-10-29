/**
 * One canonical way to COMPARE a DataModelType code.
 *
 * Codes are migrating from `UPPER_SNAKE` to the resource-code convention
 * (`CUSTOM_EVENT` becomes `custom-event`), and the client
 * sits on both sides of that migration at once:
 *
 * - Client-side literals (`EVENT_FAMILY_ROOT_CODE`, `"METADATA"`, the primitive
 *   palette) cannot track the rename. Pinning one to either spelling breaks
 *   against builds of the other, which is what got #755 reverted.
 * - Two API-sourced values can disagree with each other mid-migration: a
 *   tenant's custom type may still store `parentTypeReference: "CUSTOM_EVENT"`
 *   while the system type it names has already become `custom-event`.
 *
 * Folding case and separators resolves both, and mirrors the platform's own
 * permanent both-spellings fallback for DataModelType reads
 * (`SystemDataModelType.fromCode()`).
 *
 * Use this for comparison, membership, and dedupe keys ONLY. Never send the
 * folded value: a code that is transmitted must keep whichever spelling its
 * source gave it, because `CreateDataModelType.code` validates the real thing.
 * To GENERATE a code, use `toResourceCode` from `@loom-loyalty/conventions`.
 */
export function dataModelCodeKey(code: string | undefined): string {
  return (code ?? "").trim().toLowerCase().replace(/[_-]+/g, "-");
}

/**
 * True when two codes name the same type, ignoring the migration's spelling
 * difference. `sameDataModelCode("CUSTOM_EVENT", "custom-event")` is true.
 */
export function sameDataModelCode(a: string | undefined, b: string | undefined): boolean {
  return dataModelCodeKey(a) === dataModelCodeKey(b);
}
