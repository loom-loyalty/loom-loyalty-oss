/**
 * TargetField - Pre-wired Target Selection Component
 *
 * A self-encapsulating compound component that combines:
 * - EntitySelectBox for the selection UI
 * - useTargetField hook for data fetching and mutations
 * - Optional custom create sheet via renderCreateSheet prop
 */

"use client";

import { useState, type ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useTargetField } from "./use-target-field";

export interface TargetFieldProps {
  /** Current selected value (targetId) */
  value: string;
  /** Called when selection changes */
  onValueChange: (targetId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Additional className for the select trigger */
  className?: string;
  /** Render a custom create sheet */
  renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation */
  "aria-describedby"?: string;
  /** ID for the trigger element */
  id?: string;
}

export function TargetField({
  value,
  onValueChange,
  placeholder = "Select a target...",
  disabled,
  className,
  renderCreateSheet,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: TargetFieldProps): ReactNode {
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
  } = useTargetField();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const displayError = error ? error.message : null;

  return (
    <>
      <EntitySelectBox
        id={id}
        entityLabel="Target"
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
