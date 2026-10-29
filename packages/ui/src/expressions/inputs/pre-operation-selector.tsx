/** Inline selector and operands for JSON-path pre-operations. */

import { DATE_TIME_OPERANDS } from "@loom-loyalty/schema/expressions";
import { useCallback, useId, type ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select.js";
import type { PreOperation } from "../types";

export interface PreOperationSelectorProps {
  value?: PreOperation;
  onChange: (value: PreOperation | undefined) => void;
  disabled?: boolean;
  className?: string;
}

// matchesCurrentDate is intentionally excluded here: it resolves to a fixed
// boolean comparand, which greaterThan/lessThan/between (the only consumers
// of this selector) can't hold — their `value` is a NumericComparand
// (number | string). Its intended pairing, equals/notEquals, has no
// preOperation slot in the schema yet, so there's currently no valid target
// for it anywhere in the UI. The render branches below still handle a
// matchesCurrentDate `value` prop passed in from existing/external data
// (pattern/timeZone display), just not as something newly selectable here.
const PRE_OP_GROUPS = {
  Numeric: ["add", "subtract", "multiply", "divide", "modulo"],
  String: ["length", "subString"],
  Array: ["size"],
  Date: ["epoch", "datetime", "diffFromCurrentEpoch"],
} as const;

const PRE_OP_LABELS: Record<string, string> = {
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
  modulo: "Modulo",
  length: "Length",
  subString: "Substring",
  size: "Size",
  epoch: "Epoch",
  datetime: "DateTime",
  diffFromCurrentEpoch: "Diff from Current Epoch",
};

const NUMERIC_SYMBOLS: Record<string, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  modulo: "mod",
};

const NUMERIC_PRE_OPS = Object.keys(NUMERIC_SYMBOLS);
const CHIP_CLASS = "bg-muted rounded px-1.5 py-1 font-mono text-xs text-foreground";
// min-h-11 (44px) below `sm:` matches the touch-target convention every
// sibling control in this feature follows (SegmentedSwitch, PropertyPicker's
// option rows) — this file's compact `h-8` sizing had no responsive floor at
// all (adversarial review finding).
const INLINE_INPUT_CLASS = "min-h-11 sm:min-h-8 w-20 text-xs";

function getPreOpType(op?: PreOperation): string {
  if (!op) return "none";
  return Object.keys(op)[0] ?? "none";
}

function getPreOpData(op?: PreOperation): Record<string, unknown> {
  if (!op) return {};
  const type = getPreOpType(op);
  return (op as unknown as Record<string, Record<string, unknown>>)[type] ?? {};
}

export function PreOperationSelector({
  value,
  onChange,
  disabled,
  className,
}: PreOperationSelectorProps): ReactNode {
  const preOpId = useId();
  const beginIndexId = useId();
  const endIndexId = useId();
  const calendarFieldId = useId();
  const timeZoneId = useId();
  const datePatternId = useId();
  const currentType = getPreOpType(value);
  const data = getPreOpData(value);

  const handleTypeChange = useCallback(
    (type: string) => {
      if (type === "none") {
        onChange(undefined);
        return;
      }

      const emptyOps: Record<string, PreOperation> = {
        add: { add: { operand: 0 } },
        subtract: { subtract: { operand: 0 } },
        multiply: { multiply: { operand: 1 } },
        divide: { divide: { operand: 1 } },
        modulo: { modulo: { operand: 1 } },
        length: { length: {} as Record<string, never> },
        subString: { subString: { beginIndex: 0, endIndex: 0 } },
        size: { size: {} as Record<string, never> },
        epoch: { epoch: {} as Record<string, never> },
        datetime: { datetime: {} },
        diffFromCurrentEpoch: { diffFromCurrentEpoch: {} as Record<string, never> },
      };
      onChange(emptyOps[type]);
    },
    [onChange]
  );

  const patchData = (patch: Record<string, unknown>): void => {
    if (!value) return;
    onChange({ [currentType]: { ...data, ...patch } } as unknown as PreOperation);
  };

  const needsOperandInput = NUMERIC_PRE_OPS.includes(currentType);
  const needsPatternInput = currentType === "datetime" || currentType === "matchesCurrentDate";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Label htmlFor={preOpId} className="text-muted-foreground text-xs whitespace-nowrap">
        Adjust value:
      </Label>
      <Select value={currentType} onValueChange={handleTypeChange} disabled={disabled}>
        <SelectTrigger id={preOpId} className="bg-card min-h-11 w-auto min-w-32 text-xs sm:min-h-8">
          <SelectValue placeholder="No operation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No operation</SelectItem>
          {Object.entries(PRE_OP_GROUPS).map(([group, operations]) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {operations.map((operation) => (
                <SelectItem key={operation} value={operation}>
                  {PRE_OP_LABELS[operation]}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {needsOperandInput && (
        <>
          <span className={CHIP_CLASS}>{NUMERIC_SYMBOLS[currentType]}</span>
          <Input
            type="number"
            value={(data.operand as number) ?? 0}
            onChange={(event) => patchData({ operand: Number(event.target.value) })}
            disabled={disabled}
            className={INLINE_INPUT_CLASS}
            aria-label="Operation operand"
          />
        </>
      )}

      {(currentType === "length" || currentType === "size") && (
        <span className={CHIP_CLASS}>→ {currentType === "length" ? "length" : "size"}</span>
      )}

      {currentType === "subString" && (
        <>
          <span className="text-muted-foreground text-xs">chars</span>
          <Input
            id={beginIndexId}
            type="number"
            value={(data.beginIndex as number) ?? 0}
            onChange={(event) => patchData({ beginIndex: Number(event.target.value) })}
            disabled={disabled}
            className={INLINE_INPUT_CLASS}
            aria-label="Substring begin index"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            id={endIndexId}
            type="number"
            value={(data.endIndex as number) ?? 0}
            onChange={(event) => patchData({ endIndex: Number(event.target.value) })}
            disabled={disabled}
            className={INLINE_INPUT_CLASS}
            aria-label="Substring end index"
          />
        </>
      )}

      {currentType === "epoch" && <span className={CHIP_CLASS}>→ epoch</span>}
      {currentType === "diffFromCurrentEpoch" && <span className={CHIP_CLASS}>→ epoch diff</span>}

      {currentType === "datetime" && (
        <>
          <span className={CHIP_CLASS}>→ datetime</span>
          <Select
            value={(data.operand as string) ?? ""}
            onValueChange={(operand) => patchData({ operand })}
            disabled={disabled}
          >
            <SelectTrigger
              id={calendarFieldId}
              aria-label="Calendar field"
              className="bg-card min-h-11 w-auto min-w-28 text-xs sm:min-h-8"
            >
              <SelectValue placeholder="Whole date" />
            </SelectTrigger>
            <SelectContent>
              {DATE_TIME_OPERANDS.map((operand) => (
                <SelectItem key={operand} value={operand}>
                  {operand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {currentType === "matchesCurrentDate" && <span className={CHIP_CLASS}>→ current date</span>}

      {needsPatternInput && (
        <>
          <span className="text-muted-foreground text-xs">pattern:</span>
          <Input
            id={datePatternId}
            value={(data.pattern as string) ?? ""}
            onChange={(event) => patchData({ pattern: event.target.value || undefined })}
            placeholder="yyyy-MM-dd'T'HH:mm:ss"
            disabled={disabled}
            className="min-h-11 w-36 font-mono text-xs sm:min-h-8"
            aria-label="Date pattern"
          />
        </>
      )}

      {currentType === "matchesCurrentDate" && (
        <>
          <span className="text-muted-foreground text-xs">tz:</span>
          <Input
            id={timeZoneId}
            value={(data.timeZone as string) ?? ""}
            onChange={(event) => patchData({ timeZone: event.target.value || undefined })}
            placeholder="America/New_York"
            disabled={disabled}
            className="min-h-11 w-44 text-xs sm:min-h-8"
            aria-label="Time zone"
          />
        </>
      )}
    </div>
  );
}
