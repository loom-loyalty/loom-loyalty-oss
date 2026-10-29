/**
 * Funnel Stage Expression Component (audience-only)
 *
 * Matches customers currently in a given lifecycle funnel stage.
 */

import { FUNNEL_STAGES } from "@loom-loyalty/schema/expressions";
import { memo, useId, type ReactNode } from "react";
import { Label } from "../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select.js";

import type { ExpressionComponentProps, FunnelStage, FunnelStageExpression } from "../types";

type FunnelStageData = FunnelStageExpression["funnelStage"];

const STAGE_LABEL = (stage: string): string => stage.charAt(0) + stage.slice(1).toLowerCase();

export const FunnelStageExpressionComponent = memo(function FunnelStageExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<FunnelStageData>): ReactNode {
  const fieldId = useId();

  if (mode === "display") {
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">Stage: {STAGE_LABEL(value.stage)}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <Label htmlFor={fieldId} className="mb-1.5 block text-xs">
          Funnel Stage
        </Label>
        <Select
          value={value.stage}
          onValueChange={(stage) => onChange({ ...value, stage: stage as FunnelStage })}
          disabled={disabled}
        >
          <SelectTrigger id={fieldId} className="text-xs">
            <SelectValue placeholder="Select stage..." />
          </SelectTrigger>
          <SelectContent>
            {FUNNEL_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {STAGE_LABEL(stage)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});
