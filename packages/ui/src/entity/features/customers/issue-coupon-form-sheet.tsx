/**
 * IssueCouponFormSheet — Form sheet for issuing a coupon to a customer
 *
 * Uses the FormSheet pattern. At least one coupon identifier must be provided.
 * Fields: coupon ID/code, offer ID/code, optional validity period.
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";

export interface IssueCouponFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Form submit handler */
  onSubmit: (data: {
    couponId?: string;
    couponCode?: string;
    couponOfferId?: string;
    couponOfferCode?: string;
    startDateTime?: string;
    endDateTime?: string;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/**
 * Sheet form for issuing a coupon to a customer.
 */
export function IssueCouponFormSheet({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: IssueCouponFormSheetProps): ReactNode {
  const [couponCode, setCouponCode] = useState("");
  const [couponOfferCode, setCouponOfferCode] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");

  const resetForm = () => {
    setCouponCode("");
    setCouponOfferCode("");
    setStartDateTime("");
    setEndDateTime("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const hasIdentifier = couponCode.length > 0 || couponOfferCode.length > 0;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasIdentifier) return;
    await onSubmit({
      couponCode: couponCode || undefined,
      couponOfferCode: couponOfferCode || undefined,
      startDateTime: startDateTime ? new Date(startDateTime).toISOString() : undefined,
      endDateTime: endDateTime ? new Date(endDateTime).toISOString() : undefined,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Issue Coupon"
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel="Issue Coupon"
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Coupon Code */}
        <div className="space-y-2">
          <Label htmlFor="coupon-code">Coupon Code</Label>
          <WithFieldError field="couponCode">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="coupon-code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Enter a specific coupon code"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">Issue a specific coupon by its code.</p>
        </div>

        {/* Coupon Offer Code */}
        <div className="space-y-2">
          <Label htmlFor="coupon-offer-code">Coupon Offer Code</Label>
          <WithFieldError field="couponOfferCode">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="coupon-offer-code"
                value={couponOfferCode}
                onChange={(e) => setCouponOfferCode(e.target.value)}
                placeholder="Enter offer code for random assignment"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Randomly assign a coupon from an offer pool.
          </p>
        </div>

        {!hasIdentifier && (
          <div
            className="border-destructive/30 bg-destructive/5 rounded-lg border p-3"
            role="alert"
          >
            <p className="text-destructive text-sm">
              At least one identifier is required: coupon code or offer code.
            </p>
          </div>
        )}

        {/* Start DateTime */}
        <div className="space-y-2">
          <Label htmlFor="coupon-start-datetime">Start Date</Label>
          <WithFieldError field="dateTimePeriod.startDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="coupon-start-datetime"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Optional. Override the coupon&apos;s default start date.
          </p>
        </div>

        {/* End DateTime */}
        <div className="space-y-2">
          <Label htmlFor="coupon-end-datetime">End Date</Label>
          <WithFieldError field="dateTimePeriod.endDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="coupon-end-datetime"
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Optional. Override the coupon&apos;s default expiration.
          </p>
        </div>
      </div>
    </FormSheet>
  );
}
