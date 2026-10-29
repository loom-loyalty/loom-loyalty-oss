/**
 * Cancel Customer External Offer Action Component
 *
 * Cancels a previously-issued external offer, referenced by offer id/code, or
 * a specific issued customer-external-offer id (no searchable entity source
 * exists for that id, so it stays a validated text field — same fallback used
 * for Coupon ID in issue-coupon-action.tsx).
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { OfferField } from "../../forms/offer-field/index.js";
import { useOfferField } from "../../forms/offer-field/use-offer-field.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import type { ActionComponentProps, CancelCustomerExternalOfferAction } from "../types";

type CancelExternalOfferData = CancelCustomerExternalOfferAction["cancelCustomerExternalOffer"];

export const CancelCustomerExternalOfferActionComponent = memo(
  function CancelCustomerExternalOfferActionComponent({
    value,
    onChange,
    disabled,
    className,
  }: ActionComponentProps<CancelExternalOfferData>): ReactNode {
    const offerFieldId = useId();
    const externalOfferIdId = useId();
    const { findOffer } = useOfferField();

    const update = useCallback(
      (partial: Partial<CancelExternalOfferData>) => onChange({ ...value, ...partial }),
      [value, onChange]
    );

    const handleOfferChange = useCallback(
      (offerId: string) => {
        const offer = findOffer(offerId);
        update({
          offerId: offerId || undefined,
          offerCode: offer?.code ?? undefined,
        });
      },
      [update, findOffer]
    );

    return (
      <div className={className}>
        <div className="space-y-3">
          <div>
            <Label htmlFor={offerFieldId} className="mb-1.5 block text-xs">
              Offer
            </Label>
            <OfferField
              id={offerFieldId}
              value={value.offerId ?? ""}
              onValueChange={handleOfferChange}
              placeholder="Select offer..."
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor={externalOfferIdId} className="mb-1.5 block text-xs">
              Customer External Offer ID (optional)
            </Label>
            <Input
              id={externalOfferIdId}
              value={value.customerExternalOfferId ?? ""}
              onChange={(e) => update({ customerExternalOfferId: e.target.value || undefined })}
              placeholder="Specific issued offer ID (advanced — usually leave blank)"
              disabled={disabled}
              className="text-xs"
            />
          </div>
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
  }
);
