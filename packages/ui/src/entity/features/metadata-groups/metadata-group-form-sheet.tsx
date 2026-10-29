/**
 * MetadataGroupFormSheet - Sheet component for creating/editing Metadata Groups
 *
 * Wraps FormSheet with metadata-group-specific form fields and logic.
 * Uses MetadataTypeField for type selection with pre-wired data fetching.
 * Uses CodeInput for code auto-generation.
 * Uses LocalizedStringInput for multi-language description support.
 * Supports extended fields from data model extensions.
 */

import { parseLocalizedDescription } from "@loom-loyalty/core";
import type { CreateMetadataGroup } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataTypeField } from "../../../forms/metadata-type-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import type { MetadataGroupFormSheetProps } from "./types.js";

/**
 * Sheet component for creating and editing Metadata Groups.
 */
export function MetadataGroupFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  schema,
  extendedFields = [],
  lockedTypeCode,
  summary,
}: MetadataGroupFormSheetProps): ReactNode {
  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [selectedTypeCode, setSelectedTypeCode] = useState("");
  const [description, setDescription] = useState<LocalizedString>(
    () => parseLocalizedDescription(initialData?.description) ?? {}
  );

  // Extended fields state
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );

  // Code auto-generation using useCodeInput hook
  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  // A group's type is immutable once it exists. Keep only the create-mode choice
  // in state so a changed lock from the caller is reflected without remounting.
  const typeCode =
    mode === "edit" ? (initialData?.typeCode ?? "") : (lockedTypeCode ?? selectedTypeCode);
  const isTypeLocked = mode === "edit" || Boolean(lockedTypeCode);

  // Handle extended field changes
  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Reset form when sheet opens/closes or initialData changes
  const resetForm = () => {
    setName(initialData?.name ?? "");
    setSelectedTypeCode("");
    setDescription(parseLocalizedDescription(initialData?.description) ?? {});
    codeInput.reset();
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  // Handle open change with form reset
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isSubmitting) return;
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Handle submit
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: CreateMetadataGroup & Record<string, unknown> = {
      name,
      code: codeInput.value,
      typeCode,
      description: hasDescription ? description : undefined,
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "create" ? "Create Metadata Group" : `Edit ${initialData?.name ?? "Metadata Group"}`;
  const submitLabel = summary
    ? "Save group"
    : mode === "create"
      ? "Create Metadata Group"
      : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      submitDisabled={codeInput.error != null || (mode === "create" && !typeCode)}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      hideCloseButton={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
      description={summary}
    >
      <div className="space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="metadata-group-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="metadata-group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter metadata group name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="metadata-group-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="metadata-group-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="metadata-group-code"
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

        {/* Type Code using MetadataTypeField */}
        <div className="space-y-2">
          <Label htmlFor="metadata-group-type-code">
            Metadata Type {!isTypeLocked && <span className="text-destructive">*</span>}
          </Label>
          {isTypeLocked ? (
            <WithFieldError field="typeCode">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="metadata-group-type-code"
                  value={typeCode}
                  readOnly
                  aria-describedby={
                    fe.error
                      ? `${fe.errorId} metadata-group-type-code-hint`
                      : "metadata-group-type-code-hint"
                  }
                />
              )}
            </WithFieldError>
          ) : (
            <WithFieldError field="typeCode" value={typeCode}>
              {(fe) => (
                <MetadataTypeField
                  {...fe.inputProps}
                  id="metadata-group-type-code"
                  value={typeCode}
                  onValueChange={setSelectedTypeCode}
                  placeholder="Select metadata type..."
                  disabled={isSubmitting}
                  aria-describedby={
                    fe.error
                      ? `${fe.errorId} metadata-group-type-code-hint`
                      : "metadata-group-type-code-hint"
                  }
                  aria-required
                />
              )}
            </WithFieldError>
          )}
          <p id="metadata-group-type-code-hint" className="text-muted-foreground text-xs">
            {mode === "edit"
              ? "A group's type can't be changed after it's created."
              : isTypeLocked
                ? "This group's metadata type is fixed."
                : "Only metadata of this type can be added to the group."}
          </p>
        </div>

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label>Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                value={description}
                onChange={setDescription}
                placeholder="Describe the purpose of this metadata group"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description. Add translations as needed.
          </p>
        </div>

        {/* Extended Fields Section (from data model extensions) */}
        {schema && extendedFields.length > 0 && (
          <ExtendedFieldsSection
            schema={schema}
            fields={extendedFields}
            data={extendedFieldValues}
            mode="edit"
            onChange={handleExtendedFieldChange}
            title="Additional Information"
            defaultCollapsed={false}
          />
        )}
      </div>
    </FormSheet>
  );
}
