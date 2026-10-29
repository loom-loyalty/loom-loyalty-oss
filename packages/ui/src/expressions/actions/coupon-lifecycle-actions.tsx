/**
 * Coupon Lifecycle Actions Component
 *
 * Shared editor for use / hold / return coupon actions. These resolve the
 * coupon by code — `defaultResult` is the coupon code string (falls back when
 * `path` yields nothing) — and carry optional reference/value/discount
 * path-or-literal pairs. (Cancel is a distinct action; see
 * cancel-coupon-action.tsx.)
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { FieldsetLegend } from "../components/fieldset-legend.js";
import { PathOrValueField } from "../inputs/path-or-value-field.js";
import type {
  ActionComponentProps,
  HoldCustomerCouponAction,
  ReturnCustomerCouponAction,
  UseCustomerCouponAction,
} from "../types";

type CouponLifecycleData =
  | UseCustomerCouponAction["useCustomerCoupon"]
  | HoldCustomerCouponAction["holdCustomerCoupon"]
  | ReturnCustomerCouponAction["returnCustomerCoupon"];

export const CouponLifecycleActionComponent = memo(function CouponLifecycleActionComponent({
  value,
  onChange,
  disabled,
  className,
  presentation = "card",
}: ActionComponentProps<CouponLifecycleData>): ReactNode {
  const couponCodeId = useId();
  const referenceIdValueId = useId();
  const useValueId = useId();
  const discountCurrencyCodeId = useId();

  const update = useCallback(
    (partial: Partial<CouponLifecycleData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <PathOrValueField
          path={value.path}
          value={value.defaultResult}
          onPathChange={(path) => update({ path })}
          label="Coupon reference"
          pathLabel="Coupon path"
          disabled={disabled}
          presentation={presentation}
        >
          <div>
            <Label htmlFor={couponCodeId} className="mb-1.5 block text-xs">
              Coupon Code
            </Label>
            <Input
              id={couponCodeId}
              value={value.defaultResult ?? ""}
              onChange={(e) => update({ defaultResult: e.target.value || undefined })}
              placeholder="Coupon code"
              disabled={disabled}
              className="text-xs"
            />
          </div>
        </PathOrValueField>

        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend>Reference & Value (optional)</FieldsetLegend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PathOrValueField
              path={value.couponUseReferenceIdPath}
              value={value.couponUseReferenceIdValue}
              onPathChange={(couponUseReferenceIdPath) => update({ couponUseReferenceIdPath })}
              label="Reference ID"
              pathLabel="Reference ID path"
              disabled={disabled}
              presentation={presentation}
            >
              <div>
                <Label htmlFor={referenceIdValueId} className="mb-1.5 block text-xs">
                  Reference ID
                </Label>
                <Input
                  id={referenceIdValueId}
                  value={value.couponUseReferenceIdValue ?? ""}
                  onChange={(e) =>
                    update({ couponUseReferenceIdValue: e.target.value || undefined })
                  }
                  placeholder="Literal reference"
                  disabled={disabled}
                  className="text-xs"
                />
              </div>
            </PathOrValueField>
            <PathOrValueField
              path={value.couponUseValuePath}
              value={value.couponUseValueValue}
              onPathChange={(couponUseValuePath) => update({ couponUseValuePath })}
              label="Use value"
              pathLabel="Use value path"
              disabled={disabled}
              presentation={presentation}
            >
              <div>
                <Label htmlFor={useValueId} className="mb-1.5 block text-xs">
                  Use Value
                </Label>
                <Input
                  id={useValueId}
                  value={value.couponUseValueValue ?? ""}
                  onChange={(e) => update({ couponUseValueValue: e.target.value || undefined })}
                  placeholder="Literal value"
                  disabled={disabled}
                  className="text-xs"
                />
              </div>
            </PathOrValueField>
            <PathOrValueField
              path={value.discountCurrencyTypeCodePath}
              value={value.discountCurrencyTypeCodeValue}
              onPathChange={(discountCurrencyTypeCodePath) =>
                update({ discountCurrencyTypeCodePath })
              }
              label="Discount currency"
              pathLabel="Discount currency path"
              disabled={disabled}
              presentation={presentation}
            >
              <div>
                <Label htmlFor={discountCurrencyCodeId} className="mb-1.5 block text-xs">
                  Discount Currency Code
                </Label>
                <Input
                  id={discountCurrencyCodeId}
                  value={value.discountCurrencyTypeCodeValue ?? ""}
                  onChange={(e) =>
                    update({ discountCurrencyTypeCodeValue: e.target.value || undefined })
                  }
                  placeholder="e.g. USD"
                  disabled={disabled}
                  className="text-xs"
                />
              </div>
            </PathOrValueField>
          </div>
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
