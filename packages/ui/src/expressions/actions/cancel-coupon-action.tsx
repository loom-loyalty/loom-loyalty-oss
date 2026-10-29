/**
 * Cancel Customer Coupon Action Component
 *
 * Cancels an issued coupon, referenced by coupon id/code or coupon offer
 * id/code. (Distinct from use/hold/return — see coupon-lifecycle-actions.tsx.)
 */

import { memo, useCallback, useId, useState, type ReactNode } from "react";
import { OfferField } from "../../forms/offer-field/index.js";
import { useOfferField } from "../../forms/offer-field/use-offer-field.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { FieldsetLegend } from "../components/fieldset-legend.js";
import { SegmentedSwitch } from "../components/segmented-switch.js";
import type { ActionComponentProps, CancelCustomerCouponAction } from "../types";

type CancelCouponData = CancelCustomerCouponAction["cancelCustomerCoupon"];

export const CancelCouponActionComponent = memo(function CancelCouponActionComponent({
  value,
  onChange,
  disabled,
  className,
}: ActionComponentProps<CancelCouponData>): ReactNode {
  const offerFieldId = useId();
  const couponIdId = useId();
  const couponCodeId = useId();
  const { findOffer } = useOfferField();

  const update = useCallback(
    (partial: Partial<CancelCouponData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  const handleOfferChange = useCallback(
    (offerId: string) => {
      const offer = findOffer(offerId);
      update({
        couponOfferId: offerId || undefined,
        couponOfferCode: offer?.code ?? undefined,
      });
    },
    [update, findOffer]
  );

  // The user's explicit segment choice, not just a derivation of which field
  // is set — otherwise selecting "Coupon code"/"Coupon ID" with an empty field
  // immediately re-derives back to "offer" and that input never gets a chance
  // to render (adversarial review finding).
  const [referenceMode, setReferenceMode] = useState<"offer" | "code" | "id">(() =>
    value.couponOfferId || value.couponOfferCode
      ? "offer"
      : value.couponCode
        ? "code"
        : value.couponId
          ? "id"
          : "offer"
  );

  const handleReferenceModeChange = useCallback(
    (mode: "offer" | "code" | "id") => {
      setReferenceMode(mode);
      if (mode === "offer") update({ couponId: undefined, couponCode: undefined });
      if (mode === "code")
        update({ couponId: undefined, couponOfferId: undefined, couponOfferCode: undefined });
      if (mode === "id")
        update({ couponCode: undefined, couponOfferId: undefined, couponOfferCode: undefined });
    },
    [update]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend>Coupon Reference</FieldsetLegend>
          <p className="text-muted-foreground text-[11px]">Choose one coupon reference.</p>
          <SegmentedSwitch
            value={referenceMode}
            onChange={handleReferenceModeChange}
            options={[
              { value: "offer", label: "Offer" },
              { value: "code", label: "Coupon code" },
              { value: "id", label: "Coupon ID" },
            ]}
            disabled={disabled}
            ariaLabel="Coupon reference type"
          />
          {referenceMode === "id" ? (
            <div>
              <Label htmlFor={couponIdId} className="mb-1.5 block text-xs">
                Coupon ID
              </Label>
              <Input
                id={couponIdId}
                value={value.couponId ?? ""}
                onChange={(e) => update({ couponId: e.target.value || undefined })}
                placeholder="e.g. abcd_0123456789abcdef0123456789abcdef"
                disabled={disabled}
                className="text-xs"
              />
            </div>
          ) : null}
          {referenceMode === "code" ? (
            <div>
              <Label htmlFor={couponCodeId} className="mb-1.5 block text-xs">
                Coupon Code
              </Label>
              <Input
                id={couponCodeId}
                value={value.couponCode ?? ""}
                onChange={(e) => update({ couponCode: e.target.value || undefined })}
                placeholder="Code"
                disabled={disabled}
                className="text-xs"
              />
            </div>
          ) : null}
          {referenceMode === "offer" ? (
            <div>
              <Label htmlFor={offerFieldId} className="mb-1.5 block text-xs">
                Coupon Offer
              </Label>
              <OfferField
                id={offerFieldId}
                value={value.couponOfferId ?? ""}
                onValueChange={handleOfferChange}
                placeholder="Select coupon offer..."
                disabled={disabled}
              />
            </div>
          ) : null}
        </fieldset>

        <div className="bg-card rounded-md p-2">
          <label className="flex items-center gap-2">
            <Switch
              checked={value.synchronous ?? false}
              onCheckedChange={(v) => update({ synchronous: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Synchronous execution</Label>
          </label>
        </div>
      </div>
    </div>
  );
});
