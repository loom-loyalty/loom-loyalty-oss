/**
 * ProgramMultiField - Pre-wired Multi-Program Selection Component
 *
 * A compound component that combines:
 * - useProgramField hook for data fetching
 * - PopoverMultiSelect for the UI (badges in trigger, +N overflow)
 * - Optional create sheet via renderCreateSheet prop
 *
 * Follows the same pattern as ProgramField but supports multiple selections.
 */

"use client";

import { useMemo, useState, type ReactNode } from "react";

import { PopoverMultiSelect, type PopoverMultiSelectOption } from "../popover-multi-select";
import { useProgramField } from "./use-program-field";

export interface ProgramMultiFieldProps {
  /** Currently selected program IDs */
  value: string[];
  /** Called when selection changes */
  onValueChange: (programIds: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Render a custom create sheet */
  renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
  /** ARIA invalid state */
  "aria-invalid"?: boolean;
  /** ARIA describedby */
  "aria-describedby"?: string;
  /** ARIA required state — surfaces visual `*` to screen readers (WCAG 3.3.2). */
  "aria-required"?: boolean;
  /** ID for the trigger */
  id?: string;
}

/**
 * ProgramMultiField - Pre-wired multi-program selection component
 *
 * @example
 * ```tsx
 * const [programIds, setProgramIds] = useState<string[]>([]);
 *
 * <ProgramMultiField
 *   value={programIds}
 *   onValueChange={setProgramIds}
 *   placeholder="Select programs..."
 * />
 * ```
 */
export function ProgramMultiField({
  value,
  onValueChange,
  placeholder = "Select programs...",
  disabled = false,
  className,
  renderCreateSheet,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-required": ariaRequired,
  id,
}: ProgramMultiFieldProps): ReactNode {
  const {
    options,
    optionsAll,
    isLoading,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useProgramField();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const toMultiSelect = (opt: { id: string; name: string; secondaryText?: string }) => ({
    value: opt.id,
    label: opt.name,
    description: opt.secondaryText,
  });

  const multiSelectOptions: PopoverMultiSelectOption[] = useMemo(
    () => options.map(toMultiSelect),
    [options]
  );

  const multiSelectLookup: PopoverMultiSelectOption[] = useMemo(
    () => optionsAll.map(toMultiSelect),
    [optionsAll]
  );

  return (
    <>
      <PopoverMultiSelect
        options={multiSelectOptions}
        lookupOptions={multiSelectLookup}
        value={value}
        onChange={onValueChange}
        placeholder={placeholder}
        searchPlaceholder="Search programs..."
        emptyMessage={isLoading ? "Loading programs..." : "No programs found."}
        disabled={disabled}
        isLoading={isLoading}
        className={className}
        id={id}
        aria-label="Select programs"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        entityType="PROGRAM"
        onCreateNew={renderCreateSheet ? () => setIsCreateOpen(true) : undefined}
        createNewLabel="Create Program"
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
