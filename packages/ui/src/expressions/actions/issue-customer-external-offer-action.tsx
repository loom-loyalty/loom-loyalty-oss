/**
 * Issue Customer External Offer Action Component
 *
 * Issues an external (non-coupon) offer to the customer, referenced by
 * offer id/code. A partner reward's action names the face value it issues in
 * `partnerDenomination`; it shows read-only, since the "Price it" sheet set it
 * and the partner link decides which amounts exist.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { OfferField } from "../../forms/offer-field/index.js";
import { useOfferField } from "../../forms/offer-field/use-offer-field.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import type { ActionComponentProps, IssueCustomerExternalOfferAction } from "../types";

type IssueExternalOfferData = IssueCustomerExternalOfferAction["issueCustomerExternalOffer"];

export const IssueCustomerExternalOfferActionComponent = memo(
  function IssueCustomerExternalOfferActionComponent({
    value,
    onChange,
    disabled,
    className,
  }: ActionComponentProps<IssueExternalOfferData>): ReactNode {
    const offerFieldId = useId();
    const { findOffer } = useOfferField();
    const partnerDenomination = value.partnerDenomination;

    const update = useCallback(
      (partial: Partial<IssueExternalOfferData>) => onChange({ ...value, ...partial }),
      [value, onChange]
    );

    const handleOfferChange = useCallback(
      (offerId: string) => {
        const offer = findOffer(offerId);
        // The amount belongs to the old offer's partner link, so it doesn't carry over.
        update({
          offerId: offerId || undefined,
          offerCode: offer?.code ?? undefined,
          partnerDenomination: undefined,
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
          {partnerDenomination != null && partnerDenomination !== "" ? (
            <p className="text-muted-foreground text-xs">
              Partner amount:{" "}
              <span className="text-foreground font-mono tabular-nums">
                {String(partnerDenomination)}
              </span>
            </p>
          ) : null}
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
