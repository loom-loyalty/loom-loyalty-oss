/**
 * EventTypeField — Pre-wired Event Type Selection Component
 *
 * A self-encapsulating component that combines:
 * - EntitySelectBox for the selection UI
 * - useEventTypeField hook for data fetching
 *
 * The SDK entity is "EventTypeConfiguration" but the component presents
 * as "Event Type" in the UX. The value bound to onValueChange is the
 * eventTypeCode (e.g. "PURCHASE"), matching the campaign trigger panel's
 * existing storage semantics.
 */

"use client";

import type { ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useEventTypeField } from "./use-event-type-field";

export interface EventTypeFieldProps {
  /** Current selected value (eventTypeCode, e.g. "PURCHASE") */
  value: string;
  /** Called when selection changes (receives eventTypeCode) */
  onValueChange: (eventTypeCode: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Additional className for the select trigger */
  className?: string;
  /**
   * Called when the "Add New" option is clicked at the bottom of the dropdown.
   * When provided, EntitySelectBox renders an Add New row — a real escape hatch
   * for the empty-org case ("there are zero event types yet"). The campaign
   * builder uses this to send the user to /programs/event-types in a new tab.
   */
  onCreateNew?: () => void;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation */
  "aria-describedby"?: string;
  /** ID for the trigger element */
  id?: string;
}

export function EventTypeField({
  value,
  onValueChange,
  placeholder = "Select an event type...",
  disabled,
  className,
  onCreateNew,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: EventTypeFieldProps): ReactNode {
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
  } = useEventTypeField();

  const displayError = error ? error.message : null;

  return (
    <EntitySelectBox
      id={id}
      entityLabel="Event Type"
      options={options}
      lookupOptions={optionsAll}
      value={value}
      onValueChange={onValueChange}
      onCreateNew={onCreateNew}
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
