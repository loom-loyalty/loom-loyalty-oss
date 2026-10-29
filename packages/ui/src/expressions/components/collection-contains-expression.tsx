/**
 * Collection Contains Expression Component
 *
 * Handles containsAny and containsAll. Same pattern as In/NotIn.
 */

import { memo, useCallback, type ReactNode } from "react";

import { JsonPathInput } from "../inputs/json-path-input";
import { ValueInput } from "../inputs/value-input";
import type {
  ContainsAllExpression,
  ContainsAnyExpression,
  ExpressionComponentProps,
} from "../types";
import { MissingFieldAdvanced } from "./missing-field-advanced";

type ContainsData = ContainsAnyExpression["containsAny"] | ContainsAllExpression["containsAll"];

export const CollectionContainsExpressionComponent = memo(
  function CollectionContainsExpressionComponent({
    value,
    onChange,
    disabled,
    mode,
    className,
  }: ExpressionComponentProps<ContainsData>): ReactNode {
    const handlePathChange = useCallback(
      (path: string) => onChange({ ...value, path }),
      [value, onChange]
    );

    const handleValuesChange = useCallback(
      (values: unknown) => onChange({ ...value, values: values as unknown[] }),
      [value, onChange]
    );

    const handleExtractChange = useCallback(
      (extractValues: boolean) => onChange({ ...value, extractValues }),
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
            <div>Values: {value.values?.length ?? 0} items</div>
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
          <ValueInput
            value={value.values}
            onChange={handleValuesChange}
            extractFromPath={value.extractValues}
            onExtractFromPathChange={handleExtractChange}
            valueType="array"
            label="Values"
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
  }
);
