/**
 * Between Expression Component
 *
 * JsonPath, PreOperationSelector, lower/upper bound numeric inputs, range
 * validation, and optional inclusivity toggles.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { JsonPathInput } from "../inputs/json-path-input";
import { PreOperationSelector } from "../inputs/pre-operation-selector";
import type { BetweenExpression, ExpressionComponentProps, PreOperation } from "../types";

type BetweenData = BetweenExpression["between"];

export const BetweenExpressionComponent = memo(function BetweenExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<BetweenData>): ReactNode {
  const lowerBoundId = useId();
  const upperBoundId = useId();

  const handlePathChange = useCallback(
    (path: string) => onChange({ ...value, path }),
    [value, onChange]
  );

  const handlePreOpChange = useCallback(
    (preOperation: PreOperation | undefined) => onChange({ ...value, preOperation }),
    [value, onChange]
  );

  const handleLowerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, lowerBound: Number(e.target.value) }),
    [value, onChange]
  );

  const handleUpperChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, upperBound: Number(e.target.value) }),
    [value, onChange]
  );

  const hasRangeError = value.lowerBound > value.upperBound;

  if (mode === "display") {
    return (
      <div className={className}>
        <div className="text-muted-foreground space-y-1 text-xs">
          <div>
            Path:{" "}
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
              {value.path || "(not set)"}
            </code>
          </div>
          <div>
            Range: {value.lowerBound} to {value.upperBound}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <JsonPathInput
          value={value.path}
          onChange={handlePathChange}
          label="Path"
          disabled={disabled}
        />
        <PreOperationSelector
          value={value.preOperation}
          onChange={handlePreOpChange}
          disabled={disabled}
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor={lowerBoundId} className="mb-1.5 block text-xs">
              Lower Bound
            </Label>
            <Input
              id={lowerBoundId}
              type="number"
              value={value.lowerBound}
              onChange={handleLowerChange}
              disabled={disabled}
              className="text-xs"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor={upperBoundId} className="mb-1.5 block text-xs">
              Upper Bound
            </Label>
            <Input
              id={upperBoundId}
              type="number"
              value={value.upperBound}
              onChange={handleUpperChange}
              disabled={disabled}
              className="text-xs"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <Switch
              checked={value.includeLowerBound ?? false}
              onCheckedChange={(v) => onChange({ ...value, includeLowerBound: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Include lower</Label>
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={value.includeUpperBound ?? false}
              onCheckedChange={(v) => onChange({ ...value, includeUpperBound: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Include upper</Label>
          </label>
        </div>
        {hasRangeError && (
          <p className="text-destructive text-xs">
            Lower bound must be less than or equal to upper bound.
          </p>
        )}
      </div>
    </div>
  );
});
