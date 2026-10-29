/**
 * MetadataSelectBox
 *
 * A select component that supports:
 * - Search/filter functionality via Command (cmdk)
 * - Fetching metadata from API (via metadataOptions prop)
 * - Displaying "suggested" virtual options that don't exist yet
 * - Visual distinction between real and suggested options
 * - Tracking whether the selected value is virtual (needs creation on save)
 * - Optional "Add New" action for inline creation
 * - Optional category badge display
 *
 * The parent component is responsible for:
 * - Fetching metadata from API and passing as metadataOptions
 * - Creating virtual metadata when the form is saved (if selectedIsSuggested is true)
 * - Handling the "Add New" action if onCreateNew is provided
 */

import { Check, ChevronsUpDown, Lightbulb, Loader2, Plus } from "lucide-react";
import * as React from "react";

import { useInfiniteScrollSentinel } from "../hooks/use-infinite-scroll-sentinel";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";

/**
 * Metadata category types (matches backend MetadataTypeCategory)
 */
export type MetadataCategory = "METADATA" | "DATA_TYPE" | "ITEM" | "LOCATION" | "COUNTRY";

export const METADATA_SELECT_DATA_ATTRS = (opts: {
  metadataTypeCode?: string;
  category?: MetadataCategory;
}): Record<string, string> => {
  const attrs: Record<string, string> = { "data-widget": "metadata-select" };
  if (opts.metadataTypeCode) attrs["data-metadata-type"] = opts.metadataTypeCode;
  if (opts.category) attrs["data-metadata-category"] = opts.category;
  return attrs;
};

/**
 * Category badge colors and labels
 */
const CATEGORY_CONFIG: Record<MetadataCategory, { label: string; className: string }> = {
  METADATA: {
    label: "Metadata",
    className: "bg-category-metadata-bg text-category-metadata-fg",
  },
  DATA_TYPE: {
    label: "Data Type",
    className: "bg-category-data-type-bg text-category-data-type-fg",
  },
  ITEM: {
    label: "Item",
    className: "bg-category-item-bg text-category-item-fg",
  },
  LOCATION: {
    label: "Location",
    className: "bg-category-location-bg text-category-location-fg",
  },
  COUNTRY: {
    label: "Country",
    className: "bg-category-country-bg text-category-country-fg",
  },
};

/**
 * A metadata option that exists in the database
 */
export interface MetadataOption {
  /** Unique code identifier (e.g., "standard", "tiered") */
  code: string;
  /** Display name (e.g., "Standard Points Program") */
  name: string;
  /** Optional description */
  description?: string;
}

/**
 * A suggested option that doesn't exist yet but can be created
 */
export interface SuggestedOption extends MetadataOption {
  /** Mark as suggested (virtual) option */
  isSuggested: true;
  /** Data model code for DATA_TYPE category (e.g., "BADGE" for badge types) */
  dataModelCode?: string;
}

export interface MetadataSelectBoxProps {
  /**
   * Metadata type code (for display purposes)
   * e.g., "PROGRAM_TYPE", "CURRENCY_TYPE"
   */
  metadataTypeCode?: string;

  /**
   * Friendly label for the metadata type
   * e.g., "Program Type", "Currency Type"
   */
  metadataTypeLabel?: string;

  /**
   * Metadata category for badge display
   * When provided, shows a category badge in the trigger
   */
  category?: MetadataCategory;

  /**
   * Existing metadata options fetched from API
   */
  metadataOptions?: MetadataOption[];

  /**
   * Optional superset of options for trigger-label lookup. When controlled
   * search rewrites `metadataOptions` to a narrowed set that no longer
   * includes the currently-selected `value`, the trigger falls back to this
   * list so the label persists. Pass `metadataOptionsAll` from
   * `useMetadataField` to keep the selected name visible across searches.
   */
  lookupOptions?: MetadataOption[];

  /**
   * Suggested (virtual) options that don't exist yet
   * These will be shown with a "Suggested" badge
   */
  suggestedOptions?: SuggestedOption[];

  /**
   * Whether metadata options are currently loading
   */
  isLoading?: boolean;

  /**
   * Error loading metadata options (non-404 errors only).
   * The parent should filter out 404 (type-not-found) errors and instead
   * rely on suggestedOptions as a fallback. When this prop is set, the
   * component shows a disabled error button regardless of suggestedOptions.
   */
  error?: string | null;

  /**
   * Current selected value (code)
   */
  value?: string;

  /**
   * Callback when value changes
   * @param value - The selected code
   * @param isSuggested - Whether the selected option is a suggested (virtual) option
   */
  onValueChange?: (value: string, isSuggested: boolean) => void;

  /**
   * Callback when "Add New" is clicked
   * When provided, shows a "Add New" option at the bottom of the dropdown
   */
  onCreateNew?: () => void;

  /**
   * Placeholder text when no value is selected
   */
  placeholder?: string;

  /**
   * Whether the select is disabled
   */
  disabled?: boolean;

  /**
   * Additional class name for the trigger
   */
  className?: string;

  /**
   * Whether to show descriptions in the dropdown
   * @default true
   */
  showDescriptions?: boolean;

  /**
   * Aria invalid state for form validation
   */
  "aria-invalid"?: boolean;

  /**
   * Aria describedby for form validation
   */
  "aria-describedby"?: string;

  /**
   * ID for the trigger element
   */
  id?: string;

  /**
   * Controlled search input — pair with `onSearchChange`. When set, the
   * component disables cmdk's built-in filter and the caller is responsible
   * for narrowing `metadataOptions` (typically via a debounced query in
   * `useMetadataField`). When omitted, cmdk owns the filter internally and
   * the component behaves as before (back-compat).
   */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Whether more pages remain on the server. */
  hasNextPage?: boolean;
  /** Whether the next page is currently being fetched. */
  isFetchingNextPage?: boolean;
  /** Fired when the bottom-of-list sentinel intersects the viewport. */
  onLoadMore?: () => void;
}

/**
 * MetadataSelectBox - Searchable select component with support for suggested (virtual) options
 *
 * @example
 * ```tsx
 * // With suggested options only (wizard onboarding)
 * <MetadataSelectBox
 *   metadataTypeLabel="Program Type"
 *   suggestedOptions={[
 *     { code: "standard", name: "Standard Points", isSuggested: true },
 *     { code: "tiered", name: "Tiered Loyalty", isSuggested: true },
 *   ]}
 *   value={programType}
 *   onValueChange={(value, isSuggested) => {
 *     setProgramType(value);
 *     setNeedsTypeCreation(isSuggested);
 *   }}
 * />
 *
 * // With API-fetched options + Add New action
 * <MetadataSelectBox
 *   metadataTypeLabel="Program Type"
 *   category="DATA_TYPE"
 *   metadataOptions={apiMetadata}
 *   suggestedOptions={defaultOptions}
 *   isLoading={isLoadingMetadata}
 *   value={programType}
 *   onValueChange={(value, isSuggested) => {
 *     setProgramType(value);
 *     setNeedsTypeCreation(isSuggested);
 *   }}
 *   onCreateNew={() => setShowCreateSheet(true)}
 * />
 * ```
 */
export function MetadataSelectBox({
  metadataTypeCode,
  metadataTypeLabel,
  category,
  metadataOptions = [],
  lookupOptions,
  suggestedOptions = [],
  isLoading = false,
  error,
  value,
  onValueChange,
  onCreateNew,
  placeholder = "Select an option...",
  disabled = false,
  className,
  showDescriptions = true,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
  searchValue,
  onSearchChange,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: MetadataSelectBoxProps) {
  const [open, setOpen] = React.useState(false);
  const setSentinel = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });
  const isControlledSearch = onSearchChange !== undefined;

  // Merge suggested options with metadata options, removing duplicates
  // If an option exists in both, prefer the API version (remove from suggested)
  const existingCodes = new Set(metadataOptions.map((m) => m.code.toUpperCase()));
  // When controlled, also narrow by searchValue — the hook filters
  // metadataOptions but suggestions are passed through whole. cmdk's filter
  // is off in controlled mode, so without this they'd always render.
  const suggestedSearchNeedle = isControlledSearch ? (searchValue ?? "").trim().toLowerCase() : "";
  const filteredSuggested = suggestedOptions
    .filter((s) => !existingCodes.has(s.code.toUpperCase()))
    .filter((s) => {
      if (!suggestedSearchNeedle) return true;
      return (
        s.name.toLowerCase().includes(suggestedSearchNeedle) ||
        s.code.toLowerCase().includes(suggestedSearchNeedle)
      );
    });

  // Cache the last-resolved option keyed by code so the trigger keeps the
  // label when current options cycle past the selection — e.g. when
  // server-search rewrites the loaded set and lookupOptions tracks it.
  // Mirrors `entity-select-box.tsx:225-241`.
  const [lastResolved, setLastResolved] = React.useState<
    MetadataOption | SuggestedOption | undefined
  >();

  // Recompute from source props (stable refs) rather than derived arrays so
  // the memo actually skips work when nothing changed. `existingCodes` /
  // `unfilteredSuggested` above are re-derived inline because they're only
  // used for rendering — keeping them out of the memo's dep set lets it stay
  // tight on the props that actually drive the lookup.
  const currentMatch = React.useMemo<MetadataOption | SuggestedOption | undefined>(() => {
    if (!value) return undefined;
    const lookupSource = lookupOptions ?? metadataOptions;
    const localExistingCodes = new Set(metadataOptions.map((m) => m.code.toUpperCase()));
    const localUnfilteredSuggested = suggestedOptions.filter(
      (s) => !localExistingCodes.has(s.code.toUpperCase())
    );
    return [...lookupSource, ...localUnfilteredSuggested].find((opt) => opt.code === value);
  }, [value, lookupOptions, metadataOptions, suggestedOptions]);

  React.useEffect(() => {
    if (currentMatch) {
      setLastResolved((prev) => (prev?.code === currentMatch.code ? prev : currentMatch));
    } else if (!value || lastResolved?.code !== value) {
      if (lastResolved !== undefined) setLastResolved(undefined);
    }
  }, [value, currentMatch, lastResolved]);

  const selectedOption = currentMatch ?? (lastResolved?.code === value ? lastResolved : undefined);
  const selectedIsSuggested =
    selectedOption !== undefined &&
    "isSuggested" in selectedOption &&
    selectedOption.isSuggested === true;

  const handleSelect = React.useCallback(
    (newValue: string) => {
      // Handle "Add New" special value
      if (newValue === "__create_new__") {
        setOpen(false);
        onCreateNew?.();
        return;
      }

      const isSuggested = filteredSuggested.some((s) => s.code === newValue);
      onValueChange?.(newValue, isSuggested);
      setOpen(false);
    },
    [filteredSuggested, onValueChange, onCreateNew, setOpen]
  );

  const displayLabel = metadataTypeLabel || metadataTypeCode || "option";
  const categoryConfig = category ? CATEGORY_CONFIG[category] : null;
  const dataAttrs = METADATA_SELECT_DATA_ATTRS({ metadataTypeCode, category });

  // Error state — the parent filters out 404s, so any error here is a real failure
  if (error) {
    return (
      <Button
        variant="outline"
        role="combobox"
        disabled
        {...dataAttrs}
        className={cn("text-destructive w-full justify-between", className)}
      >
        Error loading options
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-label={displayLabel}
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          {...dataAttrs}
          disabled={disabled || isLoading}
          className={cn(
            "group hover:bg-primary/80 bg-card w-full justify-between font-normal hover:text-white",
            className
          )}
        >
          {isLoading ? (
            <span className="text-muted-foreground flex items-center gap-2 group-hover:text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : selectedOption ? (
            <span className="flex items-center gap-2 truncate">
              {categoryConfig && (
                <Badge
                  variant="secondary"
                  className={cn("shrink-0 px-1.5 py-0 text-xs", categoryConfig.className)}
                >
                  {categoryConfig.label}
                </Badge>
              )}
              <span className="truncate group-hover:text-white">{selectedOption.name}</span>
              {selectedIsSuggested && (
                <Badge variant="secondary" className="ml-1 shrink-0 px-1.5 py-0 text-xs">
                  New
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground group-hover:text-white/70">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 group-hover:text-white group-hover:opacity-100" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="!bg-card w-[--radix-popover-trigger-width] p-0" align="start">
        <Command className="!bg-card" shouldFilter={!isControlledSearch}>
          <CommandInput
            placeholder={`Search ${displayLabel.toLowerCase()}s...`}
            value={isControlledSearch ? (searchValue ?? "") : undefined}
            onValueChange={onSearchChange}
          />
          <CommandList>
            {/* While a page (or a search) is loading, "no results" would be premature. */}
            {!isFetchingNextPage && (
              <CommandEmpty>No {displayLabel.toLowerCase()} found.</CommandEmpty>
            )}

            {/* Existing metadata options */}
            {metadataOptions.length > 0 && (
              <CommandGroup heading={`Existing ${displayLabel}s`}>
                {metadataOptions.map((option) => (
                  <CommandItem
                    key={option.code}
                    value={`${option.code} ${option.name}`}
                    onSelect={() => handleSelect(option.code)}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === option.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <MetadataOptionContent option={option} showDescription={showDescriptions} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Separator between groups */}
            {metadataOptions.length > 0 && filteredSuggested.length > 0 && <CommandSeparator />}

            {/* Suggested (virtual) options */}
            {filteredSuggested.length > 0 && (
              <CommandGroup
                heading={
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3" />
                    {metadataOptions.length > 0
                      ? "Suggested Templates"
                      : `Suggested ${displayLabel}s`}
                  </span>
                }
              >
                {filteredSuggested.map((option) => (
                  <CommandItem
                    key={option.code}
                    value={`${option.code} ${option.name}`}
                    onSelect={() => handleSelect(option.code)}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === option.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <MetadataOptionContent
                      option={option}
                      showDescription={showDescriptions}
                      isSuggested
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasNextPage && (
              <div
                ref={setSentinel}
                data-testid="metadata-select-sentinel"
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

            {/* Add New option */}
            {onCreateNew && (
              <>
                {(metadataOptions.length > 0 || filteredSuggested.length > 0) && (
                  <CommandSeparator />
                )}
                <CommandGroup>
                  <CommandItem
                    value="__create_new__"
                    onSelect={() => handleSelect("__create_new__")}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add New {displayLabel}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Individual option content with name and optional description
 */
function MetadataOptionContent({
  option,
  showDescription,
  isSuggested,
}: {
  option: MetadataOption | SuggestedOption;
  showDescription: boolean;
  isSuggested?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="flex items-center gap-2">
        <span className="font-medium">{option.name}</span>
        {isSuggested && (
          <Badge
            variant="outline"
            className="text-primary border-primary/30 ml-1 px-1.5 py-0 text-xs"
          >
            New
          </Badge>
        )}
      </span>
      {showDescription && option.description && (
        <span className="text-muted-foreground text-xs group-data-[selected=true]:text-white/70">
          {option.description}
        </span>
      )}
    </div>
  );
}

/**
 * Category badge component for use in create sheets/dialogs
 */
export function CategoryBadge({
  category,
  size = "sm",
}: {
  category: MetadataCategory;
  size?: "sm" | "md";
}) {
  const config = CATEGORY_CONFIG[category];
  return (
    <Badge
      variant="secondary"
      className={cn(
        config.className,
        size === "sm" ? "px-1.5 py-0 text-xs" : "px-2 py-0.5 text-xs"
      )}
    >
      {config.label}
    </Badge>
  );
}

/**
 * Hook to track whether the selected metadata value is suggested (needs creation)
 *
 * @example
 * ```tsx
 * const { value, isSuggested, setValue } = useMetadataSelection("standard", suggestedOptions);
 *
 * // When saving:
 * if (isSuggested) {
 *   await createMetadata({ typeCode: "PROGRAM_TYPE", code: value, name: selectedName });
 * }
 * ```
 */
export function useMetadataSelection(
  initialValue: string | undefined,
  suggestedOptions: SuggestedOption[]
) {
  const [value, setValueInternal] = React.useState(initialValue);
  const [isSuggested, setIsSuggested] = React.useState(() => {
    if (!initialValue) return false;
    return suggestedOptions.some((s) => s.code === initialValue);
  });

  const setValue = React.useCallback((newValue: string, newIsSuggested: boolean) => {
    setValueInternal(newValue);
    setIsSuggested(newIsSuggested);
  }, []);

  // Get the selected option details (for creating metadata on save)
  const selectedOption = React.useMemo(() => {
    if (!value) return undefined;
    return suggestedOptions.find((s) => s.code === value);
  }, [value, suggestedOptions]);

  return {
    value,
    isSuggested,
    setValue,
    selectedOption,
  };
}
