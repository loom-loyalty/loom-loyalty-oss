/**
 * PartnerField - Pre-wired Partner Selection Component
 *
 * A self-encapsulating compound component that combines:
 * - EntitySelectBox for the selection UI
 * - usePartnerField hook for data fetching and mutations
 * - Optional custom create sheet via renderCreateSheet prop
 *
 * The create sheet is NOT built-in to avoid duplicating the Hub's
 * PartnerFormSheet. Instead, the consumer passes their own create sheet
 * via the renderCreateSheet prop.
 */

"use client";

import type { ReactNode } from "react";
import * as React from "react";

import { EntitySelectBox } from "../entity-select-box";
import { usePartnerField } from "./use-partner-field";

export interface PartnerFieldProps {
  /** Current selected value (partnerId) */
  value: string;
  /** Called when selection changes */
  onValueChange: (partnerId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Additional className for the select trigger */
  className?: string;
  /**
   * Render a custom create sheet. Receives open state and onOpenChange callback.
   * When provided, an "Add New" option appears in the dropdown.
   *
   * @example
   * ```tsx
   * <PartnerField
   *   value={partnerId}
   *   onValueChange={setPartnerId}
   *   renderCreateSheet={(open, onOpenChange) => (
   *     <PartnerFormSheet
   *       open={open}
   *       onOpenChange={onOpenChange}
   *       mode="create"
   *       onSubmit={async (data) => {
   *         const result = await createPartner(data);
   *         setPartnerId(result.partnerId);
   *         onOpenChange(false);
   *       }}
   *     />
   *   )}
   * />
   * ```
   */
  renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation */
  "aria-describedby"?: string;
  /** ID for the trigger element */
  id?: string;
}

/**
 * PartnerField - Pre-wired partner selection component
 *
 * @example
 * ```tsx
 * // Without create sheet (select only)
 * <PartnerField
 *   value={partnerId}
 *   onValueChange={setPartnerId}
 *   placeholder="Select a partner..."
 * />
 *
 * // With create sheet
 * <PartnerField
 *   value={partnerId}
 *   onValueChange={setPartnerId}
 *   renderCreateSheet={(open, onOpenChange) => (
 *     <PartnerFormSheet open={open} onOpenChange={onOpenChange} mode="create" ... />
 *   )}
 * />
 * ```
 */
export function PartnerField({
  value,
  onValueChange,
  placeholder = "Select a partner...",
  disabled,
  className,
  renderCreateSheet,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: PartnerFieldProps) {
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
  } = usePartnerField();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const displayError = error ? error.message : null;

  return (
    <>
      <EntitySelectBox
        id={id}
        entityLabel="Partner"
        options={options}
        lookupOptions={optionsAll}
        value={value}
        onValueChange={onValueChange}
        onCreateNew={renderCreateSheet ? () => setIsCreateOpen(true) : undefined}
        isLoading={isLoading}
        error={displayError}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
      {renderCreateSheet?.(isCreateOpen, setIsCreateOpen)}
    </>
  );
}
