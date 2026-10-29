/**
 * PartnerFormSheet - Sheet component for creating/editing Partners
 *
 * Wraps FormSheet with partner-specific form fields and logic.
 * Uses MetadataField for partner type selection with pre-wired data fetching.
 * Uses CodeInput for code auto-generation.
 * Uses LocalizedStringInput for multi-language description support.
 * Supports extended fields from data model extensions.
 * This pattern can be reused for other entity types.
 */

import { parseLocalizedDescription } from "@loom-loyalty/core";
import type { CreatePartner } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import type { PartnerFormSheetProps } from "./types.js";

/**
 * Sheet component for creating and editing Partners.
 *
 * @example
 * ```tsx
 * // Create mode
 * <PartnerFormSheet
 *   open={createOpen}
 *   onOpenChange={setCreateOpen}
 *   mode="create"
 *   onSubmit={handleCreate}
 *   isSubmitting={createMutation.isPending}
 * />
 *
 * // Edit mode
 * <PartnerFormSheet
 *   open={editOpen}
 *   onOpenChange={setEditOpen}
 *   mode="edit"
 *   initialData={selectedPartner}
 *   onSubmit={handleUpdate}
 *   isSubmitting={updateMutation.isPending}
 * />
 * ```
 */
export function PartnerFormSheet({
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
}: PartnerFormSheetProps): ReactNode {
  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [typeCode, setTypeCode] = useState(initialData?.type?.code ?? "");
  // Track if the selected type is a suggested option (needs creation on save)
  const [typeIsSuggested, setTypeIsSuggested] = useState(false);
  const [description, setDescription] = useState<LocalizedString>(
    () => parseLocalizedDescription(initialData?.description) ?? {}
  );

  // Metadata field hook for auto-creating suggested types on save
  const { createMetadata, findOption, isTypeNotFound } = useMetadataField("PARTNER_TYPE");

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
    setTypeCode(initialData?.type?.code ?? "");
    setTypeIsSuggested(false);
    setDescription(parseLocalizedDescription(initialData?.description) ?? {});
    codeInput.reset();
    // Reset extended fields
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  // Handle open change with form reset
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Handle submit - build CreatePartner from form state
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Auto-create suggested metadata type if it doesn't exist yet.
    // Skip when the metadata type itself is not found (404).
    if (typeIsSuggested && typeCode && !isTypeNotFound) {
      const option = findOption(typeCode);
      if (option) {
        await createMetadata({
          code: option.code,
          name: option.name,
          description: option.description ? { en: option.description } : undefined,
        });
      }
    }

    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: CreatePartner & Record<string, unknown> = {
      name,
      code: codeInput.value,
      typeCode: typeCode || "default",
      ...(hasDescription && { description }),
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Partner" : `Edit ${initialData?.name ?? "Partner"}`;
  const submitLabel = mode === "create" ? "Create Partner" : "Save Changes";

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
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="partner-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="partner-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter partner name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="partner-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="partner-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="partner-code"
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

        {/* Partner Type using MetadataField (pre-wired with SDK hooks) */}
        <div className="space-y-2">
          <Label htmlFor="partner-type-code">
            Partner Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="typeCode" value={typeCode}>
            {(fe) => (
              <MetadataField
                {...fe.inputProps}
                id="partner-type-code"
                typeCode="PARTNER_TYPE"
                typeLabel="Partner Type"
                value={typeCode}
                onValueChange={(value, isSuggested) => {
                  setTypeCode(value);
                  setTypeIsSuggested(isSuggested);
                }}
                placeholder="Select partner type..."
                disabled={isSubmitting}
                aria-describedby={
                  fe.error ? `${fe.errorId} partner-type-code-hint` : "partner-type-code-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="partner-type-code-hint" className="text-muted-foreground text-xs">
            Classification of the partner relationship.
            {typeIsSuggested && (
              <span className="text-primary ml-1">(Will be created when you save)</span>
            )}
          </p>
        </div>

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label htmlFor="partner-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="partner-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe the partner organization and relationship"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the partner. Add translations as needed.
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
