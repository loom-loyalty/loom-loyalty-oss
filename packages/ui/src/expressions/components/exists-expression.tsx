/**
 * Exists / NotExists Expression Component
 *
 * Single JsonPath input to check if a path exists in the event data.
 */

import { memo, useCallback, type ReactNode } from "react";

import { JsonPathInput } from "../inputs/json-path-input";
import type { ExistsExpression, ExpressionComponentProps, NotExistsExpression } from "../types";

type ExistsData = ExistsExpression["exists"];
type NotExistsData = NotExistsExpression["notExists"];
type ExistsOrNotData = ExistsData | NotExistsData;

export const ExistsExpressionComponent = memo(function ExistsExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
  presentation,
}: ExpressionComponentProps<ExistsOrNotData>): ReactNode {
  const handlePathChange = useCallback(
    (path: string) => {
      onChange({ ...value, path });
    },
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
      <JsonPathInput
        value={value.path}
        onChange={handlePathChange}
        label="Path to check"
        disabled={disabled}
        presentation={presentation}
      />
    </div>
  );
});
