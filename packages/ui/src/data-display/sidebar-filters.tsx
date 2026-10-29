"use client";

import { Search, X } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";

export interface FilterGroup {
  /** Unique key */
  key: string;
  /** Group label */
  label: string;
  /** Filter options */
  options: Array<{
    value: string;
    label: string;
    count?: number;
  }>;
  /** Selected values */
  selected: string[];
  /** Change handler */
  onChange: (selected: string[]) => void;
}

export interface SidebarFiltersProps {
  /** Search query value */
  searchValue: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Filter groups */
  groups: FilterGroup[];
  /** Clear all handler */
  onClearAll?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * Vertical sidebar filter panel with checkbox groups.
 * Used in data-dense layouts for desktop filtering.
 */
export function SidebarFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  groups,
  onClearAll,
  className,
}: SidebarFiltersProps) {
  const hasActiveFilters = searchValue.length > 0 || groups.some((g) => g.selected.length > 0);

  const handleCheckboxChange = (group: FilterGroup, value: string, checked: boolean) => {
    if (checked) {
      group.onChange([...group.selected, value]);
    } else {
      group.onChange(group.selected.filter((v) => v !== value));
    }
  };

  return (
    <aside className={cn("space-y-6", className)} role="navigation" aria-label="Filters">
      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="sidebar-search" className="text-xs font-semibold tracking-wide uppercase">
          Search
        </Label>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="sidebar-search"
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filter Groups */}
      {groups.map((group) => (
        <div key={group.key} className="space-y-3">
          <Label className="text-xs font-semibold tracking-wide uppercase">{group.label}</Label>
          <div className="space-y-2">
            {group.options.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${group.key}-${option.value}`}
                  checked={group.selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(group, option.value, checked === true)
                  }
                />
                <Label
                  htmlFor={`${group.key}-${option.value}`}
                  className="text-foreground flex flex-1 cursor-pointer items-center justify-between text-sm font-normal"
                >
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-muted-foreground text-xs">{option.count}</span>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Clear All */}
      {hasActiveFilters && onClearAll && (
        <Button variant="outline" size="sm" onClick={onClearAll} className="w-full">
          <X className="mr-2 h-4 w-4" aria-hidden="true" />
          Clear All Filters
        </Button>
      )}
    </aside>
  );
}
