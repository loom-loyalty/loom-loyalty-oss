/**
 * Rounding Fields
 *
 * Shared optional rounding controls for numeric-emitting actions
 * (issue/withdraw currency, add counter data). Backend enum
 * `RoundingAlgorithm` + integer `decimalPlaces`.
 */

import { ROUNDING_ALGORITHMS, type RoundingAlgorithm } from "@loom-loyalty/schema/expressions";
import { useId, type ReactNode } from "react";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select.js";
import { FieldsetLegend } from "../components/fieldset-legend.js";

const NONE = "__none__";

export interface RoundingFieldsValue {
  roundingAlgorithm?: RoundingAlgorithm;
  decimalPlaces?: number;
}

export interface RoundingFieldsProps {
  value: RoundingFieldsValue;
  onChange: (partial: RoundingFieldsValue) => void;
  disabled?: boolean;
}

export function RoundingFields({ value, onChange, disabled }: RoundingFieldsProps): ReactNode {
  const algorithmId = useId();
  const decimalPlacesId = useId();

  return (
    <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
      <FieldsetLegend>Rounding (optional)</FieldsetLegend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={algorithmId} className="mb-1.5 block text-xs">
            Algorithm
          </Label>
          <Select
            value={value.roundingAlgorithm ?? NONE}
            onValueChange={(v) =>
              onChange({
                roundingAlgorithm: v === NONE ? undefined : (v as RoundingAlgorithm),
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id={algorithmId} className="text-xs">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Default</SelectItem>
              {ROUNDING_ALGORITHMS.map((algo) => (
                <SelectItem key={algo} value={algo}>
                  {algo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={decimalPlacesId} className="mb-1.5 block text-xs">
            Decimal Places
          </Label>
          <Input
            id={decimalPlacesId}
            type="number"
            value={value.decimalPlaces ?? ""}
            onChange={(e) =>
              onChange({ decimalPlaces: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="0"
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>
    </fieldset>
  );
}
