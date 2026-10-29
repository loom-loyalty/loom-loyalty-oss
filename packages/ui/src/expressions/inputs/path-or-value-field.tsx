import { useState, type ReactNode } from "react";

import { SegmentedSwitch } from "../components/segmented-switch.js";
import type { ExpressionPresentation } from "../types.js";
import { JsonPathInput } from "./json-path-input.js";

export interface PathOrValueFieldProps {
  path?: string;
  value?: string;
  onPathChange: (path: string | undefined) => void;
  label: string;
  pathLabel?: string;
  disabled?: boolean;
  presentation?: ExpressionPresentation;
  children: ReactNode;
}

/**
 * Switches which control is *visible* between a schema path and a caller-
 * supplied literal control. This is a display toggle only — the DSL resolves
 * `path` with the literal as a fallback when the path yields nothing (see
 * `packages/schema/src/expressions/actions.ts`'s `couponMutationFields` /
 * "falls back when path yields nothing"), so both may legitimately be set at
 * once. Switching segments must never clear the hidden field's stored value —
 * doing so would silently drop a working fallback the next time someone edits
 * the sibling control.
 */
export function PathOrValueField({
  path,
  value,
  onPathChange,
  label,
  pathLabel = "From field",
  disabled,
  presentation = "card",
  children,
}: PathOrValueFieldProps): ReactNode {
  const [mode, setMode] = useState<"field" | "value">(() => (path ? "field" : "value"));

  return (
    <div className="space-y-2">
      <SegmentedSwitch
        value={mode}
        onChange={setMode}
        options={[
          { value: "field", label: "From field" },
          { value: "value", label: "Fixed value" },
        ]}
        disabled={disabled}
        ariaLabel={`${label} source`}
      />
      {mode === "field" ? (
        <JsonPathInput
          value={path ?? ""}
          onChange={(nextPath) => onPathChange(nextPath || undefined)}
          label={pathLabel}
          disabled={disabled}
          presentation={presentation}
        />
      ) : (
        children
      )}
      {mode === "field" && value ? (
        <p className="text-muted-foreground text-xs">
          Fallback value if the field is empty: <span className="font-medium">{value}</span>
        </p>
      ) : null}
      {mode === "value" && path ? (
        <p className="text-muted-foreground text-xs">
          A field is also set and takes priority when it resolves a value.
        </p>
      ) : null}
    </div>
  );
}
