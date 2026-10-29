/**
 * Add Customer To Audience Action Component
 *
 * Adds the customer to a customer audience, referenced by id/code.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { CustomerAudienceField } from "../../forms/customer-audience-field/index.js";
import { useCustomerAudienceField } from "../../forms/customer-audience-field/use-customer-audience-field.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import type { ActionComponentProps, AddCustomerToAudienceAction } from "../types";

type AddCustomerToAudienceData = AddCustomerToAudienceAction["addCustomerToAudience"];

export const AddCustomerToAudienceActionComponent = memo(
  function AddCustomerToAudienceActionComponent({
    value,
    onChange,
    disabled,
    className,
  }: ActionComponentProps<AddCustomerToAudienceData>): ReactNode {
    const fieldId = useId();
    const { findCustomerAudience } = useCustomerAudienceField();

    const update = useCallback(
      (partial: Partial<AddCustomerToAudienceData>) => onChange({ ...value, ...partial }),
      [value, onChange]
    );

    const handleAudienceChange = useCallback(
      (customerAudienceId: string) => {
        const audience = findCustomerAudience(customerAudienceId);
        update({
          customerAudienceId: customerAudienceId || undefined,
          customerAudienceCode: audience?.code ?? undefined,
        });
      },
      [update, findCustomerAudience]
    );

    return (
      <div className={className}>
        <div className="space-y-3">
          <div>
            <Label htmlFor={fieldId} className="mb-1.5 block text-xs">
              Audience
            </Label>
            <CustomerAudienceField
              id={fieldId}
              value={value.customerAudienceId ?? ""}
              onValueChange={handleAudienceChange}
              placeholder="Select audience..."
              disabled={disabled}
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
