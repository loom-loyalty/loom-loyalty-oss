/**
 * CurrencyFormSheet - Sheet component for creating/editing Program Currencies
 *
 * Wraps FormSheet with currency-specific form fields and logic.
 * Uses MetadataField for currency type selection with pre-wired data fetching.
 * Uses CodeInput for code auto-generation (UPPER_SNAKE_CASE format).
 * Uses LocalizedStringInput for multi-language description support.
 * Uses PopoverMultiSelect for program association.
 * Uses EntitySelectBox for pending/expiry rule selection.
 * Supports extended fields from data model extensions.
 */

import { parseLocalizedDescription } from "@loom-loyalty/core";
import type {
  CreateProgram,
  CreateProgramCurrency,
  ExpiryRule,
  PendingRule,
} from "@loom-loyalty/sdk";
import {
  getProgramBankManagementListExpiryRulesQueryKey,
  getProgramBankManagementListPendingRulesQueryKey,
  programBankManagementListExpiryRules,
  programBankManagementListPendingRules,
} from "@loom-loyalty/sdk";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { EntitySelectBox } from "../../../forms/entity-select-box.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { ProgramMultiField, useProgramField } from "../../../forms/program-field/index.js";
import { useAllPages } from "../../../hooks/use-all-pages.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { ExpiryRuleFormSheet } from "../expiry-rules/expiry-rule-form-sheet.js";
import { ProgramFormSheet } from "../programs/program-form-sheet.js";
import type { CurrencyFormSheetProps } from "./types.js";

/** Rule catalogs change rarely; the dropdowns need not refetch per mount. */
const RULES_STALE_MS = 5 * 60 * 1000;

function listErrorMessage(isError: boolean, error: Error | null, label: string): string | null {
  if (!isError) return null;
  return error?.message || `Could not load every ${label}.`;
}

/**
 * Sheet component for creating and editing Program Currencies.
 */
export function CurrencyFormSheet({
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
  onCreateExpiryRule,
}: CurrencyFormSheetProps): ReactNode {
  // Local validation error (separate from parent error prop)
  const [formError, setFormError] = useState<string | null>(null);

  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [currencyTypeCode, setCurrencyTypeCode] = useState(initialData?.currencyType?.code ?? "");
  const [typeIsSuggested, setTypeIsSuggested] = useState(false);
  const [description, setDescription] = useState<LocalizedString>(
    () => parseLocalizedDescription(initialData?.description) ?? {}
  );
  const [programIds, setProgramIds] = useState<string[]>(() => initialData?.programIds ?? []);
  const [pendingRuleId, setPendingRuleId] = useState(initialData?.pendingRule?.pendingRuleId ?? "");
  const [expiryRuleId, setExpiryRuleId] = useState(initialData?.expiryRule?.expiryRuleId ?? "");

  // Metadata field hook for auto-creating suggested types on save
  const { createMetadata, findOption, isTypeNotFound } = useMetadataField("CURRENCY_TYPE");

  // Program field hook for inline creation support
  const { createProgram, isCreating: isCreatingProgram } = useProgramField();

  // Program create error state (create sheet managed by ProgramMultiField)
  const [programCreateError, setProgramCreateError] = useState<string | null>(null);

  // Expiry rule create sheet state
  const [expiryRuleCreateOpen, setExpiryRuleCreateOpen] = useState(false);
  const [expiryRuleCreateError, setExpiryRuleCreateError] = useState<string | null>(null);
  const [isCreatingExpiryRule, setIsCreatingExpiryRule] = useState(false);

  // Pending and expiry rules: every page, so a rule past the first 100 stays selectable.
  const pendingRules = useAllPages<PendingRule>({
    queryKey: getProgramBankManagementListPendingRulesQueryKey(),
    fetchPage: (page, size) => programBankManagementListPendingRules({ page, size }),
    staleTime: RULES_STALE_MS,
    source: "currency-form-pending-rules",
  });
  const expiryRules = useAllPages<ExpiryRule>({
    queryKey: getProgramBankManagementListExpiryRulesQueryKey(),
    fetchPage: (page, size) => programBankManagementListExpiryRules({ page, size }),
    staleTime: RULES_STALE_MS,
    source: "currency-form-expiry-rules",
  });

  // Format pending rules as EntitySelectBox options
  const pendingRuleOptions = useMemo(
    () =>
      pendingRules.items
        .filter((r) => r.pendingRuleId != null)
        .map((r) => ({
          id: r.pendingRuleId,
          name: r.name,
          secondaryText: r.code,
        })),
    [pendingRules.items]
  );

  // Format expiry rules as EntitySelectBox options
  const expiryRuleOptions = useMemo(
    () =>
      expiryRules.items
        .filter((r) => r.expiryRuleId != null)
        .map((r) => ({
          id: r.expiryRuleId,
          name: r.name,
          secondaryText: r.code,
        })),
    [expiryRules.items]
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

  // Reset form when sheet opens/closes or initialData changes
  const resetForm = () => {
    setFormError(null);
    setName(initialData?.name ?? "");
    setCurrencyTypeCode(initialData?.currencyType?.code ?? "");
    setTypeIsSuggested(false);
    setDescription(parseLocalizedDescription(initialData?.description) ?? {});
    setProgramIds(initialData?.programIds ?? []);
    setPendingRuleId(initialData?.pendingRule?.pendingRuleId ?? "");
    setExpiryRuleId(initialData?.expiryRule?.expiryRuleId ?? "");
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

  // Handle submit - build CreateProgramCurrency from form state
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (programIds.length === 0) {
      setFormError("At least one program must be selected.");
      return;
    }

    // Auto-create suggested metadata type if it doesn't exist yet.
    // Skip when the metadata type itself is not found (404).
    if (typeIsSuggested && currencyTypeCode && !isTypeNotFound) {
      const option = findOption(currencyTypeCode);
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

    const formData: CreateProgramCurrency & Record<string, unknown> = {
      name,
      code: codeInput.value,
      currencyTypeCode: currencyTypeCode || "default",
      description: hasDescription ? description : undefined,
      programIds,
      pendingRuleId: pendingRuleId || undefined,
      expiryRuleId: expiryRuleId || undefined,
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Currency" : `Edit ${initialData?.name ?? "Currency"}`;
  const submitLabel = mode === "create" ? "Create Currency" : "Save Changes";

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
          <Label htmlFor="currency-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="currency-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter currency name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="currency-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="currency-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="currency-code"
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

        {/* Currency Type using MetadataField */}
        <div className="space-y-2">
          <Label>
            Currency Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="currencyTypeCode" value={currencyTypeCode}>
            {(fe) => (
              <MetadataField
                {...fe.inputProps}
                id="currency-type-code"
                typeCode="CURRENCY_TYPE"
                typeLabel="Currency Type"
                value={currencyTypeCode}
                onValueChange={(value, isSuggested) => {
                  setCurrencyTypeCode(value);
                  setTypeIsSuggested(isSuggested);
                }}
                placeholder="Select currency type..."
                disabled={isSubmitting}
                aria-describedby={
                  fe.error ? `${fe.errorId} currency-type-code-hint` : "currency-type-code-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="currency-type-code-hint" className="text-muted-foreground text-xs">
            Classification of the currency (e.g., Loyalty Points, Cashback).
            {typeIsSuggested && (
              <span className="text-primary ml-1">(Will be created when you save)</span>
            )}
          </p>
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
                placeholder="Select programs to associate..."
                disabled={isSubmitting}
                renderCreateSheet={(open, onOpenChange) => (
                  <ProgramFormSheet
                    open={open}
                    onOpenChange={onOpenChange}
                    mode="create"
                    onSubmit={async (data) => {
                      setProgramCreateError(null);
                      try {
                        const program = await createProgram(data as CreateProgram);
                        const newProgramId = program.programId;
                        if (newProgramId) {
                          setProgramIds((prev) => [...prev, newProgramId]);
                        }
                        onOpenChange(false);
                      } catch (err) {
                        setProgramCreateError(
                          err instanceof Error ? err.message : "Failed to create program"
                        );
                      }
                    }}
                    isSubmitting={isCreatingProgram}
                    error={programCreateError}
                  />
                )}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Programs that use this currency. A currency can belong to multiple programs.
          </p>
        </div>

        {/* Pending Rule select */}
        <div className="space-y-2">
          <Label>Pending Rule</Label>
          <WithFieldError field="pendingRuleId" value={pendingRuleId}>
            {(fe) => (
              <EntitySelectBox
                {...fe.inputProps}
                entityLabel="Pending Rule"
                options={pendingRuleOptions}
                value={pendingRuleId}
                onValueChange={setPendingRuleId}
                isLoading={pendingRules.isLoading}
                error={listErrorMessage(pendingRules.isError, pendingRules.error, "pending rule")}
                placeholder="Select pending rule..."
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Rule governing when currency amounts remain in pending status before being confirmed.
          </p>
        </div>

        {/* Expiry Rule select */}
        <div className="space-y-2">
          <Label>Expiry Rule</Label>
          <WithFieldError field="expiryRuleId" value={expiryRuleId}>
            {(fe) => (
              <EntitySelectBox
                {...fe.inputProps}
                entityLabel="Expiry Rule"
                options={expiryRuleOptions}
                value={expiryRuleId}
                onValueChange={setExpiryRuleId}
                isLoading={expiryRules.isLoading}
                error={listErrorMessage(expiryRules.isError, expiryRules.error, "expiry rule")}
                placeholder="Select expiry rule..."
                disabled={isSubmitting}
                onCreateNew={onCreateExpiryRule ? () => setExpiryRuleCreateOpen(true) : undefined}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Rule governing when currency amounts expire and are no longer redeemable.
          </p>
        </div>

        {/* Inline Expiry Rule Create Sheet */}
        {onCreateExpiryRule && (
          <ExpiryRuleFormSheet
            open={expiryRuleCreateOpen}
            onOpenChange={setExpiryRuleCreateOpen}
            mode="create"
            onSubmit={async (data) => {
              setExpiryRuleCreateError(null);
              setIsCreatingExpiryRule(true);
              try {
                const result = await onCreateExpiryRule(data as unknown as Record<string, unknown>);
                const newId =
                  (typeof result.expiryRuleId === "string" ? result.expiryRuleId : null) ??
                  (typeof result.id === "string" ? result.id : null);
                if (newId) {
                  setExpiryRuleId(newId);
                }
                setExpiryRuleCreateOpen(false);
              } catch (err) {
                setExpiryRuleCreateError(
                  err instanceof Error ? err.message : "Failed to create expiry rule"
                );
              } finally {
                setIsCreatingExpiryRule(false);
              }
            }}
            isSubmitting={isCreatingExpiryRule}
            error={expiryRuleCreateError}
          />
        )}

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label>Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                value={description}
                onChange={setDescription}
                placeholder="Describe the currency and its usage"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the currency. Add translations as needed.
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
