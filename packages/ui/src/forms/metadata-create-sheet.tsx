/**
 * MetadataCreateSheet
 *
 * A reusable sheet for creating new metadata types using schema-driven forms.
 * Used in wizards and forms when "Add New" is clicked on a MetadataSelectBox.
 *
 * Supports different metadata categories with their specific required fields:
 * - METADATA: Standard fields (name, code, description)
 * - DATA_TYPE: Standard + dataModelCode
 * - LOCATION: Standard + address fields
 * - ITEM: Standard + itemVariantId, sku, upc
 *
 * The category-specific fields and their validation live in
 * `./metadata-sub-type-fields`, shared with the metadata admin form sheet.
 */

"use client";

import type { MetadataTypeCategory } from "@loom-loyalty/sdk";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { WithFieldError, type FormFieldError } from "./field-errors";
import { FormSheet, type FormSheetError } from "./form-sheet";
import { LocalizedStringInput } from "./localized-string-input";
import type { MetadataOption } from "./metadata-select-box";
import {
  MetadataSubTypeFields,
  buildMetadataSubTypePayload,
  isMetadataSubTypeCategory,
  validateMetadataForm,
  type DataModelOption,
  type MetadataSubTypeFieldName,
  type MetadataSubTypePayload,
  type MetadataSubTypeValues,
} from "./metadata-sub-type-fields";

/**
 * Form data for creating metadata.
 *
 * The base fields plus the sub-type half of the body. The sub-type fields come
 * from the canonical `MetadataSubTypePayload` rather than a second copy of the
 * same list, so a field added there cannot go missing here.
 */
export interface CreateMetadataData extends MetadataSubTypePayload {
  /** Code identifying the metadata type (e.g., "PROGRAM_TYPE", "CURRENCY_TYPE") */
  typeCode: string;
  /** Unique code for this metadata instance */
  code: string;
  /** Display name of the metadata */
  name: string;
  /** Localized description of the metadata */
  description?: Record<string, string>;
}

/**
 * Metadata type category determines which fields are shown/required.
 * Re-exported from the SDK — a hand-written copy under the same name compiles
 * against the API's enum by coincidence, not by contract.
 */
export type { MetadataTypeCategory } from "@loom-loyalty/sdk";

/**
 * Option for data model select
 */
export type { DataModelOption } from "./metadata-sub-type-fields";

/**
 * Option for metadata select (e.g., countries)
 * Re-exported from metadata-select-box for convenience
 */
export type { MetadataOption } from "./metadata-select-box";

/**
 * Simple validation for the form fields. Exported for direct unit tests; the
 * sheet itself calls it on submit. Shared with MetadataFormSheet.
 */
export { validateMetadataForm as validateForm } from "./metadata-sub-type-fields";

/**
 * Generate a code from a name
 */
function generateCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export interface MetadataCreateSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called when the sheet should close */
  onOpenChange: (open: boolean) => void;
  /** The type code for the metadata being created (e.g., "PROGRAM_TYPE") */
  typeCode: string;
  /** Display label for the metadata type (e.g., "Program Type") */
  typeLabel: string;
  /**
   * Category of metadata type. Determines which fields are shown:
   * - METADATA: Standard fields (name, code, description)
   * - DATA_TYPE: Standard fields + dataModelCode (required)
   * - LOCATION: Standard fields + address fields
   * - ITEM: Standard fields + item fields
   * @default "METADATA"
   */
  category?: MetadataTypeCategory;
  /** Available data models for DATA_TYPE category */
  dataModelOptions?: DataModelOption[];
  /** Whether data models are loading */
  isLoadingDataModels?: boolean;
  /** Available countries for LOCATION category (fetched as COUNTRY metadata type) */
  countryOptions?: MetadataOption[];
  /** Whether countries are loading */
  isLoadingCountries?: boolean;
  /** Called when the form is submitted successfully */
  onSubmit: (data: CreateMetadataData) => void | Promise<void>;
  /** Whether the form is in a loading/submitting state */
  isLoading?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/**
 * Sheet component for creating new metadata entries.
 *
 * @example
 * ```tsx
 * // Simple METADATA category (default)
 * <MetadataCreateSheet
 *   open={isCreateOpen}
 *   onOpenChange={setIsCreateOpen}
 *   typeCode="PROGRAM_TYPE"
 *   typeLabel="Program Type"
 *   onSubmit={handleSubmit}
 * />
 *
 * // LOCATION category
 * <MetadataCreateSheet
 *   open={isCreateOpen}
 *   onOpenChange={setIsCreateOpen}
 *   typeCode="STORE_LOCATION"
 *   typeLabel="Store Location"
 *   category="LOCATION"
 *   countryOptions={countries}
 *   onSubmit={handleSubmit}
 * />
 *
 * // ITEM category
 * <MetadataCreateSheet
 *   open={isCreateOpen}
 *   onOpenChange={setIsCreateOpen}
 *   typeCode="PRODUCT"
 *   typeLabel="Product"
 *   category="ITEM"
 *   onSubmit={handleSubmit}
 * />
 * ```
 */
export function MetadataCreateSheet({
  open,
  onOpenChange,
  typeCode,
  typeLabel,
  category = "METADATA",
  dataModelOptions = [],
  isLoadingDataModels = false,
  countryOptions = [],
  isLoadingCountries = false,
  onSubmit,
  isLoading = false,
  error,
  fieldErrors,
}: MetadataCreateSheetProps) {
  // Common form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState<Record<string, string>>({});
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Category-specific state
  const [subTypeValues, setSubTypeValues] = useState<MetadataSubTypeValues>({});

  // Reset form state when sheet opens.
  // This is a valid pattern for forms in dialogs/sheets - we need to clear previous
  // values when the sheet opens so the user starts with a clean form.
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional reset when sheet opens */
  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setDescription({});
      setCodeManuallyEdited(false);
      setErrors({});
      setSubTypeValues({});
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-generate code from name (unless manually edited)
  const handleNameChange = useCallback(
    (newName: string) => {
      setName(newName);
      if (!codeManuallyEdited) {
        setCode(generateCode(newName));
      }
      if (errors.name) {
        setErrors((prev) => ({ ...prev, name: "" }));
      }
    },
    [codeManuallyEdited, errors.name]
  );

  const handleCodeChange = useCallback(
    (newCode: string) => {
      const sanitized = newCode.toLowerCase().replace(/[^a-z0-9-]/g, "");
      setCode(sanitized);
      setCodeManuallyEdited(true);
      if (errors.code) {
        setErrors((prev) => ({ ...prev, code: "" }));
      }
    },
    [errors.code]
  );

  const handleSubTypeChange = useCallback((field: MetadataSubTypeFieldName, value: string) => {
    setSubTypeValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent bubbling to parent forms

      // Only include description if at least one language has content
      const hasDescription =
        Object.keys(description).length > 0 &&
        Object.values(description).some((v) => v.trim().length > 0);

      const formData: CreateMetadataData = {
        typeCode,
        code,
        name,
        description: hasDescription ? description : undefined,
        ...buildMetadataSubTypePayload(subTypeValues, category),
      };

      const validationErrors = validateMetadataForm({ ...formData, ...subTypeValues }, category);

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      await onSubmit(formData);
    },
    [typeCode, code, name, description, category, subTypeValues, onSubmit]
  );

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Add New ${typeLabel}`}
      description={`Create a new ${typeLabel.toLowerCase()} that will be available for selection.`}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isLoading}
      submitLabel={`Add ${typeLabel}`}
      error={error}
      fieldErrors={fieldErrors}
      className="sm:max-w-md"
    >
      <div className="space-y-4">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="metadata-name" className={errors.name ? "text-destructive" : ""}>
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="metadata-name"
                placeholder={`e.g., My ${typeLabel}`}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isLoading}
                aria-invalid={fe.error ? true : !!errors.name}
                aria-describedby={
                  [
                    fe.inputProps["aria-describedby"],
                    errors.name ? "metadata-name-error" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
              />
            )}
          </WithFieldError>
          {errors.name && (
            <p id="metadata-name-error" className="text-destructive text-sm" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        {/* Code field */}
        <div className="space-y-2">
          <Label htmlFor="metadata-code" className={errors.code ? "text-destructive" : ""}>
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="metadata-code"
                placeholder="e.g., my-program-type"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                disabled={isLoading}
                aria-invalid={fe.error ? true : !!errors.code}
                aria-describedby={
                  [
                    fe.inputProps["aria-describedby"],
                    errors.code ? "metadata-code-error" : "metadata-code-hint",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                className="font-mono"
              />
            )}
          </WithFieldError>
          {errors.code ? (
            <p id="metadata-code-error" className="text-destructive text-sm" role="alert">
              {errors.code}
            </p>
          ) : (
            <p id="metadata-code-hint" className="text-muted-foreground text-sm">
              Unique identifier (auto-generated from name)
            </p>
          )}
        </div>

        {/* Category-specific fields */}
        {isMetadataSubTypeCategory(category) && (
          <MetadataSubTypeFields
            category={category}
            values={subTypeValues}
            onChange={handleSubTypeChange}
            errors={errors}
            disabled={isLoading}
            dataModelOptions={dataModelOptions}
            isLoadingDataModels={isLoadingDataModels}
            countryOptions={countryOptions}
            isLoadingCountries={isLoadingCountries}
          />
        )}

        {/* Description field (all categories) */}
        <div className="space-y-2">
          <Label>Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                value={description}
                onChange={setDescription}
                placeholder={`Describe this ${typeLabel.toLowerCase()}...`}
                multiline
                disabled={isLoading}
              />
            )}
          </WithFieldError>
          {errors.description && (
            <p className="text-destructive text-sm" role="alert">
              {errors.description}
            </p>
          )}
        </div>
      </div>
    </FormSheet>
  );
}
