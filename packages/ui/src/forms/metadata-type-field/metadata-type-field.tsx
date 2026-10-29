/**
 * MetadataTypeField - Pre-wired Metadata Type Selection Component
 *
 * A self-encapsulating component that combines:
 * - EntitySelectBox for the selection UI
 * - useMetadataTypeField hook for data fetching
 */

"use client";

import type { MetadataTypeCategory } from "@loom-loyalty/sdk";
import { useState, type ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useMetadataTypeField } from "./use-metadata-type-field";

export interface MetadataTypeFieldProps {
  /** Current selected value (metadata type code) */
  value: string;
  /** Called when selection changes */
  onValueChange: (metadataTypeCode: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Additional className for the select trigger */
  className?: string;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation */
  "aria-describedby"?: string;
  /** ARIA required signal for screen readers */
  "aria-required"?: boolean;
  /** ID for the trigger element */
  id?: string;
  /** Only offer metadata types of this category (e.g. LOCATION) */
  category?: MetadataTypeCategory;
  /** Only offer the types allowed directly below this type code. */
  childOf?: string;
  /** Type codes to leave out of the options. */
  excludeCodes?: readonly string[];
  /** Render a create sheet; when provided, an "Add New" option appears. */
  renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
}

export function MetadataTypeField({
  value,
  onValueChange,
  placeholder = "Select a metadata type...",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-required": ariaRequired,
  id,
  category,
  childOf,
  excludeCodes,
  renderCreateSheet,
}: MetadataTypeFieldProps): ReactNode {
  const {
    options,
    optionsAll,
    isLoading,
    error,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMetadataTypeField({ category, childOf, excludeCodes });

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const displayError = error ? error.message : null;

  return (
    <>
      <EntitySelectBox
        id={id}
        entityLabel="Metadata Type"
        widgetType="metadata-type-combobox"
        metadataCategory="DATA_TYPE"
        options={options}
        lookupOptions={optionsAll}
        value={value}
        onValueChange={onValueChange}
        isLoading={isLoading}
        error={displayError}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        onCreateNew={renderCreateSheet ? () => setIsCreateOpen(true) : undefined}
      />
      {renderCreateSheet?.(isCreateOpen, setIsCreateOpen)}
    </>
  );
}
