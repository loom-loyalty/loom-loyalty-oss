/**
 * AiVerificationCheckbox
 *
 * Shared attestation control for the AI-output verification gate, rendered
 * identically by RequestEnableDialog and BulkEnableDialog so the two dialogs
 * cannot drift on markup, required-field affordance, touch target size, or
 * the live-region announcement when the gate is satisfied.
 */

import type { ReactNode } from "react";
import { LiveRegion } from "../../a11y/live-region.js";
import { Checkbox } from "../../primitives/checkbox.js";
import { Label } from "../../primitives/label.js";
import { AI_VERIFICATION_COPY } from "./ai-verification.js";

export interface AiVerificationCheckboxProps {
  /** Element id for the checkbox; the Label's htmlFor is derived from it. */
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function AiVerificationCheckbox({
  id,
  checked,
  onCheckedChange,
  disabled,
}: AiVerificationCheckboxProps): ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-11 items-start gap-3 py-2">
        <Checkbox
          id={id}
          className="mt-0.5"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          disabled={disabled}
          required
          aria-required="true"
        />
        <Label htmlFor={id} className="min-h-11 cursor-pointer py-2 font-normal">
          {AI_VERIFICATION_COPY} <span className="text-destructive">*</span>
        </Label>
      </div>
      <LiveRegion
        message={
          checked
            ? "Verification confirmed. You can now submit."
            : "Verification required before you can submit."
        }
      />
    </div>
  );
}
