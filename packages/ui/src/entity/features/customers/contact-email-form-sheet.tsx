/**
 * ContactEmailFormSheet — Create/edit email address form sheet
 *
 * Uses the FormSheet pattern for creating or editing customer email addresses.
 * Fields: email address (required), type dropdown, primary toggle.
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
import type { ContactEmail } from "./types.js";

export interface ContactEmailFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new email or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<ContactEmail>;
  /** Form submit handler */
  onSubmit: (data: {
    emailAddress: string;
    emailType?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/** Default email type options */
const EMAIL_TYPE_OPTIONS = [
  { value: "PERSONAL", label: "Personal" },
  { value: "WORK", label: "Work" },
  { value: "OTHER", label: "Other" },
];

/**
 * Sheet form for creating or editing a customer email address.
 */
export function ContactEmailFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: ContactEmailFormSheetProps): ReactNode {
  const [emailAddress, setEmailAddress] = useState(initialData?.emailAddress ?? "");
  const [emailType, setEmailType] = useState(initialData?.typeCode ?? "");
  const [isPrimary, setIsPrimary] = useState(initialData?.primary ?? false);

  // Reset form state from initialData (or defaults)
  const resetForm = () => {
    setEmailAddress(initialData?.emailAddress ?? "");
    setEmailType(initialData?.typeCode ?? "");
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
      emailAddress,
      emailType: emailType || undefined,
      isPrimary,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Add Email Address" : "Edit Email Address";
  const submitLabel = mode === "create" ? "Add Email" : "Save Changes";

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
        {/* Email Address */}
        <div className="space-y-2">
          <Label htmlFor="email-address">
            Email Address <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="emailAddress">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="email-address"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="name@example.com"
                required
                disabled={isSubmitting}
                autoComplete="email"
              />
            )}
          </WithFieldError>
        </div>

        {/* Email Type */}
        <div className="space-y-2">
          <Label htmlFor="email-type">Type</Label>
          <WithFieldError field="typeCode" value={emailType}>
            {(fe) => (
              <Select value={emailType} onValueChange={setEmailType} disabled={isSubmitting}>
                <SelectTrigger {...fe.inputProps} id="email-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Categorize this email address (e.g., personal, work).
          </p>
        </div>

        {/* Primary Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="email-primary" className="text-sm font-medium">
              Primary email
            </Label>
            <p className="text-muted-foreground text-xs">
              Mark as the primary email address for this customer
            </p>
          </div>
          <Switch
            id="email-primary"
            checked={isPrimary}
            onCheckedChange={setIsPrimary}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </FormSheet>
  );
}
