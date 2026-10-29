/**
 * Register Target Action Component
 *
 * Target selection via TargetField, program via ProgramField, event rule via EventRuleField.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { EventRuleField } from "../../forms/event-rule-field/index.js";
import { useEventRuleField } from "../../forms/event-rule-field/use-event-rule-field.js";
import { ProgramField } from "../../forms/program-field/index.js";
import { useProgramField } from "../../forms/program-field/use-program-field.js";
import { TargetField } from "../../forms/target-field/index.js";
import { useTargetField } from "../../forms/target-field/use-target-field.js";
import { Label } from "../../primitives/label.js";

import type { ActionComponentProps, RegisterTargetAction } from "../types";

type RegisterTargetData = RegisterTargetAction["registerTarget"];

export const RegisterTargetActionComponent = memo(function RegisterTargetActionComponent({
  value,
  onChange,
  disabled,
  className,
}: ActionComponentProps<RegisterTargetData>): ReactNode {
  const targetFieldId = useId();
  const programFieldId = useId();
  const eventRuleFieldId = useId();
  const { findProgram } = useProgramField();
  const { findTarget } = useTargetField();
  const { findEventRule } = useEventRuleField();

  const update = useCallback(
    (partial: Partial<RegisterTargetData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  const handleTargetChange = useCallback(
    (targetId: string) => {
      const target = findTarget(targetId);
      update({
        targetId: targetId || undefined,
        targetCode: target?.code ?? undefined,
      });
    },
    [update, findTarget]
  );

  const handleProgramChange = useCallback(
    (programId: string) => {
      const program = findProgram(programId);
      update({
        programId: programId || undefined,
        programCode: program?.code ?? undefined,
      });
    },
    [update, findProgram]
  );

  const handleEventRuleChange = useCallback(
    (eventRuleId: string) => {
      const eventRule = findEventRule(eventRuleId);
      update({
        eventRuleId: eventRuleId || undefined,
        // The backend re-stamps eventRuleId/eventRuleName on every fired
        // action with the currently-firing rule's own values post-execution,
        // so whether this field has any effect once sent is unconfirmed.
        eventRuleName: eventRule?.name ?? undefined,
      });
    },
    [update, findEventRule]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={targetFieldId} className="mb-1.5 block text-xs">
            Target
          </Label>
          <TargetField
            id={targetFieldId}
            value={value.targetId ?? ""}
            onValueChange={handleTargetChange}
            placeholder="Select target..."
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={programFieldId} className="mb-1.5 block text-xs">
            Program
          </Label>
          <ProgramField
            id={programFieldId}
            value={value.programId ?? ""}
            onValueChange={handleProgramChange}
            placeholder="Select program..."
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={eventRuleFieldId} className="mb-1.5 block text-xs">
            Event Rule
          </Label>
          <EventRuleField
            id={eventRuleFieldId}
            value={value.eventRuleId ?? ""}
            onValueChange={handleEventRuleChange}
            placeholder="Select event rule..."
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
});
