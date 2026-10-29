/**
 * String Expression Component
 *
 * Handles startsWith, endsWith, matches.
 * JsonPath, ValueInput, ignoreCase switch.
 */

import { memo, useCallback, type ReactNode } from "react";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { JsonPathInput } from "../inputs/json-path-input";
import { ValueInput } from "../inputs/value-input";
import type {
  EndsWithExpression,
  ExpressionComponentProps,
  MatchesExpression,
  StartsWithExpression,
} from "../types";
import { MissingFieldAdvanced } from "./missing-field-advanced";

type StringData =
  | StartsWithExpression["startsWith"]
  | EndsWithExpression["endsWith"]
  | MatchesExpression["matches"];

export const StringExpressionComponent = memo(function StringExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<StringData>): ReactNode {
  const handlePathChange = useCallback(
    (path: string) => onChange({ ...value, path }),
    [value, onChange]
  );

  const handleValueChange = useCallback(
    (v: unknown) => onChange({ ...value, value: String(v) }),
    [value, onChange]
  );

  const handleExtractChange = useCallback(
    (extractValueFromPath: boolean) => onChange({ ...value, extractValueFromPath }),
    [value, onChange]
  );

  const handleIgnoreCaseChange = useCallback(
    (ignoreCase: boolean) => onChange({ ...value, ignoreCase }),
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
          <div>Value: {value.value || "(not set)"}</div>
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
          value={value.value}
          onChange={handleValueChange}
          extractFromPath={value.extractValueFromPath}
          onExtractFromPathChange={handleExtractChange}
          label="Compare to"
          disabled={disabled}
        />
        <label className="flex items-center gap-2">
          <Switch
            checked={value.ignoreCase}
            onCheckedChange={handleIgnoreCaseChange}
            disabled={disabled}
          />
          <Label className="text-xs">Ignore case</Label>
        </label>
        <MissingFieldAdvanced
          checked={value.defaultResult ?? false}
          onCheckedChange={handleDefaultResultChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
});
