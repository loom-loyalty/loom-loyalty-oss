/**
 * PendingRuleFormSheet - Sheet component for creating/editing Pending Rules
 *
 * Wraps FormSheet with pending-rule-specific form fields and logic.
 * Uses CodeInput for code auto-generation (upper-snake-case).
 * Uses ProgramMultiField for program association.
 * Uses LocalizedStringInput for multi-language description support.
 * Uses DatePicker for fixed date pending.
 * Supports conditional fields based on PendingRuleType:
 * - FIXED_PERIOD / ROLLING_PERIOD → Period select + Period value input
 * - FIXED_DATE → Date input
 * - MANUAL / PENDING_ON_ITEM → No additional fields
 * Supports extended fields from data model extensions.
 */

import type { CreatePendingRule } from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { DatePicker } from "../../../forms/date-picker.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { ProgramMultiField } from "../../../forms/program-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import {
  PENDING_PERIOD_OPTIONS,
  PENDING_RULE_TYPE_DESCRIPTIONS,
  PENDING_TYPE_OPTIONS,
  PendingRuleType,
  type PendingRuleFormSheetProps,
} from "./types.js";

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
 * Sheet component for creating and editing Pending Rules.
 *
 * Conditional field behavior:
 * - FIXED_DATE: shows DatePicker for pendingDate
 * - FIXED_PERIOD / ROLLING_PERIOD: shows pendingPeriod + pendingPeriodValue
 * - MANUAL / PENDING_ON_ITEM: no additional fields
 */
export function PendingRuleFormSheet({
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
}: PendingRuleFormSheetProps): ReactNode {
  // Local validation error (separate from parent error prop)
  const [formError, setFormError] = useState<string | null>(null);

  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState<string>(initialData?.type ?? "");
  const [pendingPeriod, setPendingPeriod] = useState<string>(initialData?.pendingPeriod ?? "");
  const [pendingPeriodValue, setPendingPeriodValue] = useState<number | undefined>(
    initialData?.pendingPeriodValue ?? undefined
  );
  const [pendingDate, setPendingDate] = useState<string | undefined>(
    initialData?.pendingDate ?? undefined
  );
  const [programIds, setProgramIds] = useState<string[]>(initialData?.programIds ?? []);
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description) ?? {}
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

  // Handle extended field changes
  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle type change - clear conditional fields when type changes
  const handleTypeChange = (newType: string) => {
    setType(newType);
    // Reset conditional fields
    if (newType === "FIXED_DATE") {
      setPendingPeriod("");
      setPendingPeriodValue(undefined);
    } else {
      setPendingDate(undefined);
    }
  };

  // Reset form when sheet opens/closes or initialData changes
  const resetForm = () => {
    setFormError(null);
    setName(initialData?.name ?? "");
    setType(initialData?.type ?? "");
    setPendingPeriod(initialData?.pendingPeriod ?? "");
    setPendingPeriodValue(initialData?.pendingPeriodValue ?? undefined);
    setPendingDate(initialData?.pendingDate ?? undefined);
    setProgramIds(initialData?.programIds ?? []);
    setDescription(getLocalizedDescription(initialData?.description) ?? {});
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
    setFormError(null);

    if (programIds.length === 0) {
      setFormError("At least one program must be selected.");
      return;
    }

    const showPeriodFields =
      type === PendingRuleType.FIXED_PERIOD || type === PendingRuleType.ROLLING_PERIOD;
    const showDateField = type === PendingRuleType.FIXED_DATE;

    if (showPeriodFields && !pendingPeriod) {
      setFormError("Pending period is required for this type.");
      return;
    }

    if (showDateField && !pendingDate) {
      setFormError("Pending date is required for this type.");
      return;
    }

    // Only include description if it has content
    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: CreatePendingRule & Record<string, unknown> = {
      name,
      code: codeInput.value,
      type: type as CreatePendingRule["type"],
      programIds,
      description: hasDescription ? description : undefined,
      ...(showPeriodFields && pendingPeriod
        ? {
            pendingPeriod: pendingPeriod as CreatePendingRule["pendingPeriod"],
            pendingPeriodValue: pendingPeriodValue,
          }
        : {}),
      ...(showDateField && pendingDate ? { pendingDate } : {}),
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "create" ? "Create Pending Rule" : `Edit ${initialData?.name ?? "Pending Rule"}`;
  const submitLabel = mode === "create" ? "Create Pending Rule" : "Save Changes";

  const showPeriodFields = type === "FIXED_PERIOD" || type === "ROLLING_PERIOD";
  const showDateField = type === "FIXED_DATE";

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
      error={formError ?? error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="pending-rule-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="pending-rule-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter pending rule name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="pending-rule-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="pending-rule-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="pending-rule-code"
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

        {/* Programs multi-select */}
        <div className="space-y-2">
          <Label>
            Programs <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="programIds" value={programIds}>
            {(fe) => (
              <ProgramMultiField
                {...fe.inputProps}
                value={programIds}
                onValueChange={setProgramIds}
                placeholder="Select programs..."
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Associate this rule with one or more programs.
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
                placeholder="Describe what this pending rule does"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Pending Rule Type */}
        <div className="space-y-2">
          <Label htmlFor="pending-rule-type">
            Pending Rule Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="type" value={type}>
            {(fe) => (
              <Select value={type} onValueChange={handleTypeChange} disabled={isSubmitting}>
                <SelectTrigger {...fe.inputProps} id="pending-rule-type">
                  <SelectValue placeholder="Select pending rule type..." />
                </SelectTrigger>
                <SelectContent>
                  {PENDING_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
          {type && (
            <p className="text-muted-foreground text-xs">{PENDING_RULE_TYPE_DESCRIPTIONS[type]}</p>
          )}
        </div>

        {/* Conditional: Period fields for FIXED_PERIOD / ROLLING_PERIOD */}
        {showPeriodFields && (
          <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
            <h4 className="text-foreground text-sm font-medium">Period Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pending-period">Period</Label>
                <WithFieldError field="pendingPeriod" value={pendingPeriod}>
                  {(fe) => (
                    <Select
                      value={pendingPeriod}
                      onValueChange={setPendingPeriod}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger {...fe.inputProps} id="pending-period">
                        <SelectValue placeholder="Select period..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PENDING_PERIOD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </WithFieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pending-period-value">Value</Label>
                <WithFieldError field="pendingPeriodValue">
                  {(fe) => (
                    <Input
                      {...fe.inputProps}
                      id="pending-period-value"
                      type="number"
                      min={1}
                      value={pendingPeriodValue ?? ""}
                      onChange={(e) =>
                        setPendingPeriodValue(e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="e.g. 30"
                      disabled={isSubmitting}
                    />
                  )}
                </WithFieldError>
              </div>
            </div>
          </div>
        )}

        {/* Conditional: Date field for FIXED_DATE */}
        {showDateField && (
          <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
            <h4 className="text-foreground text-sm font-medium">Date Configuration</h4>
            <div className="space-y-2">
              <Label>Pending Date</Label>
              <WithFieldError field="pendingDate" value={pendingDate}>
                {(fe) => (
                  <DatePicker
                    {...fe.inputProps}
                    value={pendingDate}
                    onChange={setPendingDate}
                    placeholder="Select pending date..."
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>
          </div>
        )}

        {/* Help text for MANUAL / PENDING_ON_ITEM types */}
        {type && !showPeriodFields && !showDateField && (
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-muted-foreground text-xs">
              <strong>Note:</strong>{" "}
              {type === PendingRuleType.MANUAL
                ? "Manual pending rules require explicit approval to release pending points."
                : "Pending on Item rules resolve based on the status of the associated item."}
            </p>
          </div>
        )}

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
