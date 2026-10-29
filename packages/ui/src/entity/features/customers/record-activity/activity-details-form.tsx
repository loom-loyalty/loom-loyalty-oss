/**
 * Renders the selected activity's detail fields for a care agent to complete.
 *
 * Fields come from the live `dataElementToField` path (see
 * `use-activity-details.ts`). This renders inputs for them rather than reusing
 * `EntityEdit`, which owns its own `<form>` and submit controls and so cannot be
 * nested inside the Record activity modal's form.
 *
 * Validation messages are attached to the field that caused them rather than
 * collected into a single banner, so an agent can see which value to fix.
 */

import type { ParsedField } from "@loom-loyalty/schema";
import type { ReactNode } from "react";

import {
  FiatCurrencyInput,
  type FiatCurrencyValue,
} from "../../../../forms/fiat-currency-input.js";
import { Input } from "../../../../primitives/input.js";
import { Label } from "../../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../primitives/select.js";
import { Textarea } from "../../../../primitives/textarea.js";
import type { ActivityDetailField, ActivityDetailValues, ActivityFieldErrors } from "./types.js";

export interface ActivityDetailsFormProps {
  fields: ActivityDetailField[];
  values: ActivityDetailValues;
  onChange: (name: string, value: unknown) => void;
  errors?: ActivityFieldErrors;
  isLoading?: boolean;
}

/** The HTML input type that best fits a parsed field. */
function inputTypeFor(field: ParsedField): string {
  switch (field.type) {
    case "number":
    case "integer":
    case "currency":
    case "percentage":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    case "time":
      return "time";
    case "email":
      return "email";
    case "url":
      return "url";
    default:
      return "text";
  }
}

function asInputValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function FieldControl({
  detail,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  detail: ActivityDetailField;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
  describedBy?: string;
}): ReactNode {
  const { field, name } = detail;
  const controlId = `activity-detail-${name}`;
  const shared = {
    id: controlId,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    className: "min-h-11",
  };

  if (field.type === "fiat_currency") {
    const fiatCurrencyValue =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as FiatCurrencyValue)
        : undefined;
    return (
      <FiatCurrencyInput
        {...shared}
        value={fiatCurrencyValue}
        onChange={onChange}
        required={field.validation.required}
        showCard={false}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <Select
        value={value === undefined || value === null ? "" : String(value)}
        onValueChange={(next) => onChange(next === "true")}
      >
        <SelectTrigger {...shared}>
          <SelectValue placeholder="Choose one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const enumValues = field.validation.enum;
  if (field.type === "enum" && enumValues && enumValues.length > 0) {
    return (
      <Select value={asInputValue(value)} onValueChange={onChange}>
        <SelectTrigger {...shared}>
          <SelectValue placeholder="Choose one" />
        </SelectTrigger>
        <SelectContent>
          {enumValues.map((option) => (
            <SelectItem key={String(option)} value={String(option)}>
              {String(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "text" || field.type === "json") {
    return (
      <Textarea
        {...shared}
        rows={3}
        value={asInputValue(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const type = inputTypeFor(field);
  return (
    <Input
      {...shared}
      type={type}
      value={asInputValue(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (type !== "number") {
          onChange(raw);
          return;
        }
        // A number input sanitizes its own value, so `raw` is either a valid
        // number or empty; an in-progress "-" or "1e" arrives as "". Treat
        // anything unparseable as unset rather than letting NaN into the payload.
        const parsed = raw === "" ? Number.NaN : Number(raw);
        onChange(Number.isNaN(parsed) ? undefined : parsed);
      }}
    />
  );
}

export function ActivityDetailsForm({
  fields,
  values,
  onChange,
  errors,
  isLoading = false,
}: ActivityDetailsFormProps): ReactNode {
  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading the details for this activity…</p>;
  }

  // An activity whose data model declares no fillable elements is a valid
  // activity to record: the date and the customer are the whole payload.
  if (fields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This activity needs no extra details. Check the date and apply.
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-4 border-0 p-0">
      <legend className="text-foreground mb-1 text-sm font-medium">Details</legend>
      {fields.map((detail) => {
        const error = errors?.[detail.name];
        const errorId = error ? `activity-detail-${detail.name}-error` : undefined;
        const hintId = detail.field.description ? `activity-detail-${detail.name}-hint` : undefined;
        const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

        return (
          <div key={detail.name} className="flex flex-col gap-1.5">
            <Label htmlFor={`activity-detail-${detail.name}`}>
              {detail.label}
              {detail.field.validation.required && (
                <span aria-hidden="true" className="text-destructive ml-0.5">
                  *
                </span>
              )}
            </Label>
            <FieldControl
              detail={detail}
              value={values[detail.name]}
              onChange={(next) => onChange(detail.name, next)}
              invalid={!!error}
              describedBy={describedBy}
            />
            {detail.field.description && (
              <p id={hintId} className="text-muted-foreground text-xs">
                {detail.field.description}
              </p>
            )}
            {error && (
              <p id={errorId} role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
