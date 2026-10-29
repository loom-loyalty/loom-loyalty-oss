import type { CreateMetadataTypeCategory } from "@loom-loyalty/sdk";

import type { MetadataRecord, ProgramSpec } from "../spec.js";
import type { DeepPartial, Warning } from "./types.js";

// Built-in SDK types that pre-exist on every tenant; instance rows for
// these don't need a TYPE row in the same spec to be considered well-formed.
const STANDARD_METADATA_TYPE_CODES: ReadonlySet<string> = new Set([
  "PROGRAM_TYPE",
  "CURRENCY_TYPE",
  "EVENT_TYPE",
  "BADGE_TYPE",
  "COUNTER_TARGET_TYPE",
  "DATA_TYPE",
]);

// Manually mirrors the SDK's CreateMetadataTypeCategory union. The
// `readonly CreateMetadataTypeCategory[]` annotation is a one-directional
// drift guard: removing a value from the SDK union surfaces a TS error here,
// but ADDING a new SDK category does NOT — that requires a hand edit. After
// `pnpm generate:api`, grep for CreateMetadataTypeCategory and update.
// Type-only import keeps this side-effect-free for consumers that mock
// @loom-loyalty/sdk at runtime.
const KNOWN_METADATA_CATEGORIES_LIST: readonly CreateMetadataTypeCategory[] = [
  "METADATA",
  "LOCATION",
  "ITEM",
  "DATA_TYPE",
];
const KNOWN_METADATA_CATEGORIES: ReadonlySet<string> = new Set(KNOWN_METADATA_CATEGORIES_LIST);

/**
 * Emit warnings when the assembled spec's program/currency typeCodes have
 * no matching metadata row (executor will fail at creating-program/currency
 * with a cryptic 400 otherwise) or when an instance row references a
 * typeCode that no TYPE row in the same spec defines and is not one of the
 * standard SDK types.
 */
export function checkMetadataConsistency(
  partial: DeepPartial<ProgramSpec>,
  pushWarning: (w: Warning) => void
): void {
  const metadata = (partial.metadata ?? []) as MetadataRecord[];

  const programTypeCode = partial.program?.typeCode;
  if (programTypeCode) {
    const hasMatch = metadata.some(
      (r) => r?.typeCode === "PROGRAM_TYPE" && r?.code === programTypeCode
    );
    if (!hasMatch) {
      pushWarning({
        code: "metadata-missing-program-type",
        message: `program.typeCode is "${programTypeCode}" but no PROGRAM_TYPE metadata row defines it. Add a row { category, typeCode: PROGRAM_TYPE, code: ${programTypeCode}, name } or ensure the type pre-exists on the tenant — otherwise execution fails at creating-program.`,
        field: "program.typeCode",
      });
    }
  }

  const currencyTypeCode = partial.currency?.currencyTypeCode;
  if (currencyTypeCode) {
    const hasMatch = metadata.some(
      (r) => r?.typeCode === "CURRENCY_TYPE" && r?.code === currencyTypeCode
    );
    if (!hasMatch) {
      pushWarning({
        code: "metadata-missing-currency-type",
        message: `currency.currencyTypeCode is "${currencyTypeCode}" but no CURRENCY_TYPE metadata row defines it. Add a row { category, typeCode: CURRENCY_TYPE, code: ${currencyTypeCode}, name } or ensure the type pre-exists on the tenant — otherwise execution fails at creating-currency.`,
        field: "currency.currencyTypeCode",
      });
    }
  }

  // Spec-internal TYPE-row index: typeCodes that this spec defines as types.
  const typeCodesDefinedHere = new Set<string>();
  for (const r of metadata) {
    if (!r) continue;
    if (r.code === undefined || r.code === "") {
      typeCodesDefinedHere.add(r.typeCode);
    }
  }

  for (const r of metadata) {
    if (!r) continue;
    if (r.code === undefined || r.code === "") continue;
    const known =
      typeCodesDefinedHere.has(r.typeCode) || STANDARD_METADATA_TYPE_CODES.has(r.typeCode);
    if (!known) {
      pushWarning({
        code: "metadata-orphan-instance",
        message: `Metadata row defines instance "${r.code}" of typeCode "${r.typeCode}" but no TYPE row in this spec defines that typeCode. The tenant must already have it registered — otherwise execution fails at creating-metadata.`,
        field: "metadata",
      });
    }
  }

  // Catch category typos. Deduped by category value — a 50-row spec all
  // sharing one typo emits one warning, not 50 identical ones.
  const warnedCategories = new Set<string>();
  for (const r of metadata) {
    if (!r) continue;
    if (KNOWN_METADATA_CATEGORIES.has(r.category)) continue;
    if (warnedCategories.has(r.category)) continue;
    warnedCategories.add(r.category);
    pushWarning({
      code: "unknown-metadata-category",
      message: `Metadata row uses category "${r.category}" which is not in the SDK enum (${Array.from(KNOWN_METADATA_CATEGORIES).sort().join(", ")}). The platform may accept tenant-custom categories, but typos here usually surface as a 400 at execution.`,
      field: "metadata[].category",
    });
  }
}
