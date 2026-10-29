/**
 * EventRuleField - Pre-wired Event Rule Selection Component
 *
 * A self-encapsulating component that combines:
 * - EntitySelectBox for the selection UI
 * - useEventRuleField hook for data fetching
 */

"use client";

import type { ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useEventRuleField } from "./use-event-rule-field";

export interface EventRuleFieldProps {
  /** Current selected value (eventRuleId) */
  value: string;
  /** Called when selection changes */
  onValueChange: (eventRuleId: string) => void;
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

export function EventRuleField({
  value,
  onValueChange,
  placeholder = "Select an event rule...",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: EventRuleFieldProps): ReactNode {
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
  } = useEventRuleField();

  const displayError = error ? error.message : null;

  return (
    <EntitySelectBox
      id={id}
      entityLabel="Event Rule"
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
