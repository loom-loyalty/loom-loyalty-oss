/**
 * IdentifierFormSheet — Create/edit customer identifier form sheet
 *
 * Uses the FormSheet pattern for creating or editing customer identifiers.
 * Fields: identifier value (required, monospace), type code (required), status (ACTIVE/INACTIVE).
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import type { CustomerIdentifier } from "./types.js";

export interface IdentifierFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new identifier or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<CustomerIdentifier>;
  /** Form submit handler */
  onSubmit: (data: {
    identifier: string;
    typeCode: string;
    status: "ACTIVE" | "INACTIVE";
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/** Status options for identifiers */
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

/**
 * Sheet form for creating or editing a customer identifier.
 */
export function IdentifierFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: IdentifierFormSheetProps): ReactNode {
  const [identifier, setIdentifier] = useState(initialData?.value ?? "");
  const [typeCode, setTypeCode] = useState(initialData?.typeCode ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(initialData?.status ?? "ACTIVE");
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setIdentifier(initialData?.value ?? "");
    setTypeCode(initialData?.typeCode ?? "");
    setStatus(initialData?.status ?? "ACTIVE");
    setValidationError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);
    if (!identifier.trim() || !typeCode.trim()) {
      setValidationError("Identifier value and type code are required.");
      return;
    }
    await onSubmit({ identifier: identifier.trim(), typeCode: typeCode.trim(), status });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Add Identifier" : "Edit Identifier";
  const submitLabel = mode === "create" ? "Add Identifier" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Identifier Value */}
        <div className="space-y-2">
          <Label htmlFor="identifier-value">
            Identifier Value{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <WithFieldError field="identifier">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="identifier-value"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g., EXT-12345"
                required
                disabled={isSubmitting}
                className="font-mono"
                aria-describedby={
                  fe.error ? `${fe.errorId} identifier-value-hint` : "identifier-value-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="identifier-value-hint" className="text-muted-foreground text-xs">
            The unique identifier value for this customer.
          </p>
        </div>

        {/* Type Code */}
        <div className="space-y-2">
          <Label htmlFor="identifier-type-code">
            Type Code{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <WithFieldError field="typeCode">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="identifier-type-code"
                type="text"
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
                placeholder="e.g., EXTERNAL_ID"
                required
                disabled={isSubmitting}
                aria-describedby={
                  fe.error ? `${fe.errorId} identifier-type-code-hint` : "identifier-type-code-hint"
                }
              />
            )}
          </WithFieldError>
          <p id="identifier-type-code-hint" className="text-muted-foreground text-xs">
            The type classification for this identifier.
          </p>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="identifier-status">Status</Label>
          <WithFieldError field="status" value={status}>
            {(fe) => (
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as "ACTIVE" | "INACTIVE")}
                disabled={isSubmitting}
              >
                <SelectTrigger {...fe.inputProps} id="identifier-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
        </div>

        {validationError && (
          <div
            className="border-destructive/30 bg-destructive/5 rounded-lg border p-3"
            role="alert"
          >
            <p className="text-destructive text-xs">{validationError}</p>
          </div>
        )}
      </div>
    </FormSheet>
  );
}
