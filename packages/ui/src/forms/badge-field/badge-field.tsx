/**
 * BadgeField - Pre-wired Badge Selection Component
 *
 * A self-encapsulating component that combines:
 * - EntitySelectBox for the selection UI
 * - useBadgeField hook for data fetching
 */

"use client";

import type { ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useBadgeField } from "./use-badge-field";

export interface BadgeFieldProps {
  /** Current selected value (badgeId) */
  value: string;
  /** Called when selection changes */
  onValueChange: (badgeId: string) => void;
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

export function BadgeField({
  value,
  onValueChange,
  placeholder = "Select a badge...",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: BadgeFieldProps): ReactNode {
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
  } = useBadgeField();

  const displayError = error ? error.message : null;

  return (
    <EntitySelectBox
      id={id}
      entityLabel="Badge"
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
