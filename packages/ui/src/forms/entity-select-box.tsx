/**
 * EntitySelectBox
 *
 * A select component for entity selection (Partners, Programs, etc.)
 * Simpler variant of MetadataSelectBox without suggested options or category badges.
 *
 * Supports:
 * - Search/filter functionality via Command (cmdk)
 * - Displaying entity options fetched from API
 * - Optional "Add New" action for inline creation
 * - Loading and error states
 *
 * The parent component is responsible for:
 * - Fetching entities from API and passing as options
 * - Handling the "Add New" action if onCreateNew is provided
 */

import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import * as React from "react";

import { useInfiniteScrollSentinel } from "../hooks/use-infinite-scroll-sentinel";
import { cn } from "../lib/utils";
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

export const ENTITY_COMBOBOX_DATA_ATTRS = (opts: {
  widgetType?: string;
  entityType: string;
  metadataCategory?: string;
}): Record<string, string> => {
  const attrs: Record<string, string> = {
    "data-widget": opts.widgetType ?? "entity-combobox",
    "data-entity": opts.entityType,
  };
  if (opts.metadataCategory) attrs["data-metadata-category"] = opts.metadataCategory;
  return attrs;
};

/**
 * An entity option to display in the select
 */
export interface EntityOption {
  /** Unique identifier (e.g., partnerId, programId) */
  id: string;
  /** Display name */
  name: string;
  /** Optional secondary text (e.g., code, type) */
  secondaryText?: string;
}

export interface EntitySelectBoxProps {
  /**
   * Friendly label for the entity type (e.g., "Partner", "Program")
   */
  entityLabel: string;

  /**
   * Entity options fetched from API
   */
  options?: EntityOption[];

  /**
   * Lookup-only options used to resolve the selected `value` to a label. When
   * the dropdown's `options` are filtered (e.g. by debounced search), pass
   * the unfiltered set here so the trigger keeps showing the selected entity.
   * Defaults to `options`.
   */
  lookupOptions?: EntityOption[];

  /**
   * Whether options are currently loading
   */
  isLoading?: boolean;

  /**
   * Error loading options
   */
  error?: string | null;

  /**
   * Current selected value (entity ID)
   */
  value?: string;

  /**
   * Callback when value changes
   * @param id - The selected entity ID
   */
  onValueChange?: (id: string) => void;

  /**
   * Callback when "Add New" is clicked
   * When provided, shows an "Add New" option at the bottom of the dropdown
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
   * Aria invalid state for form validation
   */
  "aria-invalid"?: boolean;

  /**
   * Aria describedby for form validation
   */
  "aria-describedby"?: string;

  /**
   * Aria required signal — surfaces "required" state to screen readers on
   * the combobox trigger so it parities a plain `<input required>`.
   */
  "aria-required"?: boolean;

  /**
   * ID(s) of the element(s) labelling the trigger. When set (or when a `<label for={id}>`
   * is associated), the fallback `aria-label` is omitted so the visible label wins.
   */
  "aria-labelledby"?: string;

  /**
   * ID for the trigger element
   */
  id?: string;

  /** Audit widget identity for data-widget attr. Defaults to "entity-combobox". */
  widgetType?: string;
  /** Canonical entity type code for data-entity attr. Defaults to entityLabel uppercased. */
  entityType?: string;
  /** Metadata category to surface as data-metadata-category (used by MetadataTypeField). */
  metadataCategory?: string;

  /**
   * Controlled search input — pair with `onSearchChange`. When set, the component
   * disables cmdk's built-in filter and the caller is responsible for narrowing
   * `options` (typically via a debounced query in a wrapper hook).
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
 * EntitySelectBox - Searchable select for entity selection
 *
 * @example
 * ```tsx
 * <EntitySelectBox
 *   entityLabel="Partner"
 *   options={partners.map(p => ({ id: p.partnerId, name: p.name, secondaryText: p.code }))}
 *   value={selectedPartnerId}
 *   onValueChange={setSelectedPartnerId}
 *   onCreateNew={() => setCreateOpen(true)}
 *   isLoading={isLoadingPartners}
 *   placeholder="Select a partner..."
 * />
 * ```
 */
export function EntitySelectBox({
  entityLabel,
  options = [],
  lookupOptions,
  isLoading = false,
  error,
  value,
  onValueChange,
  onCreateNew,
  placeholder = "Select an option...",
  disabled = false,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-required": ariaRequired,
  "aria-labelledby": ariaLabelledBy,
  id,
  widgetType = "entity-combobox",
  entityType,
  metadataCategory,
  searchValue,
  onSearchChange,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: EntitySelectBoxProps) {
  const [open, setOpen] = React.useState(false);

  const dataEntity = entityType ?? entityLabel.toUpperCase().replace(/\s+/g, "_");
  const dataAttrs = ENTITY_COMBOBOX_DATA_ATTRS({
    widgetType,
    entityType: dataEntity,
    metadataCategory,
  });

  const setSentinel = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });
  const isControlledSearch = onSearchChange !== undefined;

  // Cache the last-resolved option keyed by value so the trigger keeps the
  // label when the current haystack no longer contains the selection — e.g.
  // when search rewrites the query (offer-field) or when filtered options
  // shrink (client-side filter wrappers without lookupOptions).
  const [lastResolved, setLastResolved] = React.useState<EntityOption | undefined>();

  const currentMatch = React.useMemo(() => {
    if (!value) return undefined;
    const haystack = lookupOptions ?? options;
    return haystack.find((opt) => opt.id === value);
  }, [lookupOptions, options, value]);

  React.useEffect(() => {
    if (currentMatch) {
      setLastResolved((prev) => (prev?.id === currentMatch.id ? prev : currentMatch));
    } else if (!value || lastResolved?.id !== value) {
      if (lastResolved !== undefined) setLastResolved(undefined);
    }
  }, [value, currentMatch, lastResolved]);

  const selectedOption = currentMatch ?? (lastResolved?.id === value ? lastResolved : undefined);

  const handleSelect = React.useCallback(
    (newValue: string) => {
      if (newValue === "__create_new__") {
        setOpen(false);
        onCreateNew?.();
        return;
      }

      onValueChange?.(newValue);
      setOpen(false);
    },
    [onValueChange, onCreateNew]
  );

  // A trigger with an associated <label for={id}> (or aria-labelledby) must take its
  // accessible name from that visible label; aria-label would override it. `labels`
  // can only be read after mount, so detect it in a layout effect.
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [hasAssociatedLabel, setHasAssociatedLabel] = React.useState(false);
  React.useLayoutEffect(() => {
    setHasAssociatedLabel((triggerRef.current?.labels?.length ?? 0) > 0);
  }, [id, error]);
  const hasVisibleLabel = Boolean(ariaLabelledBy) || hasAssociatedLabel;

  if (error) {
    return (
      <div className="space-y-1.5">
        <Button
          variant="outline"
          role="combobox"
          disabled
          {...dataAttrs}
          className={cn("text-destructive w-full justify-between", className)}
        >
          Failed to load {entityLabel.toLowerCase()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={id}
          variant="outline"
          role="combobox"
          aria-labelledby={ariaLabelledBy}
          aria-label={hasVisibleLabel ? undefined : `Select ${entityLabel.toLowerCase()}`}
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-required={ariaRequired}
          {...dataAttrs}
          disabled={disabled || (isLoading && !selectedOption)}
          className={cn(
            "group hover:bg-primary/80 bg-card w-full justify-between font-normal hover:text-white",
            className
          )}
        >
          {selectedOption ? (
            <span className="flex items-center gap-2 truncate">
              <span className="truncate group-hover:text-white">{selectedOption.name}</span>
              {selectedOption.secondaryText && (
                <span className="text-muted-foreground truncate text-xs group-hover:text-white/70">
                  ({selectedOption.secondaryText})
                </span>
              )}
            </span>
          ) : isLoading ? (
            <span className="text-muted-foreground flex items-center gap-2 group-hover:text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
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
            placeholder={`Search ${entityLabel.toLowerCase()}s...`}
            value={isControlledSearch ? (searchValue ?? "") : undefined}
            onValueChange={onSearchChange}
          />
          <CommandList>
            {/* While a page (or a search) is loading, "no results" would be premature. */}
            {!isFetchingNextPage && (
              <CommandEmpty>No {entityLabel.toLowerCase()} found.</CommandEmpty>
            )}

            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.id} ${option.name} ${option.secondaryText ?? ""}`}
                    onSelect={() => handleSelect(option.id)}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === option.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-medium">{option.name}</span>
                      {option.secondaryText && (
                        <span className="text-muted-foreground text-xs group-data-[selected=true]:text-white/70">
                          {option.secondaryText}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasNextPage && (
              <div
                ref={setSentinel}
                data-testid="entity-select-sentinel"
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
                {options.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    value="__create_new__"
                    onSelect={() => handleSelect("__create_new__")}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add New {entityLabel}</span>
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
