/**
 * PercentageInput
 *
 * A number input with a trailing "%" suffix. Uses a relative-positioned
 * wrapper to overlay the percentage sign on the right side of the input.
 */

"use client";

import { useCallback, useId } from "react";

import { cn } from "../lib/utils";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";

export interface PercentageInputProps {
  /** Field label */
  label?: string;
  /** Numeric value (0–100) */
  value?: number;
  /** Called when the value changes */
  onChange?: (value: number | undefined) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Disable interactions */
  disabled?: boolean;
  /** ARIA label */
  "aria-label"?: string;
}

/**
 * PercentageInput - Number input with a trailing percentage sign.
 *
 * @example
 * ```tsx
 * const [rate, setRate] = useState<number | undefined>(10);
 *
 * <PercentageInput
 *   label="Discount Rate"
 *   value={rate}
 *   onChange={setRate}
 * />
 * ```
 */
export function PercentageInput({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  "aria-label": ariaLabel,
}: PercentageInputProps) {
  const id = useId();
  const inputId = `${id}-percentage`;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      onChange?.(raw === "" ? undefined : Number(raw));
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}

      <div className="relative">
        <Input
          id={inputId}
          type="number"
          min={0}
          max={100}
          step={1}
          value={value ?? ""}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className="pr-8"
          aria-label={ariaLabel ?? label ?? "Percentage"}
        />
        <span
          className={cn(
            "text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm",
            disabled && "opacity-50"
          )}
          aria-hidden="true"
        >
          %
        </span>
      </div>
    </div>
  );
}
