/**
 * JsonInput
 *
 * A monospace textarea for editing JSON, with optional validation on blur.
 * When `validate` is true, the component parses the content on blur and
 * displays an inline error message if the JSON is invalid.
 */

"use client";

import { useCallback, useId, useState } from "react";

import { Label } from "../primitives/label";
import { Textarea } from "../primitives/textarea";

export interface JsonInputProps {
  /** Field label */
  label?: string;
  /** Current value (raw JSON string) */
  value?: string;
  /** Called when the value changes */
  onChange?: (value: string) => void;
  /** Validate JSON on blur and show error if invalid */
  validate?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Disable interactions */
  disabled?: boolean;
  /** ARIA label */
  "aria-label"?: string;
}

/**
 * JsonInput - Monospace textarea with optional JSON validation.
 *
 * @example
 * ```tsx
 * const [json, setJson] = useState('{}');
 *
 * <JsonInput
 *   label="Configuration"
 *   value={json}
 *   onChange={setJson}
 *   validate
 * />
 * ```
 */
export function JsonInput({
  label,
  value,
  onChange,
  validate = false,
  required = false,
  disabled = false,
  "aria-label": ariaLabel,
}: JsonInputProps) {
  const id = useId();
  const inputId = `${id}-json`;
  const errorId = `${id}-error`;
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value);
      // Clear error on edit so the user isn't stuck with a stale message
      if (error) setError(null);
    },
    [onChange, error]
  );

  const handleBlur = useCallback(() => {
    if (!validate || !value) {
      setError(null);
      return;
    }

    try {
      JSON.parse(value);
      setError(null);
    } catch (e) {
      const message = e instanceof SyntaxError ? e.message : "Invalid JSON";
      setError(message);
    }
  }, [validate, value]);

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}

      <Textarea
        id={inputId}
        value={value ?? ""}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        className="font-mono text-sm"
        aria-label={ariaLabel ?? label ?? "JSON input"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
