/**
 * DataModelFormSheet
 *
 * Full-featured sheet for creating/editing a DataModel (schema).
 *
 * Composes:
 * - EntitySelectBox → pick an existing DataModelType (or "Create New Type..." → layered sheet)
 * - Element summary table → click row to edit, or "+ Add Element" / "Bulk Import"
 * - ElementDialog → sub-dialog for adding/editing one element
 * - BulkElementImportDialog → paste tab-separated rows
 * - Live JSON Schema preview (collapsible)
 * - Layered DataModelTypeFormSheet → inline create a new type and auto-select it
 *
 * On submit:
 *   create → { typeCode, elements: CreateDataModelElement[] } → onSubmit
 *   edit (with elementOperations) → per-element delete/update/create, then
 *     elementOperations.onSaved. System elements are read-only and never sent.
 */

import type {
  CreateDataModel,
  CreateDataModelType,
  DataModelElement,
  UpdateDataModel,
} from "@loom-loyalty/sdk";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EntitySelectBox, type EntityOption } from "../../../forms/entity-select-box.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import { Button } from "../../../primitives/button.js";
import { Label } from "../../../primitives/label.js";
import { BulkElementImportDialog } from "./bulk-element-import.js";
import { DataModelTypeFormSheet } from "./data-model-type-form-sheet.js";
import { mergeSavedElement, planElementOperations } from "./element-changes.js";
import { ElementDialog } from "./element-dialog.js";
import { ElementsEditor } from "./elements-editor.js";
import {
  copyToClipboard,
  findDuplicateAttributes,
  formatJson,
  generateClientSchema,
} from "./schema-utils.js";
import {
  elementToFormData,
  formDataToElement,
  newElementRowKey,
  type DataModelElementFormData,
  type DataModelFormSheetProps,
} from "./types.js";

export function DataModelFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  availableTypes = [],
  typesLoading = false,
  onCreateType,
  onSubmit,
  elementOperations,
  isSubmitting: isSubmittingProp = false,
  error: errorProp,
  fieldErrors,
}: DataModelFormSheetProps): ReactNode {
  // ----- State -----
  const [typeCode, setTypeCode] = useState(initialData?.type?.code ?? "");
  const [elements, setElements] = useState<DataModelElementFormData[]>(
    () => initialData?.elements?.map(elementToFormData) ?? []
  );
  // Edit mode: the elements as last persisted. Per-element saves diff against
  // this, and it advances as each save succeeds, so retrying after a partial
  // failure never re-sends an element that was already saved.
  const [savedElements, setSavedElements] = useState<DataModelElement[]>(
    () => initialData?.elements ?? []
  );
  const [savingElements, setSavingElements] = useState(false);
  const [elementSaveError, setElementSaveError] = useState<string | null>(null);
  const isSubmitting = isSubmittingProp || savingElements;
  const error = elementSaveError ?? errorProp;

  // Element dialog state
  const [elementDialogOpen, setElementDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Bulk import state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Layered type-create sheet state
  const [typeCreateOpen, setTypeCreateOpen] = useState(false);
  const [typeCreateSubmitting, setTypeCreateSubmitting] = useState(false);
  const [typeCreateError, setTypeCreateError] = useState<string | null>(null);

  // Schema preview
  const [schemaExpanded, setSchemaExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // ----- Derived -----
  const selectedType = useMemo(
    () => availableTypes.find((t) => t.code === typeCode),
    [availableTypes, typeCode]
  );

  // EntitySelectBox uses id for selection; we key by code (since that's the FK on DataModel).
  const typeOptions: EntityOption[] = useMemo(
    () =>
      availableTypes
        .filter((t) => t.code)
        .map((t) => ({
          id: t.code ?? "",
          name: t.name ?? t.code ?? "",
          secondaryText: t.code,
        })),
    [availableTypes]
  );

  const clientSchema = useMemo(
    () => generateClientSchema(elements, { title: selectedType?.name ?? typeCode }),
    [elements, selectedType?.name, typeCode]
  );
  const schemaJson = useMemo(() => formatJson(clientSchema), [clientSchema]);

  // Duplicate attribute detection: generateClientSchema silently overwrites colliding
  // property keys, and the server would reject the payload (or worse, accept a half-
  // defined schema). Surface as a validation error before submit.
  const duplicateAttrs = useMemo(() => findDuplicateAttributes(elements), [elements]);

  // ----- Handlers -----
  const resetForm = () => {
    setTypeCode(initialData?.type?.code ?? "");
    setElements(initialData?.elements?.map(elementToFormData) ?? []);
    setSavedElements(initialData?.elements ?? []);
    setElementSaveError(null);
    setEditingIndex(null);
    setElementDialogOpen(false);
    setBulkImportOpen(false);
    setTypeCreateOpen(false);
    setSchemaExpanded(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!typeCode.trim()) return;
    if (duplicateAttrs.length > 0) return;
    if (mode === "edit" && elementOperations) {
      await saveElementChanges();
      return;
    }
    if (!onSubmit) return;
    const payload: CreateDataModel | UpdateDataModel = {
      typeCode,
      elements: elements.map(formDataToElement),
    };
    await onSubmit(payload);
  };

  const saveElementChanges = async () => {
    if (!elementOperations) return;
    const operations = planElementOperations(savedElements, elements);
    let baseline = savedElements;
    const saved: string[] = [];
    setSavingElements(true);
    setElementSaveError(null);
    try {
      for (const op of operations) {
        try {
          if (op.kind === "delete") {
            await elementOperations.deleteElement(op.elementId);
            baseline = baseline.filter((el) => el.dataModelElementId !== op.elementId);
          } else if (op.kind === "update") {
            const result = await elementOperations.updateElement(op.elementId, op.data);
            baseline = baseline.map((el) =>
              el.dataModelElementId === op.elementId
                ? (result ?? mergeSavedElement(el, op.data))
                : el
            );
          } else {
            const created = await elementOperations.createElement(op.data);
            const createdId = created?.dataModelElementId;
            if (created && createdId) {
              baseline = [...baseline, created];
              setElements((prev) =>
                prev.map((row) =>
                  row._rowKey === op.rowKey ? { ...row, dataModelElementId: createdId } : row
                )
              );
            }
          }
          saved.push(op.name);
        } catch (err) {
          const verb = op.kind === "delete" ? "remove" : op.kind === "update" ? "update" : "add";
          // SDK errors are plain `{ message, statusCode }` objects, not Errors.
          const reason =
            typeof err === "object" && err !== null && "message" in err
              ? String((err as { message: unknown }).message)
              : "Unknown error";
          const savedNote =
            saved.length > 0 ? ` Already saved: ${saved.map((n) => `"${n}"`).join(", ")}.` : "";
          setSavedElements(baseline);
          setElementSaveError(`Couldn't ${verb} element "${op.name}": ${reason}.${savedNote}`);
          return;
        }
      }
      setSavedElements(baseline);
      await elementOperations.onSaved();
    } finally {
      setSavingElements(false);
    }
  };

  const handleAddElement = () => {
    setEditingIndex(null);
    setElementDialogOpen(true);
  };

  const handleEditElement = (index: number) => {
    setEditingIndex(index);
    setElementDialogOpen(true);
  };

  const handleDeleteElement = (index: number) => {
    setElements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleElementSubmit = (data: DataModelElementFormData) => {
    setElements((prev) => {
      if (editingIndex === null) {
        // New element: assign a fresh _rowKey so list renders get stable keys.
        return [...prev, { ...data, _rowKey: data._rowKey ?? newElementRowKey() }];
      }
      // Edit: preserve the original _rowKey (dialog round-trips it).
      const next = [...prev];
      const existing = prev[editingIndex];
      next[editingIndex] = { ...data, _rowKey: data._rowKey ?? existing?._rowKey };
      return next;
    });
    setElementDialogOpen(false);
    setEditingIndex(null);
  };

  const handleBulkImport = (newElements: DataModelElementFormData[]) => {
    const withKeys = newElements.map((el) => ({
      ...el,
      _rowKey: el._rowKey ?? newElementRowKey(),
    }));
    setElements((prev) => [...prev, ...withKeys]);
    setBulkImportOpen(false);
  };

  const handleTypeCreateSubmit = async (data: CreateDataModelType) => {
    if (!onCreateType) return;
    setTypeCreateSubmitting(true);
    setTypeCreateError(null);
    try {
      const created = await onCreateType(data);
      if (created.code) setTypeCode(created.code);
      setTypeCreateOpen(false);
    } catch (err) {
      setTypeCreateError(err instanceof Error ? err.message : "Failed to create data model type.");
    } finally {
      setTypeCreateSubmitting(false);
    }
  };

  const handleCopySchema = async () => {
    const ok = await copyToClipboard(schemaJson);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // ----- Render helpers -----
  const title =
    mode === "create" ? "Create Data Model" : `Edit ${initialData?.type?.name ?? "Data Model"}`;
  const submitLabel = mode === "create" ? "Create Data Model" : "Save Changes";
  const canSubmit = typeCode.trim().length > 0 && duplicateAttrs.length === 0;

  const editingElement = editingIndex !== null ? elements[editingIndex] : undefined;

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description="Define the schema by choosing a type and adding elements."
        onSubmit={handleSubmit}
        onCancel={() => handleOpenChange(false)}
        isSubmitting={isSubmitting}
        submitDisabled={!canSubmit}
        submitLabel={submitLabel}
        error={error}
        fieldErrors={fieldErrors}
        className="sm:max-w-2xl"
      >
        <div className="space-y-6">
          {/* Type Selector */}
          <section className="space-y-2">
            <Label htmlFor="dm-type">
              Type <span className="text-destructive">*</span>
            </Label>
            <WithFieldError field="typeCode" value={typeCode}>
              {(fe) => (
                <EntitySelectBox
                  {...fe.inputProps}
                  id="dm-type"
                  entityLabel="Data Model Type"
                  options={typeOptions}
                  value={typeCode}
                  onValueChange={setTypeCode}
                  onCreateNew={onCreateType ? () => setTypeCreateOpen(true) : undefined}
                  isLoading={typesLoading}
                  placeholder="Select a data model type..."
                  disabled={isSubmitting || mode === "edit"}
                />
              )}
            </WithFieldError>
            <p className="text-muted-foreground text-xs">
              {mode === "edit"
                ? "Type cannot be changed after creation."
                : "Pick an existing type, or create a new one inline."}
            </p>
          </section>

          {/* Elements */}
          <ElementsEditor
            elements={elements}
            onAddElement={handleAddElement}
            onEditElement={handleEditElement}
            onDeleteElement={handleDeleteElement}
            onBulkImport={() => setBulkImportOpen(true)}
            disabled={isSubmitting}
          />

          {/* Schema Preview (collapsible) */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setSchemaExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors"
              aria-expanded={schemaExpanded}
              aria-controls="schema-preview"
            >
              {schemaExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              JSON Schema Preview
            </button>

            {schemaExpanded && (
              <div id="schema-preview" className="space-y-2">
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopySchema}
                    className="gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <pre className="border-border bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs">
                  <code>{schemaJson}</code>
                </pre>
                <p className="text-muted-foreground text-xs">
                  Client-side approximation. The server schema (returned after save) is
                  authoritative.
                </p>
              </div>
            )}
          </section>

          {duplicateAttrs.length > 0 && (
            <div
              className="border-destructive/30 bg-destructive/5 rounded-md border p-3"
              role="alert"
            >
              <p className="text-destructive text-sm font-medium">
                {duplicateAttrs.length === 1 ? "Duplicate attribute" : "Duplicate attributes"}:{" "}
                <span className="font-mono">{duplicateAttrs.join(", ")}</span>
              </p>
              <p className="text-destructive/80 mt-1 text-xs">
                Two or more elements share the same attribute name. Rename them so each element has
                a unique attribute before saving.
              </p>
            </div>
          )}

          {!canSubmit && duplicateAttrs.length === 0 && (
            <p className="text-muted-foreground text-xs" role="status">
              Select a type to enable submit.
            </p>
          )}
        </div>
      </FormSheet>

      {/* Sub-dialogs (rendered outside FormSheet so they're not gated by sheet close) */}
      <ElementDialog
        open={elementDialogOpen}
        onOpenChange={setElementDialogOpen}
        mode={editingIndex === null ? "create" : "edit"}
        initialData={editingElement}
        availableTypes={availableTypes}
        onSubmit={handleElementSubmit}
      />

      <BulkElementImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImport={handleBulkImport}
      />

      {onCreateType && (
        <DataModelTypeFormSheet
          open={typeCreateOpen}
          onOpenChange={(o) => {
            setTypeCreateOpen(o);
            if (!o) setTypeCreateError(null);
          }}
          mode="create"
          onSubmit={async (data) => {
            await handleTypeCreateSubmit(data as CreateDataModelType);
          }}
          isSubmitting={typeCreateSubmitting}
          error={typeCreateError}
        />
      )}
    </>
  );
}
