// CustomerAudienceField — pre-wired customer-audience selection compound.

"use client";

import type { ReactNode } from "react";
import * as React from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useCustomerAudienceField } from "./use-customer-audience-field";

export interface CustomerAudienceFieldProps {
  /** Selected value (customerAudienceId, or code as fallback). */
  value: string;
  /** Called when selection changes */
  onValueChange: (customerAudienceId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Additional className for the select trigger */
  className?: string;
  /** Render a custom create sheet; an "Add New" option appears in the dropdown when set. */
  renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation */
  "aria-describedby"?: string;
  /** ID for the trigger element */
  id?: string;
}

export function CustomerAudienceField({
  value,
  onValueChange,
  placeholder = "Select a customer audience...",
  disabled,
  className,
  renderCreateSheet,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: CustomerAudienceFieldProps): ReactNode {
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
  } = useCustomerAudienceField();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const displayError = error ? error.message : null;

  return (
    <>
      <EntitySelectBox
        id={id}
        entityLabel="Customer Audience"
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
