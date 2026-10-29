/**
 * PopoverMultiSelect - Searchable multi-select with popover dropdown
 *
 * WDS-style multi-select: trigger looks like a standard select input,
 * opens a searchable Command popover, selected items shown as badges
 * inside the trigger. Complementary to the existing MultiSelect component
 * (which provides compact/onboarding/default pill variants).
 *
 * Features:
 * - Trigger displays selected items as removable badges or placeholder
 * - Popover opens a searchable Command list with check marks
 * - "+N more" overflow when trigger is collapsed
 * - Optional "Create New" action at the bottom of the dropdown
 * - Loading state support
 * - Accessible with proper ARIA attributes
 */

import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useInfiniteScrollSentinel } from "../hooks/use-infinite-scroll-sentinel";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";

export const ENTITY_MULTI_COMBOBOX_DATA_ATTRS = (opts: {
  widgetType?: string;
  entityType?: string;
}): Record<string, string> => {
  const attrs: Record<string, string> = {
    "data-widget": opts.widgetType ?? "entity-multi-combobox",
  };
  if (opts.entityType) attrs["data-entity"] = opts.entityType;
  return attrs;
};

export interface PopoverMultiSelectOption {
  /** The value to store */
  value: string;
  /** Display label */
  label: string;
  /** Optional description shown in dropdown */
  description?: string;
}

export interface PopoverMultiSelectProps {
  /** Available options */
  options: PopoverMultiSelectOption[];
  /**
   * Lookup-only options used to resolve currently-selected values to badges.
   * When the dropdown's `options` are filtered (e.g. by debounced search),
   * pass the unfiltered set here so badges keep their labels. Defaults to
   * `options`.
   */
  lookupOptions?: PopoverMultiSelectOption[];
  /** Currently selected values */
  value: string[];
  /** Called when selection changes */
  onChange: (value: string[]) => void;
  /** Placeholder when nothing selected */
  placeholder?: string;
  /** Placeholder for the search input in the dropdown */
  searchPlaceholder?: string;
  /** Message when no options match the search */
  emptyMessage?: string;
  /** Disable all interactions */
  disabled?: boolean;
  /** Whether options are currently loading */
  isLoading?: boolean;
  /** Additional class for the wrapper */
  className?: string;
  /** Accessible name */
  "aria-label"?: string;
  /** ARIA invalid state for form validation */
  "aria-invalid"?: boolean;
  /** ARIA describedby for linking error messages */
  "aria-describedby"?: string;
  /** ARIA required — surfaces required state to screen readers (WCAG 3.3.2). */
  "aria-required"?: boolean;
  /** ID for the trigger element (for label association) */
  id?: string;
  /** Callback when "Create New" is clicked */
  onCreateNew?: () => void;
  /** Label for the create new button */
  createNewLabel?: string;
  /** Maximum visible badges in trigger before showing "+N more" */
  maxVisibleBadges?: number;
  /** Audit widget identity for data-widget attr. Defaults to "entity-multi-combobox". */
  widgetType?: string;
  /** Canonical entity type code for data-entity attr (e.g., "PROGRAM"). */
  entityType?: string;

  /**
   * Controlled search input — pair with `onSearchChange`. When set, cmdk's
   * built-in filter is disabled and the caller narrows `options` externally.
   */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function PopoverMultiSelect({
  options,
  lookupOptions,
  value,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  isLoading = false,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-required": ariaRequired,
  id,
  onCreateNew,
  createNewLabel = "Create New",
  maxVisibleBadges = 3,
  widgetType,
  entityType,
  searchValue,
  onSearchChange,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: PopoverMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dataAttrs = ENTITY_MULTI_COMBOBOX_DATA_ATTRS({ widgetType, entityType });
  const setSentinel = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });
  const isControlledSearch = onSearchChange !== undefined;

  // Lookup map covers BOTH visible options and any caller-provided unfiltered
  // set so the trigger keeps showing badges for selections that the current
  // search has filtered out of the dropdown.
  const optionMap = useMemo(() => {
    const map = new Map<string, PopoverMultiSelectOption>();
    for (const opt of lookupOptions ?? options) {
      map.set(opt.value, opt);
    }
    for (const opt of options) {
      map.set(opt.value, opt);
    }
    return map;
  }, [options, lookupOptions]);

  // Cache previously-resolved badges so server-driven search (offer-field)
  // doesn't drop the trigger label when the current haystack no longer
  // contains the selected value.
  const [resolvedById, setResolvedById] = useState<Map<string, PopoverMultiSelectOption>>(
    () => new Map()
  );

  React.useEffect(() => {
    const valueSet = new Set(value);
    setResolvedById((prev) => {
      const next = new Map(prev);
      let changed = false;
      // Add or refresh resolutions for currently-selected ids
      for (const id of valueSet) {
        const found = optionMap.get(id);
        if (found && next.get(id) !== found) {
          next.set(id, found);
          changed = true;
        }
      }
      // Drop ids no longer selected
      for (const id of Array.from(next.keys())) {
        if (!valueSet.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [value, optionMap]);

  const selectedOptions = useMemo(
    () =>
      value
        .map((v) => optionMap.get(v) ?? resolvedById.get(v))
        .filter(Boolean) as PopoverMultiSelectOption[],
    [value, optionMap, resolvedById]
  );

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (value.includes(optionValue)) {
        onChange(value.filter((v) => v !== optionValue));
      } else {
        onChange([...value, optionValue]);
      }
    },
    [value, onChange]
  );

  const handleRemove = useCallback(
    (optionValue: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      onChange(value.filter((v) => v !== optionValue));
    },
    [value, onChange]
  );

  const handleCreateNew = useCallback(() => {
    setOpen(false);
    onCreateNew?.();
  }, [onCreateNew]);

  // Focus management: when popover closes, return focus to trigger
  useEffect(() => {
    if (!open) {
      // Small delay to let the popover close animation finish
      const timer = setTimeout(() => {
        triggerRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const visibleBadges = selectedOptions.slice(0, maxVisibleBadges);
  const overflowCount = selectedOptions.length - maxVisibleBadges;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-required={ariaRequired}
          aria-haspopup="listbox"
          {...dataAttrs}
          disabled={disabled}
          className={cn(
            "border-input-border bg-input ring-offset-background flex min-h-10 w-full items-center justify-between rounded-md border px-3 py-2",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
            {isLoading && options.length === 0 ? (
              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading...
              </span>
            ) : selectedOptions.length === 0 ? (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            ) : (
              <>
                {visibleBadges.map((opt) => (
                  <Badge key={opt.value} variant="secondary" className="gap-1 pr-1 text-xs">
                    {opt.label}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${opt.label}`}
                      className="hover:bg-muted-foreground/20 focus-visible:ring-ring rounded-full p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      onClick={(e) => handleRemove(opt.value, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemove(opt.value);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))}
                {overflowCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    +{overflowCount}
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="text-muted-foreground ml-2 h-4 w-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={!isControlledSearch}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={isControlledSearch ? (searchValue ?? "") : undefined}
            onValueChange={onSearchChange}
          />
          <CommandList>
            {/* While a page (or a search) is loading, "no results" would be premature. */}
            {!isFetchingNextPage && <CommandEmpty>{emptyMessage}</CommandEmpty>}
            <CommandGroup>
              {options.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-muted-foreground group-data-[selected=true]:text-primary-foreground text-xs">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {hasNextPage && (
              <div
                ref={setSentinel}
                data-testid="popover-multi-select-sentinel"
                aria-hidden="true"
                className="h-px"
              />
            )}
            {isFetchingNextPage && (
              <div
                className="text-muted-foreground px-3 py-2 text-xs"
                role="status"
                aria-live="polite"
              >
                Loading more...
              </div>
            )}
            {onCreateNew && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleCreateNew}
                  className="text-primary data-[selected=true]:text-primary-foreground"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createNewLabel}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
