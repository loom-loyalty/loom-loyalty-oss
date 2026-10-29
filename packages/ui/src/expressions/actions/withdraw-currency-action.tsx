/**
 * Withdraw Program Currency Action Component
 *
 * Same structure as IssueCurrency with "Withdraw" labeling.
 */

import { memo, useCallback, useId, useMemo, type ReactNode } from "react";
import { ProgramCurrencyField } from "../../forms/program-currency-field/index.js";
import { ProgramField } from "../../forms/program-field/index.js";
import { useProgramField } from "../../forms/program-field/use-program-field.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { FieldsetLegend } from "../components/fieldset-legend.js";
import { JsonPathInput } from "../inputs/json-path-input";
import { PreOperationSelector } from "../inputs/pre-operation-selector";
import type { ActionComponentProps, PreOperation, WithdrawProgramCurrencyAction } from "../types";
import { RoundingFields } from "./rounding-fields.js";

type WithdrawCurrencyData = WithdrawProgramCurrencyAction["withdrawProgramCurrency"];

export const WithdrawCurrencyActionComponent = memo(function WithdrawCurrencyActionComponent({
  value,
  onChange,
  disabled,
  className,
  presentation = "card",
}: ActionComponentProps<WithdrawCurrencyData>): ReactNode {
  const { findProgram, programs } = useProgramField();
  const amountId = useId();
  const capId = useId();
  const programId = useId();
  const currencyCodeId = useId();

  const update = useCallback(
    (partial: Partial<WithdrawCurrencyData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  const handleProgramChange = useCallback(
    (programId: string) => {
      const program = findProgram(programId);
      // The currency picker is scoped to the selected program (ProgramCurrencyField's
      // `programId` prop) — a currency chosen under a different program is not
      // guaranteed valid here, so clear it and require a fresh selection rather
      // than silently keeping a stale/mismatched code (adversarial review finding).
      update({
        programId: program?.programId ?? program?.code,
        programCode: program?.code ?? undefined,
        programCurrencyCode: undefined,
      });
    },
    [update, findProgram]
  );

  const selectedProgramId = useMemo(() => {
    if (!value.programCode) return "";
    const program = programs.find((p) => p.code === value.programCode);
    return program ? (program.programId ?? program.code) : "";
  }, [value.programCode, programs]);

  return (
    <div className={className}>
      <div className="space-y-3">
        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend
            trailing={
              <label className="flex items-center gap-2">
                <Label className="text-xs">Fixed amount</Label>
                <Switch
                  checked={value.isFixedAmount}
                  onCheckedChange={(v) => update({ isFixedAmount: v })}
                  disabled={disabled}
                />
              </label>
            }
          >
            Withdrawal Amount
          </FieldsetLegend>
          {value.isFixedAmount ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={amountId} className="mb-1.5 block text-xs">
                  Amount
                </Label>
                <Input
                  id={amountId}
                  type="number"
                  value={value.defaultResult}
                  onChange={(e) => update({ defaultResult: Number(e.target.value) })}
                  disabled={disabled}
                  className="text-xs"
                />
              </div>
              <div>
                <Label htmlFor={capId} className="mb-1.5 block text-xs">
                  Cap (optional)
                </Label>
                <Input
                  id={capId}
                  type="number"
                  value={value.cappedResult ?? ""}
                  onChange={(e) =>
                    update({ cappedResult: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="Maximum amount"
                  disabled={disabled}
                  className="text-xs"
                />
              </div>
            </div>
          ) : (
            <>
              <JsonPathInput
                value={value.path ?? ""}
                onChange={(path) => update({ path })}
                label="Amount Path"
                disabled={disabled}
                presentation={presentation}
              />
              <PreOperationSelector
                value={value.preOperation}
                onChange={(preOperation: PreOperation | undefined) => update({ preOperation })}
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={amountId} className="mb-1.5 block text-xs">
                    Default Amount
                  </Label>
                  <Input
                    id={amountId}
                    type="number"
                    value={value.defaultResult}
                    onChange={(e) => update({ defaultResult: Number(e.target.value) })}
                    disabled={disabled}
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor={capId} className="mb-1.5 block text-xs">
                    Cap (optional)
                  </Label>
                  <Input
                    id={capId}
                    type="number"
                    value={value.cappedResult ?? ""}
                    onChange={(e) =>
                      update({ cappedResult: e.target.value ? Number(e.target.value) : undefined })
                    }
                    placeholder="Maximum amount"
                    disabled={disabled}
                    className="text-xs"
                  />
                </div>
              </div>
            </>
          )}
          <RoundingFields value={value} onChange={update} disabled={disabled} />
        </fieldset>

        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend>Program & Currency</FieldsetLegend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={programId} className="mb-1.5 block text-xs">
                Program
              </Label>
              <ProgramField
                id={programId}
                value={selectedProgramId}
                onValueChange={handleProgramChange}
                placeholder="Select program..."
                disabled={disabled}
                className="text-xs"
              />
            </div>
            <div>
              <Label htmlFor={currencyCodeId} className="mb-1.5 block text-xs">
                Currency Code
              </Label>
              <ProgramCurrencyField
                id={currencyCodeId}
                value={value.programCurrencyCode}
                onValueChange={(programCurrencyCode) => update({ programCurrencyCode })}
                programId={selectedProgramId || undefined}
                placeholder={selectedProgramId ? "Select a currency..." : "Select a program first"}
                disabled={disabled || !selectedProgramId}
                className="text-xs"
              />
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
});
