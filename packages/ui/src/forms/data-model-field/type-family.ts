/**
 * Family membership for DataModelTypes, resolved by walking the full
 * `parentTypeReference` ancestor chain.
 *
 * `parentTypeReference` holds a parent type's `code`, and inheritance is
 * arbitrarily deep: `COFFEELOYALTY_PURCHASE` → `CUSTOMEVENT` → `EVENT`. A
 * single-level check (`parentTypeReference === "EVENT"`) therefore sees only
 * the base categories and silently drops every real custom type.
 */

import type { DataModelType } from "@loom-loyalty/sdk";

import { getTypeClassification } from "../../entity/features/data-models/classification.js";
import { dataModelCodeKey } from "../../entity/features/data-models/code-key.js";

export interface TypeFamilyResult {
  /** Non-primitive types whose ancestor chain reaches `rootTypeCode` (the root itself included). */
  types: DataModelType[];
  /**
   * `parentTypeReference` values that matched no type in the input set. A
   * chain that hits one of these is unresolvable, so a legitimate descendant
   * gets dropped — the usual cause is a truncated fetch.
   */
  unresolvedParentRefs: string[];
}

export function filterTypesInFamily(
  types: readonly DataModelType[],
  rootTypeCode: string
): TypeFamilyResult {
  const byCode = new Map(types.map((type) => [dataModelCodeKey(type.code), type]));
  const rootKey = dataModelCodeKey(rootTypeCode);
  const unresolvedParentRefs = new Set<string>();

  const matches = types.filter((type) => {
    if (getTypeClassification(type) === "primitive") return false;

    const visited = new Set<string>();
    let current: DataModelType | undefined = type;
    while (current) {
      const currentKey = dataModelCodeKey(current.code);
      if (currentKey === rootKey) return true;
      if (visited.has(currentKey)) return false;
      visited.add(currentKey);

      const parentRef = current.parentTypeReference;
      if (!parentRef) return false;
      const parent = byCode.get(dataModelCodeKey(parentRef));
      if (!parent) {
        // Reported with the spelling the API actually gave us, so the message
        // names something a reader can search for.
        unresolvedParentRefs.add(parentRef);
        return false;
      }
      current = parent;
    }
    return false;
  });

  return { types: matches, unresolvedParentRefs: Array.from(unresolvedParentRefs) };
}
