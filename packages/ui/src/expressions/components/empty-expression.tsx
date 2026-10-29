/**
 * Empty / NotEmpty Expression Component
 *
 * JsonPath input; the defaultResult flag sits under "Advanced".
 */

import { memo, useCallback, type ReactNode } from "react";

import { JsonPathInput } from "../inputs/json-path-input";
import type { EmptyExpression, ExpressionComponentProps, NotEmptyExpression } from "../types";
import { MissingFieldAdvanced } from "./missing-field-advanced";

type EmptyData = EmptyExpression["empty"];
type NotEmptyData = NotEmptyExpression["notEmpty"];
type EmptyOrNotData = EmptyData | NotEmptyData;

export const EmptyExpressionComponent = memo(function EmptyExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
  presentation,
}: ExpressionComponentProps<EmptyOrNotData>): ReactNode {
  const handlePathChange = useCallback(
    (path: string) => onChange({ ...value, path }),
    [value, onChange]
  );

  const handleDefaultResultChange = useCallback(
    (checked: boolean) => onChange({ ...value, defaultResult: checked }),
    [value, onChange]
  );

  if (mode === "display") {
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          Path:{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
            {value.path || "(not set)"}
          </code>
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <JsonPathInput
          value={value.path}
          onChange={handlePathChange}
          label="Path to check"
          disabled={disabled}
          presentation={presentation}
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
