/**
 * OfferField - Pre-wired Offer Selection Component
 *
 * A self-encapsulating component that combines:
 * - EntitySelectBox for the selection UI
 * - useOfferField hook for data fetching
 */

"use client";

import type { ReactNode } from "react";

import { EntitySelectBox, type EntityCreateOption, type EntityOption } from "../entity-select-box";
import { useOfferField } from "./use-offer-field";

export interface OfferFieldProps {
  /** Current selected value (offerId) */
  value: string;
  /** Called when selection changes */
  onValueChange: (offerId: string) => void;
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
  /** Several "+ New …" choices; see EntitySelectBox. */
  createOptions?: EntityCreateOption[];
  /** Called with the picked create option's key. */
  onCreateOption?: (key: string) => void;
  /** Marks the selection as an untouched suggestion. */
  suggested?: boolean;
  /** A record just created from "+ New …"; see EntitySelectBox. */
  createdOption?: EntityOption;
}

export function OfferField({
  value,
  onValueChange,
  placeholder = "Select an offer...",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
  createOptions,
  onCreateOption,
  suggested,
  createdOption,
}: OfferFieldProps): ReactNode {
  const {
    options,
    isLoading,
    error,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useOfferField();

  const displayError = error ? error.message : null;

  return (
    <EntitySelectBox
      id={id}
      entityLabel="Offer"
      options={options}
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
      createOptions={createOptions}
      onCreateOption={onCreateOption}
      suggested={suggested}
      createdOption={createdOption}
    />
  );
}
