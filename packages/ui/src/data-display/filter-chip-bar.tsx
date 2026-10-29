"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";

export interface FilterChip {
  /** Unique key */
  key: string;
  /** Display label */
  label: string;
  /** Filter value */
  value: string;
  /** Remove handler */
  onRemove: () => void;
}

export interface AvailableFilter {
  /** Filter key/id */
  key: string;
  /** Filter label */
  label: string;
  /** Available options */
  options: Array<{ value: string; label: string }>;
  /** Current value (null if not active) */
  value: string | null;
  /** Add filter handler */
  onAdd: (value: string) => void;
}

export interface FilterChipBarProps {
  /** Search query value */
  searchValue: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Active filter chips */
  chips: FilterChip[];
  /** Available filters to add */
  availableFilters?: AvailableFilter[];
  /** Additional className */
  className?: string;
}

/**
 * Filter chip bar with inline active filters and add filter popover.
 * Used in minimal/adaptive layouts for compact filtering.
 */
export function FilterChipBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  chips,
  availableFilters = [],
  className,
}: FilterChipBarProps) {
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [selectedFilterKey, setSelectedFilterKey] = useState<string | null>(null);

  const inactiveFilters = availableFilters.filter((f) => f.value === null);
  const selectedFilter = availableFilters.find((f) => f.key === selectedFilterKey);

  const handleAddFilter = (filterKey: string, value: string) => {
    const filter = availableFilters.find((f) => f.key === filterKey);
    if (filter) {
      filter.onAdd(value);
      setSelectedFilterKey(null);
      setAddFilterOpen(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Search Input */}
      <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-none">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9"
          aria-label="Search"
        />
      </div>

      {/* Active Filter Chips */}
      {chips.map((chip) => (
        <div
          key={chip.key}
          className="bg-primary/10 text-primary inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="hover:bg-primary/20 -mr-1 rounded-full p-0.5 transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Add Filter Button */}
      {inactiveFilters.length > 0 && (
        <Popover open={addFilterOpen} onOpenChange={setAddFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            {!selectedFilterKey ? (
              <div className="space-y-1">
                <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                  Select filter type
                </p>
                {inactiveFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className="hover:bg-muted text-foreground w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                    onClick={() => setSelectedFilterKey(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1 text-xs"
                  onClick={() => setSelectedFilterKey(null)}
                >
                  <X className="h-3 w-3" />
                  Back
                </button>
                <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                  {selectedFilter?.label}
                </p>
                {selectedFilter?.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="hover:bg-muted text-foreground w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                    onClick={() => handleAddFilter(selectedFilterKey, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
