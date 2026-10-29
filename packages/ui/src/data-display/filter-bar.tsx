"use client";

import { ChevronDown, Filter, Search, X } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Input } from "../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";

export interface FilterOption {
  /**
   * Unique value for this option. Must be non-empty — options with an empty
   * string value are silently filtered out because Radix Select uses an
   * empty string as a sentinel for "no selection".
   */
  value: string;
  /** Display label */
  label: string;
}

/** Single-select filter rendered as a dropdown. The default filter shape. */
export interface FilterConfig {
  /** Discriminant; omittable for the common single-select case. */
  type?: "single";
  /** Filter key/id */
  key: string;
  /** Placeholder text */
  placeholder: string;
  /** Available options */
  options: FilterOption[];
  /** Current value */
  value: string | null;
  /** Change handler */
  onChange: (value: string | null) => void;
}

/** Multi-select filter rendered as a popover with a checkbox list + count badge. */
export interface MultiFilterConfig {
  type: "multi";
  /** Filter key/id */
  key: string;
  /** Placeholder text shown on the trigger */
  placeholder: string;
  /** Available options */
  options: FilterOption[];
  /** Currently selected values */
  values: string[];
  /** Change handler with the full next selection */
  onChange: (values: string[]) => void;
}

export type AnyFilterConfig = FilterConfig | MultiFilterConfig;

export interface FilterBarProps {
  /** Search query value */
  searchValue: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Filter configurations (single or multi) */
  filters?: AnyFilterConfig[];
  /** Clear all handler */
  onClearAll?: () => void;
  /** Show clear button */
  showClear?: boolean;
  /** Additional className */
  className?: string;
  /** Visual variant - "card" (default) wraps in bg-card container, "inline" has no wrapper */
  variant?: "card" | "inline";
  /** Show vertical separators between filter elements */
  showSeparators?: boolean;
  /** Render the search input. Defaults to true; set false for views with no fulltext backend. */
  showSearch?: boolean;
  /** Optional content rendered at the start of the filter row (e.g. a view switch) */
  leading?: ReactNode;
  /** Optional content rendered at the end of the filter row (e.g. a SavedViewsMenu) */
  trailing?: ReactNode;
}

function isMulti(filter: AnyFilterConfig): filter is MultiFilterConfig {
  return filter.type === "multi";
}

function filterHasValue(filter: AnyFilterConfig): boolean {
  return isMulti(filter)
    ? filter.values.length > 0
    : filter.value !== null && filter.value !== "all";
}

/** Multi-select dropdown: popover trigger styled like a Select + checkbox list. */
function MultiFilterDropdown({ filter }: { filter: MultiFilterConfig }) {
  const count = filter.values.length;
  const selected = new Set(filter.values);

  const toggle = (value: string) => {
    if (selected.has(value)) {
      filter.onChange(filter.values.filter((v) => v !== value));
    } else {
      filter.onChange([...filter.values, value]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={count > 0 ? `${filter.placeholder}, ${count} selected` : filter.placeholder}
          className={cn(
            "border-input-border bg-input flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-xs sm:w-[180px]",
            "focus:border-ring focus:ring-ring/50 focus:ring-[3px] focus:outline-none",
            "data-[state=open]:border-ring"
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Filter className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={cn("line-clamp-1", count === 0 && "text-muted-foreground")}>
              {filter.placeholder}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {count > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                {count}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] p-1">
        <div role="group" aria-label={filter.placeholder} className="max-h-64 overflow-y-auto">
          {filter.options
            .filter((option) => option.value !== "")
            .map((option) => {
              const isChecked = selected.has(option.value);
              return (
                <label
                  key={option.value}
                  className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggle(option.value)}
                    aria-label={option.label}
                  />
                  <span className="line-clamp-1">{option.label}</span>
                </label>
              );
            })}
        </div>
        {count > 0 && (
          <>
            <div className="bg-border my-1 h-px" aria-hidden="true" />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground w-full justify-start"
              onClick={() => filter.onChange([])}
            >
              <X className="mr-2 h-3 w-3" aria-hidden="true" />
              Clear {filter.placeholder.toLowerCase()}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Horizontal filter bar with search input and dropdown filters.
 * Used for filtering data in list views.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  onClearAll,
  showClear = false,
  className,
  variant = "card",
  showSeparators = false,
  showSearch = true,
  leading,
  trailing,
}: FilterBarProps) {
  const hasActiveFilters = (showSearch && searchValue.length > 0) || filters.some(filterHasValue);

  const content = (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      {/* Leading slot (e.g. a Send/Receive view switch) */}
      {leading && (
        <>
          {leading}
          {showSeparators && (
            <div className="border-border hidden h-8 border-l sm:block" aria-hidden="true" />
          )}
        </>
      )}

      {showSearch && (
        <div className="relative w-full sm:w-64 lg:w-80">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search"
          />
          {searchValue.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Filter Dropdowns with optional separators */}
      {filters.map((filter) => (
        <Fragment key={filter.key}>
          {/* Separator before first filter and between filters */}
          {showSeparators && (
            <div className="border-border hidden h-8 border-l sm:block" aria-hidden="true" />
          )}
          {isMulti(filter) ? (
            <MultiFilterDropdown filter={filter} />
          ) : (
            <Select
              value={filter.value || "all"}
              onValueChange={(value) => filter.onChange(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]" aria-label={filter.placeholder}>
                <Filter className="text-muted-foreground mr-2 h-4 w-4" aria-hidden="true" />
                <SelectValue placeholder={filter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.placeholder}</SelectItem>
                {filter.options
                  .filter((option) => option.value !== "")
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </Fragment>
      ))}

      {/* Trailing slot (e.g. SavedViewsMenu) */}
      {trailing && (
        <>
          {showSeparators && (
            <div className="border-border hidden h-8 border-l sm:block" aria-hidden="true" />
          )}
          {trailing}
        </>
      )}

      {/* Clear All Button */}
      {showClear && hasActiveFilters && onClearAll && (
        <>
          {showSeparators && filters.length > 0 && (
            <div className="border-border hidden h-8 border-l sm:block" aria-hidden="true" />
          )}
          <Button variant="outline" onClick={onClearAll} className="shrink-0">
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Clear Filters
          </Button>
        </>
      )}
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <div className="border-card-border bg-muted rounded-lg border p-4 shadow-sm">{content}</div>
  );
}
