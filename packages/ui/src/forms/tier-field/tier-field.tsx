// TierField — pre-wired tier selection (EntitySelectBox + useTierField hook).
"use client";

import type { ReactNode } from "react";
import * as React from "react";

import { EntitySelectBox } from "../entity-select-box";
import { useTierField, type TierIdField } from "./use-tier-field";

export interface TierFieldProps {
  /** Current selected value (tierId by default, or tier code when idField="code") */
  value: string;
  /** Called when selection changes */
  onValueChange: (id: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable interactions */
  disabled?: boolean;
  /** Additional className for the select trigger */
  className?: string;
  /** Tier identifier to bind to. Defaults to `tierId`; pass `"code"` for legacy `tierCode` callsites. */
  idField?: TierIdField;
  /** Identifiers to hide from the dropdown (e.g. self-exclusion when editing). */
  excludeIds?: readonly string[];
  /** Render a custom create sheet; when provided, an Add New option appears. */
  renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation */
  "aria-describedby"?: string;
  /** ID for the trigger element */
  id?: string;
}

export function TierField({
  value,
  onValueChange,
  placeholder = "Select a tier...",
  disabled,
  className,
  idField,
  excludeIds,
  renderCreateSheet,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
}: TierFieldProps): ReactNode {
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
  } = useTierField({ idField, excludeIds });

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const displayError = error ? error.message : null;

  return (
    <>
      <EntitySelectBox
        id={id}
        entityLabel="Tier"
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
