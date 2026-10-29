/**
 * TierFormSheet - Sheet component for creating/editing Tiers
 *
 * Wraps FormSheet with tier-specific form fields and logic.
 * Uses CodeInput for code auto-generation.
 * Uses LocalizedStringInput for multi-language description support.
 * Supports extended fields from data model extensions.
 */

import type { CreateTier } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { DurationPeriodBuilder } from "../../../forms/duration-period-builder.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { ProgramMultiField } from "../../../forms/program-field/index.js";
import { TierField } from "../../../forms/tier-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { Switch } from "../../../primitives/switch.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import {
  toStrictDurationPeriodValue,
  type DurationPeriodValue,
} from "../../format-duration-period.js";
import type { TierFormSheetProps } from "./types.js";

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
 * Sheet component for creating and editing Tiers.
 */
export function TierFormSheet({
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
}: TierFormSheetProps): ReactNode {
  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description) ?? {}
  );
  const [rank, setRank] = useState<number>(initialData?.rank ?? 1);
  const [subscription, setSubscription] = useState(initialData?.subscription ?? false);
  const [durationPeriod, setDurationPeriod] = useState<DurationPeriodValue | undefined>(
    initialData?.durationPeriod
  );
  const [programIds, setProgramIds] = useState<string[]>(
    () => (initialData as { programIds?: string[] } | undefined)?.programIds ?? []
  );
  const [downgradeTierId, setDowngradeTierId] = useState(
    initialData?.tierExpiryDowngradeTierId ?? ""
  );
  const [downgradeDurationPeriod, setDowngradeDurationPeriod] = useState<
    DurationPeriodValue | undefined
  >(initialData?.tierExpiryDowngradeDurationPeriod);

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
    setDescription(getLocalizedDescription(initialData?.description) ?? {});
    setRank(initialData?.rank ?? 1);
    setSubscription(initialData?.subscription ?? false);
    setDurationPeriod(initialData?.durationPeriod);
    setDowngradeTierId(initialData?.tierExpiryDowngradeTierId ?? "");
    setDowngradeDurationPeriod(initialData?.tierExpiryDowngradeDurationPeriod);
    setProgramIds((initialData as { programIds?: string[] } | undefined)?.programIds ?? []);
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

    // Only include description if it has content
    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: CreateTier & Record<string, unknown> = {
      name,
      code: codeInput.value,
      rank,
      subscription,
      programIds,
      durationPeriod: toStrictDurationPeriodValue(durationPeriod),
      tierExpiryDowngradeTierId: downgradeTierId || undefined,
      tierExpiryDowngradeDurationPeriod: toStrictDurationPeriodValue(downgradeDurationPeriod),
      ...(hasDescription && { description }),
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Tier" : `Edit ${initialData?.name ?? "Tier"}`;
  const submitLabel = mode === "create" ? "Create Tier" : "Save Changes";

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
          <Label htmlFor="tier-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="tier-name"
                data-widget="text-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter tier name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="tier-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="tier-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="tier-code"
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

        {/* Rank */}
        <div className="space-y-2">
          <Label htmlFor="tier-rank">
            Rank <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="rank">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="tier-rank"
                data-widget="text-input"
                type="number"
                min={1}
                value={rank}
                onChange={(e) => setRank(Math.max(1, parseInt(e.target.value, 10) || 1))}
                placeholder="1"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Lower numbers indicate higher rank (1 = top tier).
          </p>
        </div>

        {/* Subscription toggle */}
        <div className="space-y-4">
          <h3 className="text-foreground text-sm font-medium">Settings</h3>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="tier-subscription" className="text-sm font-medium">
                Subscription tier
              </Label>
              <p className="text-muted-foreground text-xs">
                Tier is unlocked via a recurring subscription
              </p>
            </div>
            <Switch
              id="tier-subscription"
              data-widget="switch"
              checked={subscription}
              onCheckedChange={setSubscription}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Programs multi-select */}
        <div className="space-y-2">
          <Label htmlFor="tier-program-ids">
            Programs <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="programIds" value={programIds}>
            {(fe) => (
              <ProgramMultiField
                {...fe.inputProps}
                id="tier-program-ids"
                value={programIds}
                onValueChange={setProgramIds}
                placeholder="Select programs..."
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Associate this tier with one or more programs.
          </p>
        </div>

        {/* Duration */}
        <DurationPeriodBuilder
          value={durationPeriod}
          onChange={setDurationPeriod}
          label="Set Duration Period"
          description="How long a member retains this tier status."
          disabled={isSubmitting}
        />

        {/* Tier Expiry Downgrade */}
        <div className="space-y-4">
          <h3 className="text-foreground text-sm font-medium">Tier Expiry Downgrade</h3>
          <div className="space-y-2">
            <Label htmlFor="tier-downgrade-tier-id">Downgrade Tier</Label>
            <WithFieldError field="tierExpiryDowngradeTierId" value={downgradeTierId}>
              {(fe) => (
                <TierField
                  {...fe.inputProps}
                  id="tier-downgrade-tier-id"
                  value={downgradeTierId}
                  onValueChange={setDowngradeTierId}
                  placeholder="Select downgrade tier..."
                  disabled={isSubmitting}
                  excludeIds={initialData?.tierId ? [initialData.tierId] : []}
                />
              )}
            </WithFieldError>
            <p className="text-muted-foreground text-xs">
              Which tier the member downgrades to when this tier expires.
            </p>
          </div>
          <DurationPeriodBuilder
            value={downgradeDurationPeriod}
            onChange={setDowngradeDurationPeriod}
            label="Downgrade Duration"
            description="Duration the member stays at the downgraded tier."
            disabled={isSubmitting}
          />
        </div>

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label htmlFor="tier-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="tier-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe the tier benefits and requirements"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the tier. Add translations as needed.
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
