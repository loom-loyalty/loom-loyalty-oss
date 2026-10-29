/**
 * LocationField - Pre-wired Location Selection Component
 *
 * A self-encapsulating compound component that combines:
 * - EntitySelectBox for the selection UI
 * - useLocationField hook for data fetching
 * - Optional create sheet via renderCreateSheet prop
 *
 * Like PartnerField, the create sheet is not built in: the consumer passes
 * its own, and an "Add New" option appears in the dropdown when it does.
 */

"use client";

import { useState, type ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useLocationField } from "./use-location-field";

export interface LocationFieldProps {
  /** Current selected value (locationId) */
  value: string;
  /** Called when selection changes */
  onValueChange: (locationId: string) => void;
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
  /** Surfaces "required" state to screen readers on the combobox trigger --
   *  a visual-only asterisk in a sibling <Label> is not announced by itself. */
  "aria-required"?: boolean;
  /** ID for the trigger element */
  id?: string;
  /**
   * Render a create sheet. Receives open state and onOpenChange callback.
   * When provided, an "Add New" option appears in the dropdown.
   */
  renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
}

/**
 * LocationField - Pre-wired location selection component
 *
 * @example
 * ```tsx
 * <LocationField
 *   value={locationId}
 *   onValueChange={setLocationId}
 *   placeholder="Select a location..."
 * />
 * ```
 */
export function LocationField({
  value,
  onValueChange,
  placeholder = "Select a location...",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-required": ariaRequired,
  id,
  renderCreateSheet,
}: LocationFieldProps) {
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
  } = useLocationField();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const displayError = error ? error.message : null;

  return (
    <>
      <EntitySelectBox
        id={id}
        entityLabel="Location"
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
        aria-required={ariaRequired}
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
