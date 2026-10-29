/**
 * Numeric Expression Component
 *
 * Handles greaterThan, greaterThanEquals, lessThan, lessThanEquals.
 * JsonPath, PreOperationSelector, numeric ValueInput, defaultResult.
 */

import { memo, useCallback, type ReactNode } from "react";

import { JsonPathInput } from "../inputs/json-path-input";
import { PreOperationSelector } from "../inputs/pre-operation-selector";
import { ValueInput } from "../inputs/value-input";
import type {
  ExpressionComponentProps,
  GreaterThanEqualsExpression,
  GreaterThanExpression,
  LessThanEqualsExpression,
  LessThanExpression,
  PreOperation,
} from "../types";
import { MissingFieldAdvanced } from "./missing-field-advanced";

type NumericData =
  | GreaterThanExpression["greaterThan"]
  | GreaterThanEqualsExpression["greaterThanEquals"]
  | LessThanExpression["lessThan"]
  | LessThanEqualsExpression["lessThanEquals"];

export const NumericExpressionComponent = memo(function NumericExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<NumericData>): ReactNode {
  const handlePathChange = useCallback(
    (path: string) => onChange({ ...value, path }),
    [value, onChange]
  );

  const handleValueChange = useCallback(
    // Comparand is `number | string`: keep a JsonPath string when extracting
    // from path, otherwise coerce to a number.
    (v: unknown) => onChange({ ...value, value: typeof v === "string" ? v : Number(v) }),
    [value, onChange]
  );

  const handleExtractChange = useCallback(
    (extractValueFromPath: boolean) => onChange({ ...value, extractValueFromPath }),
    [value, onChange]
  );

  const handlePreOpChange = useCallback(
    (preOperation: PreOperation | undefined) => onChange({ ...value, preOperation }),
    [value, onChange]
  );

  const handleDefaultResultChange = useCallback(
    (defaultResult: boolean) => onChange({ ...value, defaultResult }),
    [value, onChange]
  );

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
          <div>Value: {value.value}</div>
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
        <ValueInput
          value={value.value}
          onChange={handleValueChange}
          extractFromPath={value.extractValueFromPath}
          onExtractFromPathChange={handleExtractChange}
          valueType="number"
          label="Compare to"
          disabled={disabled}
        />
        <MissingFieldAdvanced
          checked={value.defaultResult ?? false}
          onCheckedChange={handleDefaultResultChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
});
