/**
 * Value Input
 *
 * Type-aware value input with toggle for "Extract from path" mode.
 * Supports text, number, boolean, and array value types.
 */

import { Plus, X } from "lucide-react";
import { useCallback, useId, type ReactNode } from "react";
import { Button } from "../../primitives/button.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { JsonPathInput } from "./json-path-input";

export interface ValueInputProps {
  value: unknown;
  onChange: (value: unknown) => void;
  extractFromPath: boolean;
  onExtractFromPathChange: (value: boolean) => void;
  valueType?: "text" | "number" | "boolean" | "array";
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function ValueInput({
  value,
  onChange,
  extractFromPath,
  onExtractFromPathChange,
  valueType = "text",
  label = "Value",
  disabled,
  className,
}: ValueInputProps): ReactNode {
  const inputId = useId();
  // Only the single scalar (text/number) input can own the label; array renders
  // many inputs and boolean/extract-from-path use their own labeled controls.
  const isScalarInput = !extractFromPath && (valueType === "number" || valueType === "text");

  const handleAddArrayItem = useCallback(() => {
    const current = Array.isArray(value) ? value : [];
    onChange([...current, ""]);
  }, [value, onChange]);

  const handleRemoveArrayItem = useCallback(
    (index: number) => {
      const current = Array.isArray(value) ? value : [];
      onChange(current.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const handleArrayItemChange = useCallback(
    (index: number, itemValue: string) => {
      const current = Array.isArray(value) ? [...value] : [];
      current[index] = itemValue;
      onChange(current);
    },
    [value, onChange]
  );

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <Label htmlFor={isScalarInput ? inputId : undefined} className="text-xs">
          {label}
        </Label>
        <label className="flex items-center gap-1.5 text-[11px]">
          <Switch
            checked={extractFromPath}
            onCheckedChange={onExtractFromPathChange}
            disabled={disabled}
            className="scale-75"
          />
          <span className="text-muted-foreground">Extract from path</span>
        </label>
      </div>

      {extractFromPath ? (
        <JsonPathInput
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          label=""
          disabled={disabled}
          placeholder="$.eventData.comparisonField"
        />
      ) : valueType === "array" ? (
        <div className="space-y-1.5">
          {(Array.isArray(value) ? value : []).map((item: unknown, index: number) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={String(item ?? "")}
                onChange={(e) => handleArrayItemChange(index, e.target.value)}
                disabled={disabled}
                className="text-xs"
                placeholder={`Value ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveArrayItem(index)}
                disabled={disabled}
                className="h-8 w-8 shrink-0 p-0"
                aria-label={`Remove value ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddArrayItem}
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Add Value
          </Button>
        </div>
      ) : valueType === "number" ? (
        <Input
          id={inputId}
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="text-xs"
        />
      ) : valueType === "boolean" ? (
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
          />
          <span className="text-muted-foreground text-xs">{value ? "True" : "False"}</span>
        </div>
      ) : (
        <Input
          id={inputId}
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="text-xs"
        />
      )}
    </div>
  );
}
