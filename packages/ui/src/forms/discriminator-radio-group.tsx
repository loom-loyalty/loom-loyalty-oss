import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { Label } from "../primitives/label.js";
import { RadioGroup, RadioGroupItem } from "../primitives/radio-group.js";

export interface DiscriminatorRadioGroupOption {
  value: string;
  label: string;
  description?: string;
}

export interface DiscriminatorRadioGroupProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: DiscriminatorRadioGroupOption[];
  disabled?: boolean;
  className?: string;
  "aria-labelledby"?: string;
  /** Server field error wiring, from `WithFieldError`'s `inputProps`. */
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "data-field"?: string;
}

/**
 * A controlled radio group for fields that select a form's discriminator.
 * The caller owns the visible field label and associates it with the group.
 */
export function DiscriminatorRadioGroup({
  id,
  value,
  onValueChange,
  options,
  disabled = false,
  className,
  "aria-labelledby": ariaLabelledby,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
  "data-field": dataField,
}: DiscriminatorRadioGroupProps): ReactNode {
  return (
    <RadioGroup
      id={id}
      data-widget="radio-group"
      data-discriminator="true"
      aria-labelledby={ariaLabelledby}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      data-field={dataField}
      // Focusable only while invalid, so the form can move focus to its error.
      tabIndex={ariaInvalid ? -1 : undefined}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className={cn("gap-2", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const optionId = `${id}-${option.value}`;

        return (
          <Label
            key={option.value}
            htmlFor={optionId}
            className={cn(
              "flex items-start gap-3 rounded-md border p-3 text-sm transition-colors",
              selected
                ? "border-primary bg-primary/10 text-foreground border-[1.5px] font-medium"
                : "border-border text-muted-foreground hover:border-primary/40",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            )}
          >
            <RadioGroupItem
              id={optionId}
              value={option.value}
              disabled={disabled}
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="block">{option.label}</span>
              {option.description ? (
                <span className="text-muted-foreground mt-1 block text-xs font-normal">
                  {option.description}
                </span>
              ) : null}
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
