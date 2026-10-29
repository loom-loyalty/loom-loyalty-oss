"use client";

/**
 * CouponFormSheet - Sheet component for creating/editing Coupons
 *
 * Wraps FormSheet with coupon-specific form fields and logic.
 * Uses CodeInput for code auto-generation.
 * Uses OfferField for offer selection.
 * Supports extended fields from data model extensions.
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { DatePicker } from "../../../forms/date-picker.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import { MetadataField } from "../../../forms/metadata-field/index.js";
import { OfferField } from "../../../forms/offer-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import type { CouponFormData, CouponFormSheetProps } from "./types.js";

/** Status options for the coupon */
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

/**
 * Sheet component for creating and editing Coupons.
 */
export function CouponFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  schema,
  extendedFields = [],
}: CouponFormSheetProps): ReactNode {
  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [offerId, setOfferId] = useState(initialData?.offerId ?? "");
  const [offerIdError, setOfferIdError] = useState<string | null>(null);
  const [status, setStatus] = useState(initialData?.status ?? "ACTIVE");
  const [maxRedemptions, setMaxRedemptions] = useState<number | undefined>(
    initialData?.maxRedemptions
  );
  const [discountValue, setDiscountValue] = useState<number | undefined>(
    initialData?.discountValue
  );
  const [discountCurrencyTypeCode, setDiscountCurrencyTypeCode] = useState<string>(
    initialData?.discountCurrencyTypeCode ?? ""
  );
  const [startDateTime, setStartDateTime] = useState<string | undefined>(
    initialData?.startDateTime
  );
  const [endDateTime, setEndDateTime] = useState<string | undefined>(initialData?.endDateTime);

  // Extended fields state
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    if (initialData?.extendedFields) {
      for (const field of extendedFields) {
        const value = initialData.extendedFields[field];
        if (value !== undefined) {
          initial[field] = value;
        }
      }
    }
    return initial;
  });

  // Code auto-generation using useCodeInput hook
  const codeInput = useCodeInput(name, {
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  // Handle extended field changes
  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Reset form when sheet opens/closes or initialData changes
  const resetForm = () => {
    setName(initialData?.name ?? "");
    setOfferId(initialData?.offerId ?? "");
    setOfferIdError(null);
    setStatus(initialData?.status ?? "ACTIVE");
    setMaxRedemptions(initialData?.maxRedemptions);
    setDiscountValue(initialData?.discountValue);
    setDiscountCurrencyTypeCode(initialData?.discountCurrencyTypeCode ?? "");
    setStartDateTime(initialData?.startDateTime);
    setEndDateTime(initialData?.endDateTime);
    codeInput.reset();
    const initial: Record<string, unknown> = {};
    if (initialData?.extendedFields) {
      for (const field of extendedFields) {
        const value = initialData.extendedFields[field];
        if (value !== undefined) {
          initial[field] = value;
        }
      }
    }
    setExtendedFieldValues(initial);
  };

  // Handle open change with form reset
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Handle submit
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!offerId) {
      setOfferIdError("An offer is required.");
      return;
    }

    const formData: CouponFormData = {
      code: codeInput.value,
      name: name || undefined,
      offerId,
      status,
      maxRedemptions,
      discountValue,
      discountCurrencyTypeCode: discountCurrencyTypeCode || undefined,
      startDateTime,
      endDateTime,
      extendedFields: Object.keys(extendedFieldValues).length > 0 ? extendedFieldValues : undefined,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "create"
      ? "Create Coupon"
      : `Edit ${initialData?.name || initialData?.code || "Coupon"}`;
  const submitLabel = mode === "create" ? "Create Coupon" : "Save Changes";

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
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="coupon-name">Name</Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="coupon-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter coupon name"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">Optional display name for the coupon.</p>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="coupon-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                error={fe.error}
                id="coupon-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                format="kebab-case"
                placeholder="coupon-code"
                required
                disabled={isSubmitting || mode === "edit"}
                showReset={mode === "create"}
              />
            )}
          </WithFieldError>
          {mode === "create" && (
            <p className="text-muted-foreground text-xs">
              Auto-generated from name. Edit to customize.
            </p>
          )}
        </div>

        {/* Offer field */}
        <div className="space-y-2">
          <Label htmlFor="coupon-offer">
            Offer <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="offerId" value={offerId}>
            {(fe) => (
              <OfferField
                {...fe.inputProps}
                id="coupon-offer"
                value={offerId}
                onValueChange={(value) => {
                  setOfferId(value);
                  setOfferIdError(null);
                }}
                placeholder="Select an offer..."
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          {offerIdError ? (
            <p className="text-destructive text-xs">{offerIdError}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              The offer this coupon is associated with.
            </p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="coupon-status">
            Status <span className="text-destructive">*</span>
          </Label>
          {initialData?.status === "EXPIRED" && mode === "edit" ? (
            <p className="text-muted-foreground text-sm">
              Expired — status is determined by the end date.
            </p>
          ) : (
            <WithFieldError field="status" value={status}>
              {(fe) => (
                <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                  <SelectTrigger {...fe.inputProps} id="coupon-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </WithFieldError>
          )}
        </div>

        {/* Max Redemptions */}
        <div className="space-y-2">
          <Label htmlFor="coupon-max-redemptions">Max Redemptions</Label>
          <WithFieldError field="maxRedemptions">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="coupon-max-redemptions"
                type="number"
                min={0}
                value={maxRedemptions ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxRedemptions(val ? parseInt(val, 10) : undefined);
                }}
                placeholder="Unlimited"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">Leave empty for unlimited redemptions.</p>
        </div>

        {/* Discount */}
        <div className="space-y-4">
          <h3 className="text-foreground text-sm font-medium">Discount</h3>
          <div className="space-y-2">
            <Label htmlFor="coupon-discount-value">Discount Value</Label>
            <WithFieldError field="discountValue">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="coupon-discount-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountValue ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDiscountValue(val ? Number(val) : undefined);
                  }}
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
            <p className="text-muted-foreground text-xs">
              The discount amount or percentage value, depending on the offer&apos;s discount type.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="coupon-discount-currency-type">Discount Currency Type</Label>
            <WithFieldError field="discountCurrencyTypeCode" value={discountCurrencyTypeCode}>
              {(fe) => (
                <MetadataField
                  {...fe.inputProps}
                  id="coupon-discount-currency-type"
                  typeCode="FIAT_CURRENCY_TYPE"
                  typeLabel="Discount Currency Type"
                  value={discountCurrencyTypeCode}
                  onValueChange={(value) => setDiscountCurrencyTypeCode(value)}
                  placeholder="Select a currency..."
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
            <p className="text-muted-foreground text-xs">
              Currency type for the discount value (e.g., USD, EUR).
            </p>
          </div>
        </div>

        {/* Validity Period */}
        <div className="space-y-4">
          <h3 className="text-foreground text-sm font-medium">Validity Period</h3>
          <div className="space-y-2">
            <Label htmlFor="coupon-start-date">Start Date</Label>
            <WithFieldError field="startDateTime" value={startDateTime}>
              {(fe) => (
                <DatePicker
                  {...fe.inputProps}
                  id="coupon-start-date"
                  value={startDateTime}
                  onChange={(date) => setStartDateTime(date)}
                  placeholder="Select start date..."
                  disabled={isSubmitting}
                  aria-label="Coupon start date"
                />
              )}
            </WithFieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="coupon-end-date">End Date</Label>
            <WithFieldError field="endDateTime" value={endDateTime}>
              {(fe) => (
                <DatePicker
                  {...fe.inputProps}
                  id="coupon-end-date"
                  value={endDateTime}
                  onChange={(date) => setEndDateTime(date)}
                  placeholder="Select end date..."
                  disabled={isSubmitting}
                  aria-label="Coupon end date"
                />
              )}
            </WithFieldError>
          </div>
        </div>

        {/* Extended Fields Section (from data model extensions) */}
        {schema && extendedFields.length > 0 && (
          <ExtendedFieldsSection
            schema={schema}
            fields={extendedFields}
            data={extendedFieldValues}
            mode="edit"
            onChange={handleExtendedFieldChange}
            title="Additional Information"
            defaultCollapsed={false}
          />
        )}
      </div>
    </FormSheet>
  );
}
