/** Array manager for expression actions. */

import { memo, useCallback, useState, type ReactNode } from "react";

import { ActionRow } from "./action-row.js";
import { useActionSummaryLookups } from "./action-summary-lookups.js";
import { ActionTypePicker } from "./action-type-picker.js";
import { SectionRule } from "./components/section-rule.js";
import type { ActionListProps, ExpressionAction } from "./types.js";
import { createDefaultAction } from "./utils.js";

export const ActionList = memo(function ActionList({
  actions,
  onChange,
  disabled,
  className,
  presentation = "card",
}: ActionListProps): ReactNode {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const resolve = useActionSummaryLookups(actions);

  // A stable per-row id, independent of array position — index-keying let a
  // removed row's neighbor inherit its DOM/component instance (and thus its
  // PathOrValueField mode/toggle state) after a mid-list removal shifted
  // everything up (adversarial review finding). `handleAdd`/`handleRemove`
  // update this in lockstep with `actions`; any OTHER length change (e.g. an
  // externally-applied AI-drafted proposal replacing the whole array) can't
  // be tracked incrementally, so it falls back to regenerating fresh ids —
  // via React's supported "adjust state during render" pattern.
  const [rowIds, setRowIds] = useState<string[]>(() => actions.map(() => crypto.randomUUID()));
  if (rowIds.length !== actions.length) {
    setRowIds(actions.map(() => crypto.randomUUID()));
  }

  const handleAdd = useCallback(
    (type: string) => {
      const nextIndex = actions.length;
      onChange([...actions, createDefaultAction(type)]);
      setRowIds((current) => [...current, crypto.randomUUID()]);
      setExpandedIndex(nextIndex);
    },
    [actions, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(actions.filter((_, actionIndex) => actionIndex !== index));
      setRowIds((current) => current.filter((_, rowIndex) => rowIndex !== index));
      setExpandedIndex((current) => {
        if (current === null || current === index) return null;
        return current > index ? current - 1 : current;
      });
    },
    [actions, onChange]
  );

  const handleActionChange = useCallback(
    (index: number, action: ExpressionAction) => {
      const nextActions = [...actions];
      nextActions[index] = action;
      onChange(nextActions);
    },
    [actions, onChange]
  );

  const countLabel =
    actions.length === 0
      ? "No actions"
      : `${actions.length} action${actions.length === 1 ? "" : "s"}`;

  return (
    <div className={className}>
      <SectionRule
        label="THEN"
        srHeading="Actions"
        trailing={<span className="text-muted-foreground font-mono text-[11px]">{countLabel}</span>}
      />
      <div className="border-card-border bg-card mt-2 overflow-hidden rounded-lg border">
        {actions.map((action, index) => (
          <ActionRow
            key={rowIds[index]}
            action={action}
            index={index}
            expanded={expandedIndex === index}
            disabled={disabled}
            isLast={index === actions.length - 1}
            presentation={presentation}
            resolve={resolve}
            onExpand={() => setExpandedIndex((current) => (current === index ? null : index))}
            onRemove={() => handleRemove(index)}
            onChange={(nextAction) => handleActionChange(index, nextAction)}
          />
        ))}
        <div className="bg-muted flex items-center px-[14px] py-1">
          <ActionTypePicker onSelect={handleAdd} disabled={disabled} />
        </div>
      </div>
    </div>
  );
});
