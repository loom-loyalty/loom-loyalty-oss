/**
 * ContactAddressFormSheet — Create/edit address form sheet
 *
 * Uses the FormSheet pattern for creating or editing customer addresses.
 * Fields: address lines, city, state/province, postal code, country, type, primary toggle.
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
import type { ContactAddress } from "./types.js";

export interface ContactAddressFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new address or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<ContactAddress>;
  /** Form submit handler */
  onSubmit: (data: {
    addressLine1: string;
    addressLine2?: string;
    cityLocality: string;
    stateProvinceRegion: string;
    postalCode: string;
    countryCode: string;
    addressType?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/** Default address type options */
const ADDRESS_TYPE_OPTIONS = [
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
  { value: "BILLING", label: "Billing" },
  { value: "SHIPPING", label: "Shipping" },
  { value: "OTHER", label: "Other" },
];

/**
 * Sheet form for creating or editing a customer address.
 */
export function ContactAddressFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: ContactAddressFormSheetProps): ReactNode {
  const [addressLine1, setAddressLine1] = useState(initialData?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initialData?.addressLine2 ?? "");
  const [cityLocality, setCityLocality] = useState(initialData?.cityLocality ?? "");
  const [stateProvinceRegion, setStateProvinceRegion] = useState(
    initialData?.stateProvinceRegion ?? ""
  );
  const [postalCode, setPostalCode] = useState(initialData?.postalCode ?? "");
  const [countryCode, setCountryCode] = useState(initialData?.countryCode ?? "");
  const [addressType, setAddressType] = useState(initialData?.typeCode ?? "");
  const [isPrimary, setIsPrimary] = useState(initialData?.primary ?? false);

  // Reset form state from initialData (or defaults)
  const resetForm = () => {
    setAddressLine1(initialData?.addressLine1 ?? "");
    setAddressLine2(initialData?.addressLine2 ?? "");
    setCityLocality(initialData?.cityLocality ?? "");
    setStateProvinceRegion(initialData?.stateProvinceRegion ?? "");
    setPostalCode(initialData?.postalCode ?? "");
    setCountryCode(initialData?.countryCode ?? "");
    setAddressType(initialData?.typeCode ?? "");
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
      addressLine1,
      addressLine2: addressLine2 || undefined,
      cityLocality,
      stateProvinceRegion,
      postalCode,
      countryCode,
      addressType: addressType || undefined,
      isPrimary,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Add Address" : "Edit Address";
  const submitLabel = mode === "create" ? "Add Address" : "Save Changes";

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
        {/* Address Line 1 */}
        <div className="space-y-2">
          <Label htmlFor="addr-line1">
            Address Line 1 <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="addressLine1">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="addr-line1"
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="123 Main Street"
                required
                disabled={isSubmitting}
                autoComplete="address-line1"
              />
            )}
          </WithFieldError>
        </div>

        {/* Address Line 2 */}
        <div className="space-y-2">
          <Label htmlFor="addr-line2">Address Line 2</Label>
          <WithFieldError field="addressLine2">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="addr-line2"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apt 4B, Suite 200"
                disabled={isSubmitting}
                autoComplete="address-line2"
              />
            )}
          </WithFieldError>
        </div>

        {/* City / State */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="addr-city">
              City <span className="text-destructive">*</span>
            </Label>
            <WithFieldError field="cityLocality">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="addr-city"
                  type="text"
                  value={cityLocality}
                  onChange={(e) => setCityLocality(e.target.value)}
                  placeholder="San Francisco"
                  required
                  disabled={isSubmitting}
                  autoComplete="address-level2"
                />
              )}
            </WithFieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr-state">
              State / Province <span className="text-destructive">*</span>
            </Label>
            <WithFieldError field="stateProvinceRegion">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="addr-state"
                  type="text"
                  value={stateProvinceRegion}
                  onChange={(e) => setStateProvinceRegion(e.target.value)}
                  placeholder="CA"
                  required
                  disabled={isSubmitting}
                  autoComplete="address-level1"
                />
              )}
            </WithFieldError>
          </div>
        </div>

        {/* Postal Code / Country */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="addr-postal">
              Postal Code <span className="text-destructive">*</span>
            </Label>
            <WithFieldError field="postalCode">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="addr-postal"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="94105"
                  required
                  disabled={isSubmitting}
                  autoComplete="postal-code"
                />
              )}
            </WithFieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr-country">
              Country <span className="text-destructive">*</span>
            </Label>
            <WithFieldError field="countryCode">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="addr-country"
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  placeholder="US"
                  required
                  disabled={isSubmitting}
                  autoComplete="country"
                />
              )}
            </WithFieldError>
          </div>
        </div>

        {/* Address Type */}
        <div className="space-y-2">
          <Label htmlFor="addr-type">Type</Label>
          <WithFieldError field="typeCode" value={addressType}>
            {(fe) => (
              <Select value={addressType} onValueChange={setAddressType} disabled={isSubmitting}>
                <SelectTrigger {...fe.inputProps} id="addr-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
        </div>

        {/* Primary Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="addr-primary" className="text-sm font-medium">
              Primary address
            </Label>
            <p className="text-muted-foreground text-xs">
              Mark as the primary address for this customer
            </p>
          </div>
          <Switch
            id="addr-primary"
            checked={isPrimary}
            onCheckedChange={setIsPrimary}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </FormSheet>
  );
}
