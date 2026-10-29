/**
 * CurrencyInput
 *
 * A number input with a leading currency symbol. Uses a relative-positioned
 * wrapper to overlay the symbol on the left side of the input.
 */

"use client";

import { useCallback, useId } from "react";

import { cn } from "../lib/utils";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";

export interface CurrencyInputProps {
  /** Field label */
  label?: string;
  /** Numeric value */
  value?: number;
  /** Called when the value changes */
  onChange?: (value: number | undefined) => void;
  /** Currency symbol prefix (default: "$") */
  symbol?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Disable interactions */
  disabled?: boolean;
  /** ARIA label */
  "aria-label"?: string;
}

/**
 * CurrencyInput - Number input with a currency symbol prefix.
 *
 * @example
 * ```tsx
 * const [amount, setAmount] = useState<number | undefined>(0);
 *
 * <CurrencyInput
 *   label="Price"
 *   value={amount}
 *   onChange={setAmount}
 *   symbol="$"
 * />
 * ```
 */
export function CurrencyInput({
  label,
  value,
  onChange,
  symbol = "$",
  required = false,
  disabled = false,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  const id = useId();
  const inputId = `${id}-currency`;

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
        <span
          className={cn(
            "text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm",
            disabled && "opacity-50"
          )}
          aria-hidden="true"
        >
          {symbol}
        </span>
        <Input
          id={inputId}
          type="number"
          step={0.01}
          value={value ?? ""}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className="pl-7"
          aria-label={ariaLabel ?? label ?? "Currency amount"}
        />
      </div>
    </div>
  );
}
