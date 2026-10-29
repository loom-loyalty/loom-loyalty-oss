"use client";

import { useId } from "react";

import { cn } from "../lib/utils";
import { Label } from "../primitives/label";

export interface ToggleFieldProps {
  /** Field label */
  label: string;
  /** Optional description */
  description?: string;
  /** Current value */
  value: boolean;
  /** Change handler */
  onChange: (value: boolean) => void;
  /** Custom labels for options */
  options?: {
    yes?: string;
    no?: string;
  };
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional class name */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    button: "px-3 py-1.5 text-sm",
    gap: "gap-1",
  },
  md: {
    button: "px-4 py-2 text-sm",
    gap: "gap-2",
  },
  lg: {
    button: "px-5 py-2.5 text-base",
    gap: "gap-2",
  },
};

/**
 * Binary choice field with Yes/No buttons (not a switch).
 * Useful for explicit yes/no questions in forms.
 *
 * @example
 * ```tsx
 * <ToggleField
 *   label="Do points expire?"
 *   description="If yes, you'll configure expiration rules"
 *   value={hasExpiration}
 *   onChange={setHasExpiration}
 * />
 *
 * <ToggleField
 *   label="Enable notifications"
 *   value={notifyEnabled}
 *   onChange={setNotifyEnabled}
 *   options={{ yes: "Enable", no: "Disable" }}
 * />
 * ```
 */
export function ToggleField({
  label,
  description,
  value,
  onChange,
  options = {},
  disabled = false,
  error,
  className,
  size = "md",
}: ToggleFieldProps) {
  const id = useId();
  const { yes = "Yes", no = "No" } = options;
  const sizes = sizeClasses[size];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      onChange(!value);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <Label id={`${id}-label`} className={cn(error && "text-destructive")}>
        {label}
      </Label>

      {/* Button Group */}
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-error` : description ? `${id}-desc` : undefined}
        className={cn("inline-flex rounded-lg border p-1", sizes.gap)}
      >
        {/* No Button */}
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => !disabled && onChange(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            "rounded-md font-medium transition-all",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
            sizes.button,
            !value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {no}
        </button>

        {/* Yes Button */}
        <button
          type="button"
          role="radio"
          aria-checked={value}
          onClick={() => !disabled && onChange(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            "rounded-md font-medium transition-all",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
            sizes.button,
            value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {yes}
        </button>
      </div>

      {/* Description */}
      {description && !error && (
        <p id={`${id}-desc`} className="text-muted-foreground text-sm">
          {description}
        </p>
      )}

      {/* Error */}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Inline variant that displays label and toggle on the same row
 */
export interface InlineToggleFieldProps extends ToggleFieldProps {
  /** Reverse order (toggle before label) */
  reverse?: boolean;
}

export function InlineToggleField({
  label,
  description,
  value,
  onChange,
  options = {},
  disabled = false,
  error,
  className,
  size = "md",
  reverse = false,
}: InlineToggleFieldProps) {
  const id = useId();
  const { yes = "Yes", no = "No" } = options;
  const sizes = sizeClasses[size];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      onChange(!value);
    }
  };

  const toggleButtons = (
    <div
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      className={cn("inline-flex rounded-lg border p-1", sizes.gap)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        onClick={() => !disabled && onChange(false)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "rounded-md font-medium transition-all",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          sizes.button,
          !value
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {no}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value}
        onClick={() => !disabled && onChange(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "rounded-md font-medium transition-all",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          sizes.button,
          value
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {yes}
      </button>
    </div>
  );

  const labelContent = (
    <div className="flex-1">
      <Label id={`${id}-label`} className={cn(error && "text-destructive")}>
        {label}
      </Label>
      {description && !error && <p className="text-muted-foreground text-sm">{description}</p>}
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {reverse ? (
        <>
          {toggleButtons}
          {labelContent}
        </>
      ) : (
        <>
          {labelContent}
          {toggleButtons}
        </>
      )}
    </div>
  );
}
