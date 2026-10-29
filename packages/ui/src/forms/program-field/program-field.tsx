/**
 * ProgramField - Pre-wired Program Selection Component
 *
 * A self-encapsulating compound component that combines:
 * - EntitySelectBox for the selection UI
 * - useProgramField hook for data fetching and mutations
 * - Optional custom create sheet via renderCreateSheet prop
 *
 * The create sheet is NOT built-in to avoid duplicating the Hub's
 * ProgramFormSheet. Instead, the consumer passes their own create sheet
 * via the renderCreateSheet prop.
 */

"use client";

import type { ReactNode } from "react";
import * as React from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useProgramField } from "./use-program-field";

export interface ProgramFieldProps {
  /** Current selected value (programId) */
  value: string;
  /** Called when selection changes */
  onValueChange: (programId: string) => void;
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
   * <ProgramField
   *   value={programId}
   *   onValueChange={setProgramId}
   *   renderCreateSheet={(open, onOpenChange) => (
   *     <ProgramFormSheet
   *       open={open}
   *       onOpenChange={onOpenChange}
   *       mode="create"
   *       onSubmit={async (data) => {
   *         const result = await createProgram(data);
   *         setProgramId(result.programId);
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
 * ProgramField - Pre-wired program selection component
 *
 * @example
 * ```tsx
 * // Without create sheet (select only)
 * <ProgramField
 *   value={programId}
 *   onValueChange={setProgramId}
 *   placeholder="Select a program..."
 * />
 *
 * // With create sheet
 * <ProgramField
 *   value={programId}
 *   onValueChange={setProgramId}
 *   renderCreateSheet={(open, onOpenChange) => (
 *     <ProgramFormSheet open={open} onOpenChange={onOpenChange} mode="create" ... />
 *   )}
 * />
 * ```
 */
export function ProgramField({
  value,
  onValueChange,
  placeholder = "Select a program...",
  disabled,
  className,
  renderCreateSheet,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: ProgramFieldProps) {
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
  } = useProgramField();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const displayError = error ? error.message : null;

  return (
    <>
      <EntitySelectBox
        id={id}
        entityLabel="Program"
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
