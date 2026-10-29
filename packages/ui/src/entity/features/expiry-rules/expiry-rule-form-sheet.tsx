/**
 * ExpiryRuleFormSheet - Sheet component for creating/editing Expiry Rules
 *
 * Wraps FormSheet with expiry-rule-specific form fields and logic.
 * Uses CodeInput for code auto-generation (upper-snake-case).
 * Uses ProgramMultiField for program association.
 * Uses LocalizedStringInput for multi-language descriptions.
 * Uses DatePicker for fixed date expiry.
 * Supports conditional fields based on expiry type selection.
 */

import type { CreateExpiryRule } from "@loom-loyalty/sdk";
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
  EXPIRY_PERIOD_OPTIONS,
  EXPIRY_TYPE_OPTIONS,
  type ExpiryRuleFormSheetProps,
} from "./types.js";

/**
 * Helper to extract localized string from description object
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
 * Sheet component for creating and editing Expiry Rules.
 *
 * Conditional field behavior:
 * - FIXED_DATE: shows DatePicker for expiryDate
 * - FIXED_PERIOD / ROLLING_PERIOD: shows expiryPeriod + expiryPeriodValue
 */
export function ExpiryRuleFormSheet({
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
}: ExpiryRuleFormSheetProps): ReactNode {
  // Local validation error (separate from parent error prop)
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(initialData?.name ?? "");
  const [programIds, setProgramIds] = useState<string[]>(initialData?.programIds ?? []);
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description) ?? {}
  );
  const [type, setType] = useState(initialData?.type ?? "");
  const [expiryPeriod, setExpiryPeriod] = useState(initialData?.expiryPeriod ?? "");
  const [expiryPeriodValue, setExpiryPeriodValue] = useState<number | undefined>(
    initialData?.expiryPeriodValue
  );
  const [expiryDate, setExpiryDate] = useState<string | undefined>(initialData?.expiryDate);

  // Extended fields state
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );

  // Code auto-generation
  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormError(null);
    setName(initialData?.name ?? "");
    setProgramIds(initialData?.programIds ?? []);
    setDescription(getLocalizedDescription(initialData?.description) ?? {});
    setType(initialData?.type ?? "");
    setExpiryPeriod(initialData?.expiryPeriod ?? "");
    setExpiryPeriodValue(initialData?.expiryPeriodValue);
    setExpiryDate(initialData?.expiryDate);
    codeInput.reset();
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Clear conditional fields when type changes
  const handleTypeChange = (newType: string) => {
    setType(newType);
    // Reset all conditional fields, then restore only the relevant ones
    if (newType === "FIXED_DATE") {
      setExpiryPeriod("");
      setExpiryPeriodValue(undefined);
    } else {
      setExpiryDate(undefined);
      // Reset period fields when switching between period types to avoid stale values
      setExpiryPeriod("");
      setExpiryPeriodValue(undefined);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (programIds.length === 0) {
      setFormError("At least one program must be selected.");
      return;
    }

    if (!type) {
      setFormError("Expiry type is required.");
      return;
    }

    if (type === "FIXED_DATE" && !expiryDate) {
      setFormError("Expiry date is required for fixed date rules.");
      return;
    }

    if ((type === "FIXED_PERIOD" || type === "ROLLING_PERIOD") && !expiryPeriod) {
      setFormError("Expiry period is required for period-based rules.");
      return;
    }

    if ((type === "FIXED_PERIOD" || type === "ROLLING_PERIOD") && !expiryPeriodValue) {
      setFormError("Expiry period value is required for period-based rules.");
      return;
    }

    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: CreateExpiryRule & Record<string, unknown> = {
      name,
      code: codeInput.value,
      type: type as CreateExpiryRule["type"],
      programIds,
      description: hasDescription ? description : undefined,
      ...(type === "FIXED_DATE" && expiryDate ? { expiryDate } : {}),
      ...((type === "FIXED_PERIOD" || type === "ROLLING_PERIOD") && expiryPeriod
        ? {
            expiryPeriod: expiryPeriod as CreateExpiryRule["expiryPeriod"],
            expiryPeriodValue,
          }
        : {}),
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "create" ? "Create Expiry Rule" : `Edit ${initialData?.name ?? "Expiry Rule"}`;
  const submitLabel = mode === "create" ? "Create Expiry Rule" : "Save Changes";

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
          <Label htmlFor="expiry-rule-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="expiry-rule-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter expiry rule name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="expiry-rule-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="expiry-rule-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="expiry-rule-code"
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

        {/* Description */}
        <div className="space-y-2">
          <Label>Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                value={description}
                onChange={setDescription}
                placeholder="Describe when and how balances expire"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Expiry Type */}
        <div className="space-y-2">
          <Label htmlFor="expiry-rule-type">
            Expiry Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="type" value={type}>
            {(fe) => (
              <Select value={type} onValueChange={handleTypeChange} disabled={isSubmitting}>
                <SelectTrigger {...fe.inputProps} id="expiry-rule-type">
                  <SelectValue placeholder="Select expiry type..." />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
          {type === "FIXED_DATE" && (
            <p className="text-muted-foreground text-xs">
              All balances expire on a specific calendar date.
            </p>
          )}
          {type === "FIXED_PERIOD" && (
            <p className="text-muted-foreground text-xs">
              Balances expire after a fixed period from the program start date.
            </p>
          )}
          {type === "ROLLING_PERIOD" && (
            <p className="text-muted-foreground text-xs">
              Each balance expires after a rolling period from when it was earned.
            </p>
          )}
        </div>

        {/* Conditional: Period fields */}
        {showPeriodFields && (
          <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
            <h4 className="text-foreground text-sm font-medium">Period Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry-period">Period</Label>
                <WithFieldError field="expiryPeriod" value={expiryPeriod}>
                  {(fe) => (
                    <Select
                      value={expiryPeriod}
                      onValueChange={setExpiryPeriod}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger {...fe.inputProps} id="expiry-period">
                        <SelectValue placeholder="Select period..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPIRY_PERIOD_OPTIONS.map((opt) => (
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
                <Label htmlFor="expiry-period-value">Value</Label>
                <WithFieldError field="expiryPeriodValue">
                  {(fe) => (
                    <Input
                      {...fe.inputProps}
                      id="expiry-period-value"
                      type="number"
                      min={1}
                      value={expiryPeriodValue ?? ""}
                      onChange={(e) =>
                        setExpiryPeriodValue(e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="e.g. 12"
                      disabled={isSubmitting}
                    />
                  )}
                </WithFieldError>
              </div>
            </div>
          </div>
        )}

        {/* Conditional: Date field */}
        {showDateField && (
          <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
            <h4 className="text-foreground text-sm font-medium">Date Configuration</h4>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <WithFieldError field="expiryDate" value={expiryDate}>
                {(fe) => (
                  <DatePicker
                    {...fe.inputProps}
                    value={expiryDate}
                    onChange={setExpiryDate}
                    placeholder="Select expiry date..."
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>
          </div>
        )}

        {/* Extended Fields Section */}
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
