/**
 * MetadataField - Pre-wired Metadata Selection Component
 *
 * A self-encapsulating compound component that combines:
 * - MetadataSelectBox for the selection UI
 * - MetadataCreateSheet for inline creation
 * - useMetadataField hook for data fetching and mutations
 *
 * This eliminates duplicative boilerplate across consumers by handling:
 * - SDK hook calls internally
 * - Suggested options from centralized constants
 * - Create sheet state management
 * - Create mutation handling
 * - Auto-selection after creation
 */

"use client";

import type { MetadataTypeCategory } from "@loom-loyalty/sdk";
import { useState } from "react";

import { MetadataCreateSheet, type CreateMetadataData } from "../metadata-create-sheet";
import {
  MetadataSelectBox,
  type MetadataOption,
  type SuggestedOption,
} from "../metadata-select-box";
import { useMetadataField } from "./use-metadata-field";

export interface MetadataFieldProps {
  /** The metadata type code (e.g., "PROGRAM_TYPE") */
  typeCode: string;
  /** Display label for the metadata type (e.g., "Program Type") */
  typeLabel: string;
  /** Current selected value (code) */
  value: string;
  /**
   * Called when selection changes
   * @param value - The selected code
   * @param isSuggested - Whether the selected option is a suggested (virtual) option
   */
  onValueChange: (value: string, isSuggested: boolean) => void;
  /** Optional: Called with the full option when selection changes */
  onOptionChange?: (option: MetadataOption | SuggestedOption | undefined) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Show "Add New" button (default: true) */
  showCreateNew?: boolean;
  /** Additional className for the select trigger */
  className?: string;
  /** Whether to show descriptions in the dropdown (default: true) */
  showDescriptions?: boolean;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation */
  "aria-describedby"?: string;
  /** ID for the trigger element */
  id?: string;
}

/**
 * MetadataField - Pre-wired metadata selection component
 *
 * This component integrates SDK hooks internally, provides suggested options,
 * and handles inline creation - all in one cohesive component.
 *
 * @example
 * ```tsx
 * // Simplest usage
 * <MetadataField
 *   typeCode="PROGRAM_TYPE"
 *   typeLabel="Program Type"
 *   value={typeCode}
 *   onValueChange={(value, isSuggested) => {
 *     setTypeCode(value);
 *     setTypeIsSuggested(isSuggested);
 *   }}
 * />
 *
 * // With all options
 * <MetadataField
 *   typeCode="PROGRAM_TYPE"
 *   typeLabel="Program Type"
 *   value={typeCode}
 *   onValueChange={handleTypeChange}
 *   onOptionChange={handleOptionChange}
 *   placeholder="Select a program type..."
 *   showCreateNew={canCreate}
 *   disabled={isSubmitting}
 *   aria-invalid={!!error}
 *   aria-describedby="type-error"
 * />
 * ```
 */
export function MetadataField({
  typeCode,
  typeLabel,
  value,
  onValueChange,
  onOptionChange,
  placeholder,
  disabled,
  showCreateNew = true,
  className,
  showDescriptions = true,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: MetadataFieldProps) {
  const {
    category,
    isTypeNotFound,
    metadataOptions,
    metadataOptionsAll,
    suggestedOptions,
    isLoading,
    error,
    createMetadata,
    isCreating,
    createError,
    findOption,
    dataModelTypeOptions,
    isLoadingDataModelTypes,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMetadataField(typeCode);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSheetError, setCreateSheetError] = useState<string | null>(null);

  const handleValueChange = (newValue: string, isSuggested: boolean) => {
    onValueChange(newValue, isSuggested);
    onOptionChange?.(findOption(newValue));
  };

  const handleCreate = async (data: CreateMetadataData) => {
    setCreateSheetError(null);
    try {
      await createMetadata({
        code: data.code,
        name: data.name,
        description: data.description,
        // Category-specific fields
        dataModelCode: data.dataModelCode,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        cityLocality: data.cityLocality,
        stateProvinceRegion: data.stateProvinceRegion,
        postalCode: data.postalCode,
        countryCode: data.countryCode,
        coordinates: data.coordinates,
        itemVariantId: data.itemVariantId,
        sku: data.sku,
        upc: data.upc,
      });

      // Auto-select newly created option (it's no longer suggested since it exists now)
      onValueChange(data.code, false);
      onOptionChange?.({ code: data.code, name: data.name, description: data.description?.en });
      setIsCreateOpen(false);
    } catch (err) {
      setCreateSheetError(err instanceof Error ? err.message : "Failed to create metadata");
    }
  };

  // Only surface non-404 errors to the select box.
  // 404 (type not found) is handled via isTypeNotFound + suggested options fallback.
  const displayError = error && !isTypeNotFound ? error.message : null;

  // Disable "Add New" when the metadata type doesn't exist — we can't route
  // creation to the correct endpoint without knowing the category.
  const canCreate = showCreateNew && !isTypeNotFound;

  return (
    <>
      <MetadataSelectBox
        id={id}
        metadataTypeCode={typeCode}
        metadataTypeLabel={typeLabel}
        category={category as MetadataTypeCategory | undefined}
        metadataOptions={metadataOptions}
        lookupOptions={metadataOptionsAll}
        suggestedOptions={suggestedOptions}
        value={value}
        onValueChange={handleValueChange}
        onCreateNew={canCreate ? () => setIsCreateOpen(true) : undefined}
        isLoading={isLoading}
        error={displayError}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        showDescriptions={showDescriptions}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
      <MetadataCreateSheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        typeCode={typeCode}
        typeLabel={typeLabel}
        category={category}
        dataModelOptions={dataModelTypeOptions}
        isLoadingDataModels={isLoadingDataModelTypes}
        onSubmit={handleCreate}
        isLoading={isCreating}
        error={createSheetError ?? createError?.message}
      />
    </>
  );
}
