"use client";

import type { ReactNode } from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useAudienceField } from "./use-audience-field";

export interface AudienceFieldProps {
  /**
   * Current selected value (`customerAudienceId`, or `code` as fallback when the audience has no id).
   * For code-keyed workflows (e.g. campaign action data using `customerAudienceCode`), this component
   * is the wrong layer — use `useAudienceField().filteredAudiences` directly and build code-keyed
   * `EntityOption[]` so the trigger label resolves correctly.
   */
  value: string;
  /** Called when selection changes */
  onValueChange: (audienceId: string) => void;
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

export function AudienceField({
  value,
  onValueChange,
  placeholder = "Select an audience...",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: AudienceFieldProps): ReactNode {
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
  } = useAudienceField();

  const displayError = error ? error.message : null;

  return (
    <EntitySelectBox
      id={id}
      entityLabel="Audience"
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
