/**
 * DataModelTypeFormSheet - Sheet component for creating/editing DataModelTypes
 */

import type { CreateDataModelType } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { Switch } from "../../../primitives/switch.js";
import { Textarea } from "../../../primitives/textarea.js";
import type { DataModelTypeFormSheetProps } from "./types.js";

/**
 * Sheet component for creating and editing DataModelTypes.
 */
export function DataModelTypeFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: DataModelTypeFormSheetProps): ReactNode {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    () => (initialData?.description as Record<string, string> | undefined)?.en ?? ""
  );
  const [metadata, setMetadata] = useState(initialData?.metadata ?? false);
  const [parentTypeReference, setParentTypeReference] = useState(
    initialData?.parentTypeReference ?? ""
  );

  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  const resetForm = () => {
    setName(initialData?.name ?? "");
    setDescription((initialData?.description as Record<string, string> | undefined)?.en ?? "");
    setMetadata(initialData?.metadata ?? false);
    setParentTypeReference(initialData?.parentTypeReference ?? "");
    codeInput.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Responses carry the parent as `parentTypeReference`, but the platform binds
    // it on writes as `parentDataModelTypeCode` and silently ignores the generated
    // `parentTypeReference` request field (#1116).
    const formData: CreateDataModelType & { parentDataModelTypeCode?: string } = {
      name,
      code: codeInput.value,
      metadata,
      ...(description.trim() ? { description: { en: description } } : {}),
      ...(parentTypeReference.trim()
        ? { parentDataModelTypeCode: parentTypeReference.trim() }
        : {}),
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "create" ? "Create Data Model Type" : `Edit ${initialData?.name ?? "Data Model Type"}`;
  const submitLabel = mode === "create" ? "Create Data Model Type" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      submitDisabled={codeInput.error != null}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="dmt-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="dmt-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter data model type name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code */}
        <div className="space-y-2">
          <Label htmlFor="dmt-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="dmt-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="data-model-type-code"
                required
                disabled={isSubmitting || mode === "edit"}
                showReset={mode === "create"}
              />
            )}
          </WithFieldError>
          {mode === "create" && (
            <p className="text-muted-foreground text-xs">
              Auto-generated from name. Edit to customize.
            </p>
          )}
        </div>

        {/* Metadata toggle */}
        <div className="space-y-4">
          <h3 className="text-foreground text-sm font-medium">Settings</h3>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="dmt-metadata" className="text-sm font-medium">
                Metadata type
              </Label>
              <p className="text-muted-foreground text-xs">
                Whether this data model type represents metadata
              </p>
            </div>
            <Switch
              id="dmt-metadata"
              checked={metadata}
              onCheckedChange={setMetadata}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Parent Type Reference */}
        <div className="space-y-2">
          <Label htmlFor="dmt-parent-type">Parent Type Reference</Label>
          <WithFieldError field="parentDataModelTypeCode">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="dmt-parent-type"
                type="text"
                value={parentTypeReference}
                onChange={(e) => setParentTypeReference(e.target.value)}
                placeholder="Optional parent type code"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Reference to the parent data model type for inheritance.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="dmt-description">Description</Label>
          <WithFieldError field="description">
            {(fe) => (
              <Textarea
                {...fe.inputProps}
                id="dmt-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this data model type"
                disabled={isSubmitting}
                rows={3}
              />
            )}
          </WithFieldError>
        </div>
      </div>
    </FormSheet>
  );
}
