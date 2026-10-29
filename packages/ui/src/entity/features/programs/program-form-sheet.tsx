/**
 * ProgramFormSheet - Sheet component for creating/editing Programs
 *
 * Wraps FormSheet with program-specific form fields and logic.
 * Uses MetadataField for program type selection with pre-wired data fetching.
 * Uses CodeInput for code auto-generation.
 * Uses LocalizedStringInput for multi-language description support.
 * Uses CodeGenInformationInput for program account ID generation configuration.
 * Supports extended fields from data model extensions.
 * This pattern can be reused for other entity types.
 */

import { parseLocalizedDescription } from "@loom-loyalty/core";
import type { CodeGenInformation, CreatePartner, CreateProgram } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeGenInformationInput } from "../../../forms/code-gen-information-input.js";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { PartnerField, usePartnerField } from "../../../forms/partner-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { Switch } from "../../../primitives/switch.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { PartnerFormSheet } from "../partners/partner-form-sheet.js";
import type { ProgramFormSheetProps } from "./types.js";

/**
 * Sheet component for creating and editing Programs.
 *
 * @example
 * ```tsx
 * // Create mode
 * <ProgramFormSheet
 *   open={createOpen}
 *   onOpenChange={setCreateOpen}
 *   mode="create"
 *   onSubmit={handleCreate}
 *   isSubmitting={createMutation.isPending}
 * />
 *
 * // Edit mode
 * <ProgramFormSheet
 *   open={editOpen}
 *   onOpenChange={setEditOpen}
 *   mode="edit"
 *   initialData={selectedProgram}
 *   onSubmit={handleUpdate}
 *   isSubmitting={updateMutation.isPending}
 * />
 * ```
 */
export function ProgramFormSheet({
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
}: ProgramFormSheetProps): ReactNode {
  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [typeCode, setTypeCode] = useState(initialData?.type?.code ?? "");
  // Track if the selected type is a suggested option (needs creation on save)
  const [typeIsSuggested, setTypeIsSuggested] = useState(false);
  const [description, setDescription] = useState<LocalizedString>(
    () => parseLocalizedDescription(initialData?.description) ?? {}
  );
  const [partnerId, setPartnerId] = useState(initialData?.partner?.partnerId ?? "");
  const [createAccountOnCustomerCreation, setCreateAccountOnCustomerCreation] = useState(
    initialData?.createAccountOnCustomerCreation ?? false
  );
  const [programAccountIdInformation, setProgramAccountIdInformation] = useState<
    CodeGenInformation | undefined
  >(initialData?.programAccountIdInformation);

  // Metadata field hook for auto-creating suggested types on save
  const { createMetadata, findOption, isTypeNotFound } = useMetadataField("PROGRAM_TYPE");

  // Partner creation support - reuse the Hub's PartnerFormSheet
  const { createPartner } = usePartnerField();

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
    setPartnerId(initialData?.partner?.partnerId ?? "");
    setCreateAccountOnCustomerCreation(initialData?.createAccountOnCustomerCreation ?? false);
    setProgramAccountIdInformation(initialData?.programAccountIdInformation);
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

  // Handle submit - build CreateProgram from form state
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Auto-create suggested metadata type if it doesn't exist yet.
    // Skip when the metadata type itself is not found (404) — we can't create without a category.
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

    // Only include description if it has content
    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: CreateProgram & Record<string, unknown> = {
      name,
      code: codeInput.value,
      typeCode: typeCode || "default",
      description: hasDescription ? description : undefined,
      partnerId: partnerId || undefined,
      createAccountOnCustomerCreation,
      programAccountIdInformation,
      // Include extended field values
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Program" : `Edit ${initialData?.name ?? "Program"}`;
  const submitLabel = mode === "create" ? "Create Program" : "Save Changes";

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
          <Label htmlFor="program-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="program-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter program name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="program-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="program-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="program-code"
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

        {/* Program Type using MetadataField (pre-wired with SDK hooks) */}
        <div className="space-y-2">
          <Label htmlFor="program-type-code">
            Program Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="typeCode" value={typeCode}>
            {(fe) => (
              <MetadataField
                {...fe.inputProps}
                id="program-type-code"
                typeCode="PROGRAM_TYPE"
                typeLabel="Program Type"
                value={typeCode}
                onValueChange={(value, isSuggested) => {
                  setTypeCode(value);
                  setTypeIsSuggested(isSuggested);
                }}
                placeholder="Select program type..."
                disabled={isSubmitting}
                aria-describedby={
                  fe.error ? `${fe.errorId} program-type-code-hint` : "program-type-code-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="program-type-code-hint" className="text-muted-foreground text-xs">
            Classification of the program structure and rules.
            {typeIsSuggested && (
              <span className="text-primary ml-1">(Will be created when you save)</span>
            )}
          </p>
        </div>

        {/* Partner selection */}
        <div className="space-y-2">
          <Label htmlFor="program-partner-id">Partner</Label>
          <WithFieldError field="partnerId" value={partnerId}>
            {(fe) => (
              <PartnerField
                {...fe.inputProps}
                id="program-partner-id"
                value={partnerId}
                onValueChange={setPartnerId}
                placeholder="Select a partner..."
                disabled={isSubmitting}
                renderCreateSheet={(createOpen, setCreateOpen) => (
                  <PartnerFormSheet
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    mode="create"
                    onSubmit={async (data) => {
                      const partner = await createPartner(data as CreatePartner);
                      if (partner.partnerId) {
                        setPartnerId(partner.partnerId);
                      }
                      setCreateOpen(false);
                    }}
                  />
                )}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Primary partner associated with this program.
          </p>
        </div>

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label htmlFor="program-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="program-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe the program benefits and features"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the program. Add translations as needed.
          </p>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h4 className="text-foreground text-sm font-medium">Settings</h4>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="program-auto-create-accounts" className="text-sm font-medium">
                Auto-create accounts
              </Label>
              <p className="text-muted-foreground text-xs">
                Automatically create a program account when a customer is created
              </p>
            </div>
            <Switch
              id="program-auto-create-accounts"
              checked={createAccountOnCustomerCreation}
              onCheckedChange={setCreateAccountOnCustomerCreation}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Program Account ID Generation Configuration */}
        <CodeGenInformationInput
          value={programAccountIdInformation}
          onChange={setProgramAccountIdInformation}
          disabled={isSubmitting}
          showCard
          title="Account ID Generation"
          description="Configure how program account IDs are generated for customers"
        />

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
