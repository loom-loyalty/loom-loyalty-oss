/**
 * ReadOnlyField
 *
 * Displays a label and a non-editable value. Useful for showing
 * computed or immutable information in a form layout.
 */

import { useId } from "react";

import { Label } from "../primitives/label";

export interface ReadOnlyFieldProps {
  /** Field label */
  label: string;
  /** Display value */
  value: string;
}

/**
 * ReadOnlyField - Non-editable field with label and value.
 *
 * @example
 * ```tsx
 * <ReadOnlyField label="Account ID" value="acct_12345" />
 * ```
 */
export function ReadOnlyField({ label, value }: ReadOnlyFieldProps) {
  const id = useId();

  return (
    <div className="space-y-2">
      <Label id={`${id}-label`} className="text-muted-foreground">
        {label}
      </Label>
      <span className="text-foreground block text-sm" aria-labelledby={`${id}-label`}>
        {value}
      </span>
    </div>
  );
}
