/**
 * ContactPhoneFormSheet — Create/edit phone number form sheet
 *
 * Uses the FormSheet pattern for creating or editing customer phone numbers.
 * Fields: phone number (required), country code, type dropdown, primary toggle.
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
import { Switch } from "../../../primitives/switch.js";
import type { ContactPhone } from "./types.js";

export interface ContactPhoneFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new phone or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<ContactPhone>;
  /** Form submit handler */
  onSubmit: (data: {
    phoneNumber: string;
    extension?: string;
    phoneType?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/** Default phone type options */
const PHONE_TYPE_OPTIONS = [
  { value: "MOBILE", label: "Mobile" },
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
  { value: "FAX", label: "Fax" },
  { value: "OTHER", label: "Other" },
];

/**
 * Sheet form for creating or editing a customer phone number.
 */
export function ContactPhoneFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: ContactPhoneFormSheetProps): ReactNode {
  const [phoneNumber, setPhoneNumber] = useState(initialData?.number ?? "");
  const [extension, setExtension] = useState(initialData?.extension ?? "");
  const [phoneType, setPhoneType] = useState(initialData?.typeCode ?? "");
  const [isPrimary, setIsPrimary] = useState(initialData?.primary ?? false);

  // Reset form state from initialData (or defaults)
  const resetForm = () => {
    setPhoneNumber(initialData?.number ?? "");
    setExtension(initialData?.extension ?? "");
    setPhoneType(initialData?.typeCode ?? "");
    setIsPrimary(initialData?.primary ?? false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit({
      phoneNumber,
      extension: extension || undefined,
      phoneType: phoneType || undefined,
      isPrimary,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Add Phone Number" : "Edit Phone Number";
  const submitLabel = mode === "create" ? "Add Phone" : "Save Changes";

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
        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="phone-number">
            Phone Number <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="number">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
                required
                disabled={isSubmitting}
                autoComplete="tel"
              />
            )}
          </WithFieldError>
        </div>

        {/* Extension */}
        <div className="space-y-2">
          <Label htmlFor="phone-extension">Extension</Label>
          <WithFieldError field="extension">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="phone-extension"
                type="text"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                placeholder="1234"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Phone Type */}
        <div className="space-y-2">
          <Label htmlFor="phone-type">Type</Label>
          <WithFieldError field="typeCode" value={phoneType}>
            {(fe) => (
              <Select value={phoneType} onValueChange={setPhoneType} disabled={isSubmitting}>
                <SelectTrigger {...fe.inputProps} id="phone-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Categorize this phone number (e.g., mobile, work).
          </p>
        </div>

        {/* Primary Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="phone-primary" className="text-sm font-medium">
              Primary phone
            </Label>
            <p className="text-muted-foreground text-xs">
              Mark as the primary phone number for this customer
            </p>
          </div>
          <Switch
            id="phone-primary"
            checked={isPrimary}
            onCheckedChange={setIsPrimary}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </FormSheet>
  );
}
