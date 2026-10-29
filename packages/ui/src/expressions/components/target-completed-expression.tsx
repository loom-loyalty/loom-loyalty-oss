/**
 * Target Completed Expression Component
 *
 * Target selection via TargetField and revalidateTarget switch.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { TargetField } from "../../forms/target-field/index.js";
import { useTargetField } from "../../forms/target-field/use-target-field.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import type { ExpressionComponentProps, TargetCompletedExpression } from "../types";

type TargetCompletedData = TargetCompletedExpression["targetCompleted"];

export const TargetCompletedExpressionComponent = memo(function TargetCompletedExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<TargetCompletedData>): ReactNode {
  const targetFieldId = useId();
  const { findTarget } = useTargetField();

  const handleTargetChange = useCallback(
    (targetId: string) => onChange({ ...value, targetId }),
    [value, onChange]
  );

  const handleRevalidateChange = useCallback(
    (revalidateTarget: boolean) => onChange({ ...value, revalidateTarget }),
    [value, onChange]
  );

  if (mode === "display") {
    const target = value.targetId ? findTarget(value.targetId) : undefined;
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          Target: {target?.name ?? (value.targetId || "(not set)")}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={targetFieldId} className="mb-1.5 block text-xs">
            Target
          </Label>
          <TargetField
            id={targetFieldId}
            value={value.targetId}
            onValueChange={handleTargetChange}
            placeholder="Select target..."
            disabled={disabled}
          />
        </div>
        <label className="flex items-center gap-2">
          <Switch
            checked={value.revalidateTarget}
            onCheckedChange={handleRevalidateChange}
            disabled={disabled}
          />
          <Label className="text-xs">Revalidate target</Label>
        </label>
      </div>
    </div>
  );
});
