/**
 * MultiSelect - Multi-selection input
 *
 * Features:
 * - Three variants: "default" (checkbox grid), "compact" (clickable pills), "onboarding" (refined pills for cards)
 * - Shows selected items as removable badges (default variant)
 * - Supports custom option labels and descriptions
 * - Accessible with proper ARIA attributes
 */

import { Check, Plus, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Checkbox } from "../primitives/checkbox";

export interface MultiSelectOption {
  /** The value to store */
  value: string;
  /** Display label */
  label: string;
  /** Optional description (only shown in default variant) */
  description?: string;
}

export interface MultiSelectProps {
  /** Available options */
  options: MultiSelectOption[];
  /** Currently selected values */
  value: string[];
  /** Called when selection changes */
  onChange: (value: string[]) => void;
  /** Display variant: "default" for checkbox grid, "compact" for clickable pills, "onboarding" for refined card pills */
  variant?: "default" | "compact" | "onboarding";
  /** Placeholder when nothing selected */
  placeholder?: string;
  /** Disable all interactions */
  disabled?: boolean;
  /** Grid columns for options (1, 2, or 3) - only for default variant */
  columns?: 1 | 2 | 3;
  /** Additional class for the wrapper */
  className?: string;
  /** Show selected items as badges above options (only for default variant) */
  showSelectedBadges?: boolean;
  /** Maximum number of selections allowed */
  maxSelections?: number;
  /** Callback when "Create New" is clicked. When provided, shows a create button in the empty state. */
  onCreateNew?: () => void;
  /** Label for the create new button (default: "Create New") */
  createNewLabel?: string;
  /** Whether options are currently loading. Shows a loading state instead of "None available". */
  isLoading?: boolean;
  /** Accessible name for the group */
  "aria-label"?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  variant = "default",
  placeholder = "Select options...",
  disabled = false,
  columns = 2,
  className,
  showSelectedBadges = true,
  maxSelections,
  onCreateNew,
  createNewLabel = "Create New",
  isLoading = false,
  "aria-label": ariaLabel,
}: MultiSelectProps) {
  const handleToggle = (optionValue: string) => {
    if (disabled) return;

    const isSelected = value.includes(optionValue);
    if (isSelected) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      // Check max selections
      if (maxSelections && value.length >= maxSelections) return;
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue: string) => {
    if (disabled) return;
    onChange(value.filter((v) => v !== optionValue));
  };

  const selectedOptions = options.filter((opt) => value.includes(opt.value));
  const isAtMax = maxSelections ? value.length >= maxSelections : false;

  // Loading state shown when options are being fetched
  const loadingState = (
    <div
      className="border-border bg-muted/30 flex items-center rounded-lg border border-dashed px-4 py-3"
      role="group"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      <p className="text-muted-foreground animate-pulse text-sm">{placeholder}</p>
    </div>
  );

  // Shared empty state for all variants when no options are available
  const emptyState = (
    <div
      className="border-border bg-muted/50 flex items-center justify-between rounded-lg border border-dashed px-4 py-3"
      role="group"
      aria-label={ariaLabel}
    >
      <p className="text-muted-foreground text-sm">None available</p>
      {onCreateNew && (
        <button
          type="button"
          onClick={onCreateNew}
          className="text-primary hover:text-primary-dark inline-flex items-center gap-1 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          {createNewLabel}
        </button>
      )}
    </div>
  );

  // Compact variant - clickable pills
  if (variant === "compact") {
    if ((options.length === 0 || isLoading) && !disabled) {
      return (
        <div className={cn("space-y-2", className)}>{isLoading ? loadingState : emptyState}</div>
      );
    }

    return (
      <div className={cn("space-y-2", className)}>
        {/* Clickable pills - no placeholder needed since all options are always visible */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            const isDisabled = disabled || (isAtMax && !isSelected);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleToggle(option.value)}
                disabled={isDisabled}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input-border bg-input text-foreground hover:border-primary/50 hover:bg-primary/5",
                  isDisabled && "cursor-not-allowed opacity-50"
                )}
                aria-pressed={isSelected}
              >
                {isSelected && <Check className="h-3.5 w-3.5" />}
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Max selections hint */}
        {maxSelections && (
          <p className="text-muted-foreground text-xs">
            {value.length} of {maxSelections} selected
          </p>
        )}
      </div>
    );
  }

  // Onboarding variant - refined pills for use on cards (cream/teal palette)
  if (variant === "onboarding") {
    if ((options.length === 0 || isLoading) && !disabled) {
      return (
        <div className={cn("space-y-2", className)}>{isLoading ? loadingState : emptyState}</div>
      );
    }

    return (
      <div className={cn("space-y-2", className)}>
        {/* Placeholder when empty */}
        {value.length === 0 && options.length > 0 && placeholder && (
          <p className="text-muted-foreground text-sm">{placeholder}</p>
        )}

        {/* Refined clickable pills with cream/teal styling */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            const isDisabled = disabled || (isAtMax && !isSelected);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleToggle(option.value)}
                disabled={isDisabled}
                className={cn(
                  // Base styles with refined transitions
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium",
                  "transition-all duration-200 ease-out",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  // Selected state - solid teal with white text
                  isSelected && [
                    "bg-primary text-white",
                    "shadow-primary/25 shadow-md",
                    "hover:bg-primary-dark",
                  ],
                  // Unselected state - darker cream with warm border
                  !isSelected && [
                    "bg-card text-foreground",
                    "border-border border",
                    "hover:bg-primary/10 hover:border-primary/40 hover:text-primary",
                    "shadow-sm",
                  ],
                  // Disabled state
                  isDisabled && "cursor-not-allowed opacity-50"
                )}
                aria-pressed={isSelected}
              >
                {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Max selections hint */}
        {maxSelections && (
          <p className="text-muted-foreground text-xs">
            {value.length} of {maxSelections} selected
          </p>
        )}
      </div>
    );
  }

  // Default variant - checkbox grid
  if ((options.length === 0 || isLoading) && !disabled) {
    return (
      <div className={cn("space-y-3", className)}>{isLoading ? loadingState : emptyState}</div>
    );
  }

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Selected badges */}
      {showSelectedBadges && selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Selected options">
          {selectedOptions.map((opt) => (
            <Badge key={opt.value} variant="secondary" className="gap-1 pr-1" role="listitem">
              {opt.label}
              <button
                type="button"
                onClick={() => handleRemove(opt.value)}
                disabled={disabled}
                className="hover:bg-muted-foreground/20 focus:ring-ring ml-0.5 rounded-full p-0.5 transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:pointer-events-none"
                aria-label={`Remove ${opt.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Placeholder when empty */}
      {value.length === 0 && placeholder && (
        <p className="text-muted-foreground text-sm">{placeholder}</p>
      )}

      {/* Options grid */}
      <div className={cn("grid gap-3", gridCols[columns])} role="group" aria-label={ariaLabel}>
        {options.map((option) => {
          const isSelected = value.includes(option.value);
          const isDisabled = disabled || (isAtMax && !isSelected);

          return (
            <label
              key={option.value}
              className={cn(
                "border-input bg-input flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                isSelected && "border-primary bg-primary/5",
                isDisabled && "cursor-not-allowed opacity-50",
                !isDisabled && "hover:border-primary/50 hover:bg-primary/5"
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(option.value)}
                disabled={isDisabled}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span
                  className={cn(
                    "text-foreground text-sm font-medium",
                    isSelected && "text-primary"
                  )}
                >
                  {option.label}
                </span>
                {option.description && (
                  <p className="text-muted-foreground text-xs">{option.description}</p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {/* Max selections hint */}
      {maxSelections && (
        <p className="text-muted-foreground text-xs">
          {value.length} of {maxSelections} selected
        </p>
      )}
    </div>
  );
}
