/**
 * Current Tier Expression Component
 *
 * Tier selection via TierField, with validateLifetimeTier, validateTrialTier, revalidateTier switches.
 */

import { memo, useCallback, useEffect, useId, type ReactNode } from "react";
import { TierField } from "../../forms/tier-field/index.js";
import { useTierField } from "../../forms/tier-field/use-tier-field.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { useExpressionContext } from "../expression-context.js";
import type { CurrentTierExpression, ExpressionComponentProps } from "../types";

type CurrentTierData = CurrentTierExpression["currentTier"];

export const CurrentTierExpressionComponent = memo(function CurrentTierExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<CurrentTierData>): ReactNode {
  const tierFieldId = useId();
  const minRankId = useId();
  const { findTier } = useTierField({ idField: "code" });
  // `minRank`/`requireActive` are segment-only. The v1 SQL compiler rejects
  // `minRank` on the event surface, so these controls appear only for customer
  // (audience) expressions.
  const isCustomerSurface = useExpressionContext().mode === "customer";

  // Segment-only fields must never ride along in a value saved on the event
  // surface — strip them from every emitted value there. On the customer
  // surface the value passes through untouched.
  const emit = useCallback(
    (next: CurrentTierData) => {
      if (isCustomerSurface) {
        onChange(next);
        return;
      }
      const { minRank: _minRank, requireActive: _requireActive, ...rest } = next;
      onChange(rest);
    },
    [isCustomerSurface, onChange]
  );

  // A value loaded on the event surface may already carry the segment-only
  // fields; strip them so they don't persist on the next save without an edit.
  useEffect(() => {
    if (isCustomerSurface) return;
    if (value.minRank !== undefined || value.requireActive !== undefined) {
      emit(value);
    }
  }, [isCustomerSurface, value, emit]);

  const handleTierChange = useCallback(
    (tierCode: string) => {
      // When a new tier is selected by code, clear legacy tierId since code
      // takes precedence. When cleared, preserve existing tierId for backward
      // compat with rules that only stored a UUID.
      emit({
        ...value,
        tierCode: tierCode || undefined,
        ...(tierCode ? { tierId: undefined } : {}),
      });
    },
    [value, emit]
  );

  if (mode === "display") {
    const tier = value.tierCode ? findTier(value.tierCode) : undefined;
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          Tier: {tier?.name ?? (value.tierCode || value.tierId || "(not set)")}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={tierFieldId} className="mb-1.5 block text-xs">
            Tier
          </Label>
          <TierField
            id={tierFieldId}
            idField="code"
            value={value.tierCode ?? ""}
            onValueChange={handleTierChange}
            placeholder="Select tier..."
            disabled={disabled}
          />
        </div>
        <label className="flex items-center gap-2">
          <Switch
            checked={value.validateLifetimeTier}
            onCheckedChange={(v) => emit({ ...value, validateLifetimeTier: v })}
            disabled={disabled}
          />
          <Label className="text-xs">Validate lifetime tier</Label>
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={value.validateTrialTier}
            onCheckedChange={(v) => emit({ ...value, validateTrialTier: v })}
            disabled={disabled}
          />
          <Label className="text-xs">Validate trial tier</Label>
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={value.revalidateTier}
            onCheckedChange={(v) => emit({ ...value, revalidateTier: v })}
            disabled={disabled}
          />
          <Label className="text-xs">Revalidate tier</Label>
        </label>
        {isCustomerSurface && (
          <>
            <div>
              <Label htmlFor={minRankId} className="mb-1.5 block text-xs">
                Minimum Rank (optional)
              </Label>
              <Input
                id={minRankId}
                type="number"
                value={value.minRank ?? ""}
                onChange={(e) =>
                  emit({
                    ...value,
                    minRank: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 2"
                disabled={disabled}
                className="text-xs"
              />
            </div>
            <label className="flex items-center gap-2">
              <Switch
                checked={value.requireActive ?? false}
                onCheckedChange={(v) => emit({ ...value, requireActive: v })}
                disabled={disabled}
              />
              <Label className="text-xs">Require active tier</Label>
            </label>
          </>
        )}
      </div>
    </div>
  );
});
