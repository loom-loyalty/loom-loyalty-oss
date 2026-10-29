/**
 * Comparison Sentence
 *
 * Sentence-mode inline template for the comparison-family leaf types (R4/KTD1):
 * a field pill (opens the U3 property picker), a comparison-family-scoped
 * operator control, and family-specific value input(s), composed as a single
 * flowing, wrapping row.
 *
 * Value edits call the existing per-node `handleDataChange` (passed in as
 * `onDataChange`) so the written AST is byte-for-byte what the card-mode
 * field components produce (KTD6/R6). Operator switches call
 * `transitionExpressionData` via `onTypeChange` instead, because they change
 * the AST's top-level key — `handleDataChange` cannot do that (KTD10).
 *
 * The operator control reuses `ExpressionTypeSelector` with `excludeTypes`
 * set to every non-comparison-family type, so it structurally can never
 * offer a composite or specialized type as a switch target (fix #12) — the
 * same mechanism U4 uses to keep `and`/`or`/`not` out of the "Add condition"
 * list.
 */

import { Plus, X } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "../../primitives/button.js";
import { Input } from "../../primitives/input.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select.js";

import {
  COMPARISON_FAMILY_TYPES,
  getComparisonFamilyKind,
  isAnniversaryMatch,
  OPERATOR_SENTENCE_LABELS,
  type ComparisonFamilyType,
} from "../expression-transition.js";
import { JsonPathInput } from "../inputs/json-path-input.js";
import { MissingFieldAdvanced } from "./missing-field-advanced.js";

const FIELD_PILL_CLASS =
  "bg-input border-input-border inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-semibold sm:min-h-9";
const OPERATOR_PILL_CLASS =
  "border-input-border bg-input inline-flex h-11 w-auto min-w-0 shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium shadow-xs sm:h-9";

export interface ComparisonSentenceProps {
  type: ComparisonFamilyType;
  data: Record<string, unknown>;
  onDataChange: (newData: Record<string, unknown>) => void;
  onTypeChange: (newType: string) => void;
  disabled?: boolean;
}

export function ComparisonSentence({
  type,
  data,
  onDataChange,
  onTypeChange,
  disabled,
}: ComparisonSentenceProps): ReactNode {
  const path = typeof data.path === "string" ? data.path : "";
  const { needsIs, label: operatorLabel } = OPERATOR_SENTENCE_LABELS[type];
  // The anniversary shape's compared value (`true`) is an engine detail, so the
  // row reads as a fixed phrase instead of an operator + editable value.
  const anniversary = isAnniversaryMatch(type, data);

  const handlePathChange = useCallback(
    (nextPath: string) => onDataChange({ ...data, path: nextPath }),
    [data, onDataChange]
  );
  const handleDefaultResultChange = useCallback(
    (checked: boolean) => onDataChange({ ...data, defaultResult: checked }),
    [data, onDataChange]
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <JsonPathInput
          value={path}
          onChange={handlePathChange}
          label=""
          disabled={disabled}
          presentation="sentence"
          className={FIELD_PILL_CLASS}
        />
        {anniversary ? (
          <span className="text-muted-foreground text-sm">
            {type === "equals" ? "is" : "is not"} today (month and day)
          </span>
        ) : (
          <>
            {needsIs && <span className="text-muted-foreground text-sm">is</span>}
            <Select value={type} onValueChange={onTypeChange} disabled={disabled}>
              <SelectTrigger className={OPERATOR_PILL_CLASS} aria-label="Condition">
                <SelectValue>{operatorLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COMPARISON_FAMILY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {OPERATOR_SENTENCE_LABELS[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ComparisonValueEditor
              type={type}
              data={data}
              onDataChange={onDataChange}
              disabled={disabled}
            />
          </>
        )}
      </div>
      {/* `between` carries no defaultResult, matching its card-mode component. */}
      {getComparisonFamilyKind(type) !== "between" && (
        <MissingFieldAdvanced
          checked={data.defaultResult === true}
          onCheckedChange={handleDefaultResultChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function ComparisonValueEditor({
  type,
  data,
  onDataChange,
  disabled,
}: {
  type: ComparisonFamilyType;
  data: Record<string, unknown>;
  onDataChange: (newData: Record<string, unknown>) => void;
  disabled?: boolean;
}): ReactNode {
  const kind = getComparisonFamilyKind(type);

  if (kind === "between") {
    return <BetweenValueEditor data={data} onDataChange={onDataChange} disabled={disabled} />;
  }
  if (kind === "collection") {
    return <CollectionValueEditor data={data} onDataChange={onDataChange} disabled={disabled} />;
  }
  return (
    <ScalarValueEditor kind={kind} data={data} onDataChange={onDataChange} disabled={disabled} />
  );
}

function ScalarValueEditor({
  kind,
  data,
  onDataChange,
  disabled,
}: {
  kind: "equality" | "numeric" | "string";
  data: Record<string, unknown>;
  onDataChange: (newData: Record<string, unknown>) => void;
  disabled?: boolean;
}): ReactNode {
  const extractValueFromPath = Boolean(data.extractValueFromPath);
  const rawValue = data.value;

  const handleChange = useCallback(
    (next: unknown) => onDataChange({ ...data, value: next }),
    [data, onDataChange]
  );

  if (extractValueFromPath) {
    return (
      <JsonPathInput
        value={typeof rawValue === "string" ? rawValue : ""}
        onChange={handleChange}
        label=""
        disabled={disabled}
        presentation="sentence"
      />
    );
  }

  if (kind === "numeric") {
    // A numeric-typed leaf can still hold a string-shaped number (e.g. from
    // AI/JSON output that never round-tripped through this input) — blanking
    // the field for anything not already a `number` silently hid real data
    // and risked overwriting it on the next edit (Codex review F7).
    const numericDisplayValue =
      typeof rawValue === "number"
        ? rawValue
        : typeof rawValue === "string" && rawValue !== "" && Number.isFinite(Number(rawValue))
          ? rawValue
          : "";
    return (
      <Input
        type="number"
        value={numericDisplayValue}
        onChange={(e) => handleChange(e.target.value === "" ? "" : Number(e.target.value))}
        disabled={disabled}
        placeholder="Value"
        aria-label="Value"
        className="h-9 w-24 min-w-0 shrink-0 text-xs"
      />
    );
  }

  return (
    <Input
      value={typeof rawValue === "string" ? rawValue : String(rawValue ?? "")}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled}
      placeholder="Value"
      aria-label="Value"
      className="h-9 w-32 min-w-0 shrink-0 text-xs"
    />
  );
}

function BetweenValueEditor({
  data,
  onDataChange,
  disabled,
}: {
  data: Record<string, unknown>;
  onDataChange: (newData: Record<string, unknown>) => void;
  disabled?: boolean;
}): ReactNode {
  const lowerBound = data.lowerBound;
  const upperBound = data.upperBound;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        value={typeof lowerBound === "number" ? lowerBound : ""}
        onChange={(e) =>
          onDataChange({
            ...data,
            lowerBound: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
        disabled={disabled}
        placeholder="Lower bound"
        aria-label="Lower bound"
        className="h-9 w-24 min-w-0 shrink-0 text-xs"
      />
      <span className="text-muted-foreground text-xs">and</span>
      <Input
        type="number"
        value={typeof upperBound === "number" ? upperBound : ""}
        onChange={(e) =>
          onDataChange({
            ...data,
            upperBound: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
        disabled={disabled}
        placeholder="Upper bound"
        aria-label="Upper bound"
        className="h-9 w-24 min-w-0 shrink-0 text-xs"
      />
    </div>
  );
}

function CollectionValueEditor({
  data,
  onDataChange,
  disabled,
}: {
  data: Record<string, unknown>;
  onDataChange: (newData: Record<string, unknown>) => void;
  disabled?: boolean;
}): ReactNode {
  const values = Array.isArray(data.values) ? (data.values as unknown[]) : [];
  const [draft, setDraft] = useState("");

  const commitAdd = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onDataChange({ ...data, values: [...values, trimmed] });
    setDraft("");
  }, [draft, data, values, onDataChange]);

  const removeAt = useCallback(
    (index: number) => {
      onDataChange({ ...data, values: values.filter((_, i) => i !== index) });
    },
    [data, values, onDataChange]
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {values.map((v, i) => (
        <span
          key={`${String(v)}-${i}`}
          className="border-border bg-muted inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-xs"
        >
          <span className="max-w-40 break-words">{String(v)}</span>
          <button
            type="button"
            onClick={() => removeAt(i)}
            disabled={disabled}
            aria-label={`Remove ${String(v)}`}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              "hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAdd();
            }
          }}
          disabled={disabled}
          placeholder="Add value"
          aria-label="New value"
          className="h-9 w-28 min-w-0 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={commitAdd}
          disabled={disabled || !draft.trim()}
          className="min-h-11 gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add value
        </Button>
      </div>
    </div>
  );
}
