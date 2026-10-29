/**
 * ConsentCheckbox - a native checkbox for an explicit agreement (clickwrap)
 *
 * A real `<input type="checkbox">` rather than the Radix Checkbox, so the consent is
 * an ordinary form control that assistive tech, autofill and browser tests read as one.
 * The whole row is the click target and is at least 44px tall.
 */

import { type ReactNode, useId } from "react";

import { cn } from "../lib/utils";

export interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The statement the user agrees to. Plain text or inline content without interactive elements. */
  children: ReactNode;
  /** Supporting text under the statement, linked as the checkbox's description. */
  description?: ReactNode;
  /** Id of an element elsewhere (such as a list of documents) that also describes the checkbox. */
  describedBy?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function ConsentCheckbox({
  checked,
  onCheckedChange,
  children,
  description,
  describedBy,
  id,
  name,
  disabled = false,
  required = false,
  className,
}: ConsentCheckboxProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const describedByIds = [describedBy, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2.5 text-sm leading-snug",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <input
          id={inputId}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          disabled={disabled}
          required={required}
          aria-describedby={describedByIds}
          className={cn(
            "border-input-border accent-primary mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm",
            "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed"
          )}
        />
        <span className="text-foreground">{children}</span>
      </label>
      {description && (
        <p id={descriptionId} className="text-muted-foreground pl-8 text-xs">
          {description}
        </p>
      )}
    </div>
  );
}
