/**
 * RecordCouponUseSheet — Form sheet for recording a coupon use action
 *
 * Records a HOLD, USE, or RETURN on a customer coupon. The Platform pairs these by
 * reference ID: a USE converts the hold with the same reference, and a RETURN reverses
 * the hold or use with the same reference. So the sheet only offers actions the
 * Platform will accept, gives every new hold or use a reference, and has USE (from a
 * hold) and RETURN pick the existing entry they act on.
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { formatDateTime } from "@loom-loyalty/core";
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
import {
  getCouponUseActions,
  getOpenCouponUses,
  type CustomerCouponEntry,
  type CustomerCouponUseEntry,
} from "./types.js";

export interface RecordCouponUseSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** The coupon to record a use for */
  coupon: CustomerCouponEntry | null;
  /** Form submit handler */
  onSubmit: (data: {
    status: "HOLD" | "USE" | "RETURN";
    eventDateTime?: string;
    couponUseValue?: number;
    couponUseReferenceId?: string;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

type CouponUseStatus = "HOLD" | "USE" | "RETURN";

const ACTION_LABELS: Record<CouponUseStatus, string> = {
  USE: "Use",
  HOLD: "Hold",
  RETURN: "Return",
};

const ACTION_HELP: Record<CouponUseStatus, string> = {
  USE: "Apply the coupon.",
  HOLD: "Reserve the coupon until it is used or returned.",
  RETURN: "Reverse an earlier hold or use.",
};

/** Target value for a USE that records a new use instead of converting a hold. */
const NEW_USE = "__new__";

/** Generate a reference ID so the new hold or use can be converted or returned later. */
export function generateCouponUseReferenceId(): string {
  return `CARE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function describeUse(use: CustomerCouponUseEntry): string {
  const label = use.status === "HOLD" ? "Hold" : "Use";
  const when = formatDateTime(use.eventDateTime) ?? use.eventDateTime;
  return `${label} · ${use.referenceId ?? ""}${when ? ` · ${when}` : ""}`;
}

/**
 * Sheet form for recording a coupon use action (HOLD, USE, RETURN).
 */
export function RecordCouponUseSheet({
  open,
  onOpenChange,
  coupon,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: RecordCouponUseSheetProps): ReactNode {
  const [status, setStatus] = useState<CouponUseStatus>("USE");
  const [target, setTarget] = useState("");
  const [couponUseValue, setCouponUseValue] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const resetForm = () => {
    setStatus("USE");
    setTarget("");
    setCouponUseValue("");
    setReferenceId("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  if (!coupon) return null;

  const actions = getCouponUseActions(coupon);
  const availableStatuses = (["USE", "HOLD", "RETURN"] as const).filter((s) =>
    s === "USE"
      ? actions.canUse
      : s === "HOLD"
        ? actions.canHold
        : actions.returnableUses.length > 0
  );
  // Fall back to the first available action when the chosen one no longer applies.
  const effectiveStatus = availableStatuses.includes(status) ? status : availableStatuses[0];

  // USE picks a hold to convert (or a new use when a slot is free); RETURN picks what it reverses.
  const targetOptions: { value: string; label: string }[] =
    effectiveStatus === "RETURN"
      ? actions.returnableUses.map((u) => ({ value: u.referenceId ?? "", label: describeUse(u) }))
      : effectiveStatus === "USE" && actions.convertibleHolds.length > 0
        ? [
            ...actions.convertibleHolds.map((u) => ({
              value: u.referenceId ?? "",
              label: `Convert ${describeUse(u)}`,
            })),
            ...(actions.canHold ? [{ value: NEW_USE, label: "New use" }] : []),
          ]
        : [];
  const effectiveTarget = targetOptions.some((o) => o.value === target)
    ? target
    : (targetOptions[0]?.value ?? NEW_USE);
  const recordsNewEntry =
    effectiveStatus === "HOLD" || (effectiveStatus === "USE" && effectiveTarget === NEW_USE);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!effectiveStatus) return;
    await onSubmit({
      status: effectiveStatus,
      eventDateTime: new Date().toISOString(),
      couponUseValue:
        effectiveStatus === "USE" && couponUseValue ? Number(couponUseValue) : undefined,
      couponUseReferenceId: recordsNewEntry
        ? referenceId.trim() || generateCouponUseReferenceId()
        : effectiveTarget,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const maxUses = coupon.maxUses ?? 1;
  const recordedUses = getOpenCouponUses(coupon.uses).length;

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Record Coupon Use"
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitDisabled={!effectiveStatus}
      submitLabel="Record"
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Coupon Info */}
        <section className="bg-muted/50 space-y-2 rounded-lg border p-3">
          <div>
            <p className="text-muted-foreground text-xs">Coupon</p>
            <p className="text-foreground text-sm font-medium">
              {coupon.couponName || coupon.couponCode}
            </p>
            <p className="text-muted-foreground font-mono text-xs">{coupon.couponCode}</p>
          </div>
          {coupon.offerName && (
            <div>
              <p className="text-muted-foreground text-xs">Offer</p>
              <p className="text-foreground text-sm">{coupon.offerName}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground text-xs">Issued</p>
            <p className="text-foreground text-sm">
              <time dateTime={coupon.issuedDateTime}>
                {formatDateTime(coupon.issuedDateTime) ?? coupon.issuedDateTime}
              </time>
            </p>
          </div>
          {(recordedUses > 0 || maxUses > 1) && (
            <div>
              <p className="text-muted-foreground text-xs">Holds and uses</p>
              <p className="text-foreground text-sm">
                {recordedUses} of {maxUses} recorded
              </p>
            </div>
          )}
        </section>

        {!effectiveStatus ? (
          <p className="text-muted-foreground text-sm">
            No hold, use, or return can be recorded for this coupon.
          </p>
        ) : (
          <>
            {/* Use Status */}
            <div className="space-y-2">
              <Label htmlFor="coupon-use-status">
                Action <span className="text-destructive">*</span>
              </Label>
              <WithFieldError field="status" value={effectiveStatus}>
                {(fe) => (
                  <Select
                    value={effectiveStatus}
                    onValueChange={(val) => setStatus(val as CouponUseStatus)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger {...fe.inputProps} id="coupon-use-status">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStatuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ACTION_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </WithFieldError>
              <p className="text-muted-foreground text-xs">{ACTION_HELP[effectiveStatus]}</p>
            </div>

            {/* Existing hold or use this action applies to */}
            {targetOptions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="coupon-use-target">
                  {effectiveStatus === "RETURN" ? "Hold or use to return" : "Apply to"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={effectiveTarget} onValueChange={setTarget} disabled={isSubmitting}>
                  <SelectTrigger id="coupon-use-target">
                    <SelectValue placeholder="Select an entry" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Coupon Use Value */}
            {effectiveStatus === "USE" && (
              <div className="space-y-2">
                <Label htmlFor="coupon-use-value">Discount Value</Label>
                <WithFieldError field="couponUseValue">
                  {(fe) => (
                    <Input
                      {...fe.inputProps}
                      id="coupon-use-value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={couponUseValue}
                      onChange={(e) => setCouponUseValue(e.target.value)}
                      placeholder="e.g., 10.00"
                      disabled={isSubmitting}
                    />
                  )}
                </WithFieldError>
                <p className="text-muted-foreground text-xs">
                  Optional discount amount applied when using this coupon.
                </p>
              </div>
            )}

            {/* Reference ID for a new hold or use */}
            {recordsNewEntry && (
              <div className="space-y-2">
                <Label htmlFor="coupon-use-reference">Reference ID</Label>
                <WithFieldError field="couponUseReferenceId">
                  {(fe) => (
                    <Input
                      {...fe.inputProps}
                      id="coupon-use-reference"
                      value={referenceId}
                      onChange={(e) => setReferenceId(e.target.value)}
                      placeholder="e.g., transaction ID"
                      disabled={isSubmitting}
                    />
                  )}
                </WithFieldError>
                <p className="text-muted-foreground text-xs">
                  Optional. Left blank, one is generated so this{" "}
                  {ACTION_LABELS[effectiveStatus].toLowerCase()} can be returned later.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </FormSheet>
  );
}
