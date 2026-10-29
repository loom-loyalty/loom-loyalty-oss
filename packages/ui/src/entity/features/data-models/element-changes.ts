/**
 * Element change planning for editing an existing DataModel.
 *
 * The platform persists elements one at a time:
 *   POST   /data-models/{id}/data-elements               (add)
 *   PUT    /data-models/{id}/data-elements/{elementId}   (update)
 *   DELETE /data-models/{id}/data-elements/{elementId}   (delete)
 * `PUT /data-models/{id}` ignores elements, and system-managed elements refuse
 * update/delete. This module diffs the edit form's rows against the saved
 * elements and returns the per-element operations to run, in a safe order
 * (deletes, then updates, then creates, so a removed attribute can be re-added).
 */

import type {
  CreateDataModelElement,
  DataModelElement,
  UpdateDataModelElement,
} from "@loom-loyalty/sdk";

import { elementToFormData, formDataToElement, type DataModelElementFormData } from "./types.js";

export type DataModelElementOperation =
  | { kind: "delete"; elementId: string; name: string }
  | {
      kind: "update";
      elementId: string;
      name: string;
      rowKey?: string;
      data: UpdateDataModelElement;
    }
  | { kind: "create"; name: string; rowKey?: string; data: CreateDataModelElement };

/**
 * Callbacks the edit form uses to persist element changes. Each returns the
 * saved element when the API responds with one.
 */
export interface DataModelElementOperations {
  createElement: (data: CreateDataModelElement) => Promise<DataModelElement | undefined>;
  updateElement: (
    elementId: string,
    data: UpdateDataModelElement
  ) => Promise<DataModelElement | undefined>;
  deleteElement: (elementId: string) => Promise<void>;
  /** Called once every operation has succeeded (e.g. to refetch and close). */
  onSaved: () => void | Promise<void>;
}

/**
 * Fields the form does not edit but a PUT would otherwise reset. Carried over
 * from the saved element so editing one flag doesn't wipe its description or
 * constraints.
 */
function preservedFields(saved: DataModelElement): Partial<UpdateDataModelElement> {
  const out: Partial<UpdateDataModelElement> = {};
  if (saved.description !== undefined) out.description = saved.description;
  if (saved.defaultValue !== undefined) out.defaultValue = saved.defaultValue;
  if (saved.inputExample !== undefined) out.inputExample = saved.inputExample;
  if (saved.outputExample !== undefined) out.outputExample = saved.outputExample;
  if (saved.jsonSchema !== undefined) out.jsonSchema = saved.jsonSchema;
  return out;
}

/**
 * Diff the form rows against the saved elements. System elements are never
 * updated or deleted.
 */
export function planElementOperations(
  saved: DataModelElement[],
  rows: DataModelElementFormData[]
): DataModelElementOperation[] {
  const savedById = new Map<string, DataModelElement>();
  for (const el of saved) {
    if (el.dataModelElementId) savedById.set(el.dataModelElementId, el);
  }
  const keptIds = new Set<string>();
  const deletes: DataModelElementOperation[] = [];
  const updates: DataModelElementOperation[] = [];
  const creates: DataModelElementOperation[] = [];

  for (const row of rows) {
    const original = row.dataModelElementId ? savedById.get(row.dataModelElementId) : undefined;
    if (!original) {
      if (row.system) continue;
      creates.push({
        kind: "create",
        name: row.name,
        rowKey: row._rowKey,
        data: formDataToElement(row),
      });
      continue;
    }
    const elementId = original.dataModelElementId;
    keptIds.add(elementId);
    if (original.system) continue;
    // formDataToElement emits keys in a fixed order, so JSON equality is a
    // reliable "unchanged" check over the form-editable fields.
    const next = formDataToElement(row);
    const before = formDataToElement(elementToFormData(original));
    if (JSON.stringify(next) === JSON.stringify(before)) continue;
    updates.push({
      kind: "update",
      elementId,
      name: row.name,
      rowKey: row._rowKey,
      data: { ...preservedFields(original), ...next },
    });
  }

  for (const el of saved) {
    if (!el.dataModelElementId || el.system || keptIds.has(el.dataModelElementId)) continue;
    deletes.push({ kind: "delete", elementId: el.dataModelElementId, name: el.name });
  }

  return [...deletes, ...updates, ...creates];
}

/**
 * The saved element after an update, used as the next diff baseline when the
 * API response doesn't echo the element back.
 */
export function mergeSavedElement(
  original: DataModelElement,
  data: UpdateDataModelElement
): DataModelElement {
  return {
    ...original,
    name: data.name,
    inputAttribute: data.inputAttribute,
    outputAttribute: data.outputAttribute,
    typeReference: data.typeCode,
    array: data.array,
    required: data.required,
    sensitive: data.sensitive,
    inputOnly: data.inputOnly,
    outputOnly: data.outputOnly,
    createOnly: data.createOnly,
    metadataTypeCategory: data.metadataTypeCategory,
    metadataType: data.metadataType,
    metricRole: data.metricRole,
  };
}
