/**
 * PreferenceFormSheet — Create/edit preference form sheet
 *
 * Uses the FormSheet pattern for creating or editing customer preferences.
 * Fields: type (dropdown or text), key (required), value (required).
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
import type { CustomerPreference } from "./types.js";

export interface PreferenceFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new preference or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<CustomerPreference>;
  /** Form submit handler */
  onSubmit: (data: {
    category: string;
    typeCode: string;
    typeName: string;
    value: string;
    valueName: string;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/** Default preference category options */
const PREFERENCE_CATEGORY_OPTIONS = [
  { value: "communication", label: "Communication" },
  { value: "privacy", label: "Privacy" },
  { value: "marketing", label: "Marketing" },
  { value: "notification", label: "Notification" },
  { value: "other", label: "Other" },
];

/**
 * Sheet form for creating or editing a customer preference.
 */
export function PreferenceFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: PreferenceFormSheetProps): ReactNode {
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [typeCode, setTypeCode] = useState(initialData?.typeCode ?? "");
  const [typeName, setTypeName] = useState(initialData?.typeName ?? "");
  const [value, setValue] = useState(initialData?.value ?? "");
  const [valueName, setValueName] = useState(initialData?.valueName ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form state from initialData (or defaults)
  const resetForm = () => {
    setCategory(initialData?.category ?? "");
    setTypeCode(initialData?.typeCode ?? "");
    setTypeName(initialData?.typeName ?? "");
    setValue(initialData?.value ?? "");
    setValueName(initialData?.valueName ?? "");
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
    if (!category) return;
    if (!typeCode.trim() || !typeName.trim() || !value.trim() || !valueName.trim()) {
      setValidationError("All required fields must be filled in.");
      return;
    }
    await onSubmit({
      category,
      typeCode,
      typeName,
      value,
      valueName,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Add Preference" : "Edit Preference";
  const submitLabel = mode === "create" ? "Add Preference" : "Save Changes";

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
        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="pref-category">
            Category <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="groupCode" value={category}>
            {(fe) => (
              <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
                <SelectTrigger {...fe.inputProps} id="pref-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {PREFERENCE_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">Group this preference under a category.</p>
        </div>

        {/* Type Code */}
        <div className="space-y-2">
          <Label htmlFor="pref-type-code">
            Type Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="typeCode">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="pref-type-code"
                type="text"
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
                placeholder="e.g., EMAIL_OPT_IN"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Type Name */}
        <div className="space-y-2">
          <Label htmlFor="pref-type-name">
            Type Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pref-type-name"
            type="text"
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            placeholder="e.g., Email Opt-In"
            required
            disabled={isSubmitting}
          />
          <p className="text-muted-foreground text-xs">
            Human-readable name for this preference type.
          </p>
        </div>

        {/* Value */}
        <div className="space-y-2">
          <Label htmlFor="pref-value">
            Value <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="value">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="pref-value"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g., true"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Value Name */}
        <div className="space-y-2">
          <Label htmlFor="pref-value-name">
            Value Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pref-value-name"
            type="text"
            value={valueName}
            onChange={(e) => setValueName(e.target.value)}
            placeholder="e.g., Opted In"
            required
            disabled={isSubmitting}
          />
          <p className="text-muted-foreground text-xs">
            Human-readable display name for the preference value.
          </p>
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
