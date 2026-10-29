/**
 * ProgramCurrencyField - Pre-wired Program Currency Selection Component
 *
 * A self-encapsulating compound component that combines:
 * - EntitySelectBox for the selection UI
 * - useProgramCurrencyField hook for data fetching
 *
 * Optionally scoped to a specific program via the programId prop.
 */

"use client";

import type { ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useProgramCurrencyField } from "./use-program-currency-field";

export interface ProgramCurrencyFieldProps {
  /** Current selected value (currency code) */
  value: string;
  /** Called when selection changes */
  onValueChange: (currencyCode: string) => void;
  /** Optional program ID to filter currencies by */
  programId?: string;
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
  /** ID for the trigger element */
  id?: string;
}

/**
 * ProgramCurrencyField - Pre-wired program currency selection component
 *
 * @example
 * ```tsx
 * <ProgramCurrencyField
 *   value={currencyCode}
 *   onValueChange={setCurrencyCode}
 *   programId={selectedProgramId}
 *   placeholder="Select a currency..."
 * />
 * ```
 */
export function ProgramCurrencyField({
  value,
  onValueChange,
  programId,
  placeholder = "Select a currency...",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: ProgramCurrencyFieldProps): ReactNode {
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
  } = useProgramCurrencyField(programId);

  const displayError = error ? error.message : null;

  return (
    <EntitySelectBox
      id={id}
      entityLabel="Currency"
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
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
    />
  );
}
