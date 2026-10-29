/**
 * Has Program Currency Expression Component
 *
 * Currency code + optional comparison amount. The program (id/code) and the
 * evaluated `path` are derived server-side from the currency code, so they are
 * not exposed here.
 */

import { memo, useId, type ReactNode } from "react";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import type { ExpressionComponentProps, HasProgramCurrencyExpression } from "../types";

type HasProgramCurrencyData = HasProgramCurrencyExpression["hasProgramCurrency"];

export const HasProgramCurrencyExpressionComponent = memo(
  function HasProgramCurrencyExpressionComponent({
    value,
    onChange,
    disabled,
    mode,
    className,
  }: ExpressionComponentProps<HasProgramCurrencyData>): ReactNode {
    const currencyCodeId = useId();
    const comparisonAmountId = useId();

    if (mode === "display") {
      return (
        <div className={className}>
          <div className="text-muted-foreground space-y-1 text-xs">
            <div>Currency: {value.programCurrencyCode || "(not set)"}</div>
            {value.comparisonAmount != null && <div>Min Balance: {value.comparisonAmount}</div>}
          </div>
        </div>
      );
    }

    return (
      <div className={className}>
        <div className="space-y-3">
          <div>
            <Label htmlFor={currencyCodeId} className="mb-1.5 block text-xs">
              Currency Code
            </Label>
            <Input
              id={currencyCodeId}
              value={value.programCurrencyCode}
              onChange={(e) => onChange({ ...value, programCurrencyCode: e.target.value })}
              placeholder="e.g. POINTS, MILES"
              disabled={disabled}
              className="text-xs"
            />
          </div>
          <div>
            <Label htmlFor={comparisonAmountId} className="mb-1.5 block text-xs">
              Comparison Amount (optional)
            </Label>
            <Input
              id={comparisonAmountId}
              type="number"
              value={value.comparisonAmount ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  comparisonAmount: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="0"
              disabled={disabled}
              className="text-xs"
            />
          </div>
          <label className="flex items-center gap-2">
            <Switch
              checked={value.revalidateCurrencies ?? false}
              onCheckedChange={(v) => onChange({ ...value, revalidateCurrencies: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Revalidate currencies</Label>
          </label>
        </div>
      </div>
    );
  }
);
