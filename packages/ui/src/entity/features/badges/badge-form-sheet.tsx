/**
 * BadgeFormSheet - Sheet component for creating/editing Badges
 *
 * Wraps FormSheet with badge-specific form fields and logic.
 * Uses MetadataField for badge type selection with pre-wired data fetching.
 * Uses CodeInput for code auto-generation.
 * Uses LocalizedStringInput for multi-language description support.
 * Supports extended fields from data model extensions.
 */

import type { CreateBadge, DataType } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { DurationPeriodBuilder } from "../../../forms/duration-period-builder.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { ProgramMultiField } from "../../../forms/program-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import {
  toStrictDurationPeriodValue,
  type DurationPeriodValue,
} from "../../format-duration-period.js";
import type { BadgeFormSheetProps } from "./types.js";

/**
 * Extract type code string from badge data.
 * API returns type object under `type`, but SDK types call it `typeCode`.
 */
function extractTypeCode(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  // Check SDK field name (`typeCode`) first, then actual API field name (`type`)
  const record = data as Record<string, unknown>;
  const tc = record.typeCode ?? record.type;
  if (!tc) return "";
  if (typeof tc === "string") return tc;
  if (typeof tc === "object" && tc !== null && "code" in tc) return (tc as DataType).code ?? "";
  return "";
}

/**
 * Helper to extract localized string from i18n object
 */
function getLocalizedDescription(
  description?: Record<string, unknown>
): LocalizedString | undefined {
  if (!description) return undefined;

  const result: LocalizedString = {};
  for (const [key, value] of Object.entries(description)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Sheet component for creating and editing Badges.
 */
export function BadgeFormSheet({
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
}: BadgeFormSheetProps): ReactNode {
  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [typeCode, setTypeCode] = useState(() => extractTypeCode(initialData));
  const [typeIsSuggested, setTypeIsSuggested] = useState(false);
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description) ?? {}
  );
  const [programIds, setProgramIds] = useState<string[]>(() => initialData?.programIds ?? []);
  const [rank, setRank] = useState<string>(
    initialData?.rank != null ? String(initialData.rank) : ""
  );
  const [durationPeriod, setDurationPeriod] = useState<DurationPeriodValue | undefined>(
    initialData?.durationPeriod
  );

  // Local error state for errors from metadata creation or submit
  const [localError, setLocalError] = useState<string | null>(null);

  // Metadata field hook for auto-creating suggested types on save
  const { createMetadata, findOption, isTypeNotFound } = useMetadataField("BADGE_TYPE");

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
    setTypeCode(extractTypeCode(initialData));
    setTypeIsSuggested(false);
    setDescription(getLocalizedDescription(initialData?.description) ?? {});
    setProgramIds(initialData?.programIds ?? []);
    setRank(initialData?.rank != null ? String(initialData.rank) : "");
    setDurationPeriod(initialData?.durationPeriod);
    setLocalError(null);
    codeInput.reset();
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  // Handle open change with form reset
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Handle submit
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (programIds.length === 0) {
      setLocalError("At least one program must be selected.");
      return;
    }

    try {
      // Auto-create suggested metadata type if it doesn't exist yet.
      // Skip when the metadata type itself is not found (404).
      if (typeIsSuggested && typeCode && !isTypeNotFound) {
        const option = findOption(typeCode);
        if (option) {
          await createMetadata({
            code: option.code,
            name: option.name,
            description: option.description ? { en: option.description } : undefined,
            dataModelCode: "dataModelCode" in option ? option.dataModelCode : undefined,
          });
        }
      }

      // Only include description if it has content
      const hasDescription = Object.values(description).some((v) => v.trim() !== "");

      const formData: CreateBadge & Record<string, unknown> = {
        name,
        code: codeInput.value,
        typeCode: typeCode || "default",
        description: hasDescription ? description : undefined,
        programIds,
        rank: rank ? parseInt(rank, 10) : undefined,
        durationPeriod: toStrictDurationPeriodValue(durationPeriod),
        ...extendedFieldValues,
      };

      await onSubmit(formData);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to save badge");
    }
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Badge" : `Edit ${initialData?.name ?? "Badge"}`;
  const submitLabel = mode === "create" ? "Create Badge" : "Save Changes";

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
      error={localError ?? error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="badge-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="badge-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter badge name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="badge-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="badge-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="badge-code"
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

        {/* Badge Type using MetadataField */}
        <div className="space-y-2">
          <Label htmlFor="badge-type-code">
            Badge Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="typeCode" value={typeCode}>
            {(fe) => (
              <MetadataField
                {...fe.inputProps}
                id="badge-type-code"
                typeCode="BADGE_TYPE"
                typeLabel="Badge Type"
                value={typeCode}
                onValueChange={(value, isSuggested) => {
                  setTypeCode(value);
                  setTypeIsSuggested(isSuggested);
                }}
                placeholder="Select badge type..."
                disabled={isSubmitting}
                aria-describedby={
                  fe.error ? `${fe.errorId} badge-type-code-hint` : "badge-type-code-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="badge-type-code-hint" className="text-muted-foreground text-xs">
            Classification of the badge.
            {typeIsSuggested && (
              <span className="text-primary ml-1">(Will be created when you save)</span>
            )}
          </p>
        </div>

        {/* Programs multi-select */}
        <div className="space-y-2">
          <Label htmlFor="badge-program-ids">
            Programs <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="programIds" value={programIds}>
            {(fe) => (
              <ProgramMultiField
                {...fe.inputProps}
                id="badge-program-ids"
                value={programIds}
                onValueChange={setProgramIds}
                placeholder="Select programs..."
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">Programs that this badge belongs to.</p>
        </div>

        {/* Rank (optional) */}
        <div className="space-y-2">
          <Label htmlFor="badge-rank">Rank</Label>
          <WithFieldError field="rank">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="badge-rank"
                type="number"
                min={1}
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                placeholder="Optional ranking"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Optional ranking for ordering badges. Lower numbers appear first.
          </p>
        </div>

        {/* Duration */}
        <DurationPeriodBuilder
          value={durationPeriod}
          onChange={setDurationPeriod}
          label="Set Duration Period"
          description="How long this badge remains valid. Leave unchecked for permanent badges."
          disabled={isSubmitting}
        />

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label htmlFor="badge-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="badge-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe the badge and how it is earned"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the badge. Add translations as needed.
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
