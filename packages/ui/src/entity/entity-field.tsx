/**
 * EntityField
 *
 * Generic field renderer that uses widget type from the schema.
 * Renders appropriate form inputs or display values based on mode.
 */

import { formatDateTime, formatShortDate } from "@loom-loyalty/core";
import type { UIFieldConfig } from "@loom-loyalty/schema";
import type { ReactNode } from "react";

import { LocalizedStringInput, type LocalizedString } from "../forms/localized-string-input.js";
import { MetadataField } from "../forms/metadata-field/index.js";
import { safeHref, safeMailto } from "../lib/safe-href.js";
import { Badge } from "../primitives/badge.js";
import { Checkbox } from "../primitives/checkbox.js";
import { Input } from "../primitives/input.js";
import { Label } from "../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select.js";
import { Switch } from "../primitives/switch.js";
import { Textarea } from "../primitives/textarea.js";
import { formatLocalizedFieldValue } from "./format-utils.js";

const warnedReferenceFields = new Set<string>();
const warnedMetadataMultiFields = new Set<string>();

/** @internal Test-only: reset the reference-field warn-once Set between test runs. */
export function __resetWarnedReferenceFields(): void {
  warnedReferenceFields.clear();
}

/** @internal Test-only: reset the metadata-multi warn-once Set between test runs. */
export function __resetWarnedMetadataMultiFields(): void {
  warnedMetadataMultiFields.clear();
}

export interface EntityFieldChangeMeta {
  /** When the value came from a suggested-but-not-yet-stored MetadataField option,
   *  the consumer must auto-create the metadata before submitting the parent entity. */
  isSuggested?: boolean;
}

export interface EntityFieldProps {
  /** Field configuration from schema */
  field: UIFieldConfig;
  /** Current field value */
  value: unknown;
  /** Display mode */
  mode: "view" | "edit";
  /** Callback when value changes (edit mode) */
  onChange?: (value: unknown, meta?: EntityFieldChangeMeta) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Renders a field based on its widget type
 */
export function EntityField({
  field,
  value,
  mode,
  onChange,
  disabled = false,
}: EntityFieldProps): ReactNode {
  if (mode === "view") {
    return <FieldDisplay field={field} value={value} />;
  }

  return <FieldInput field={field} value={value} onChange={onChange} disabled={disabled} />;
}

/**
 * Display component for view mode
 */
interface FieldDisplayProps {
  field: UIFieldConfig;
  value: unknown;
}

function FieldDisplay({ field, value }: FieldDisplayProps): ReactNode {
  const displayValue = formatFieldValue(field, value);

  return (
    <div>
      <p className="text-muted-foreground text-sm">{field.label}</p>
      <div className="text-foreground mt-1 font-medium">{displayValue}</div>
    </div>
  );
}

/**
 * Format a field value for display based on display format
 */
function formatFieldValue(field: UIFieldConfig, value: unknown): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const localized = formatLocalizedFieldValue(field, value);
  if (localized !== null) return localized;

  switch (field.displayFormat) {
    case "date":
      return formatShortDate(value as string) ?? "—";

    case "datetime":
      return formatDateTime(value as string) ?? "—";

    case "boolean":
      return (
        <span className={value ? "text-success-dark" : "text-muted-foreground"}>
          {value ? "Yes" : "No"}
        </span>
      );

    case "badge":
    case "status":
      return (
        <Badge variant="secondary" className="font-normal">
          {String(value)}
        </Badge>
      );

    case "number":
    case "currency":
    case "percentage":
      if (field.displayFormat === "currency") {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number(value));
      }
      if (field.displayFormat === "percentage") {
        return `${Number(value).toFixed(1)}%`;
      }
      return Number(value).toLocaleString();

    case "email": {
      const href = safeMailto(value);
      return href ? (
        <a href={href} className="text-primary hover:underline">
          {String(value)}
        </a>
      ) : (
        <span>{String(value)}</span>
      );
    }

    case "link": {
      const href = safeHref(value);
      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {String(value)}
        </a>
      ) : (
        <span>{String(value)}</span>
      );
    }

    case "json":
      return (
        <pre className="bg-muted text-foreground max-h-32 overflow-auto rounded p-2 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      );

    case "tags":
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((tag, index) => (
              <Badge key={index} variant="outline" className="font-normal">
                {String(tag)}
              </Badge>
            ))}
          </div>
        );
      }
      return String(value);

    case "textarea":
    case "rich-text":
      return <p className="whitespace-pre-wrap">{String(value)}</p>;

    default:
      return String(value);
  }
}

/**
 * Input component for edit mode
 */
interface FieldInputProps {
  field: UIFieldConfig;
  value: unknown;
  onChange?: (value: unknown, meta?: EntityFieldChangeMeta) => void;
  disabled: boolean;
}

function FieldInput({ field, value, onChange, disabled }: FieldInputProps): ReactNode {
  const handleChange = (newValue: unknown, meta?: EntityFieldChangeMeta) => {
    onChange?.(newValue, meta);
  };

  const id = `field-${field.name}`;
  return (
    <div className="space-y-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {field.label}
        {field.helpText && (
          <span className="text-muted-foreground ml-1 font-normal">({field.helpText})</span>
        )}
      </Label>
      <WidgetInput field={field} value={value} onChange={handleChange} disabled={disabled} />
    </div>
  );
}

/**
 * Widget input based on widget type
 */
interface WidgetInputProps {
  field: UIFieldConfig;
  value: unknown;
  onChange: (value: unknown, meta?: EntityFieldChangeMeta) => void;
  disabled: boolean;
}

function WidgetInput({ field, value, onChange, disabled }: WidgetInputProps): ReactNode {
  const widget = field.widget;
  const id = `field-${field.name}`;

  switch (widget) {
    case "textarea":
      return (
        <Textarea
          id={id}
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
        />
      );

    case "number":
    case "currency":
    case "percentage":
      return (
        <Input
          id={id}
          type="number"
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={field.placeholder}
          disabled={disabled}
          step={widget === "percentage" ? "0.1" : "1"}
        />
      );

    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
          />
          <Label htmlFor={id} className="text-sm font-normal">
            {field.placeholder ?? "Enabled"}
          </Label>
        </div>
      );

    case "switch":
      return (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
          />
          <span className="text-muted-foreground text-sm">{value ? "Enabled" : "Disabled"}</span>
        </div>
      );

    case "select": {
      // Get options from widgetProps if available
      const options = (field.widgetProps?.options as Array<{ value: string; label: string }>) ?? [];
      return (
        <Select
          value={value != null ? String(value) : ""}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={field.placeholder ?? "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={value != null ? String(value).split("T")[0] : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );

    case "datetime":
      return (
        <Input
          id={id}
          type="datetime-local"
          value={value != null ? String(value).slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );

    case "time":
      return (
        <Input
          id={id}
          type="time"
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );

    case "email":
      return (
        <Input
          id={id}
          type="email"
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? "email@example.com"}
          disabled={disabled}
        />
      );

    case "url":
      return (
        <Input
          id={id}
          type="url"
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? "https://..."}
          disabled={disabled}
        />
      );

    case "password":
      return (
        <Input
          id={id}
          type="password"
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );

    case "json":
    case "code":
      return (
        <Textarea
          id={id}
          value={
            value != null
              ? typeof value === "string"
                ? value
                : JSON.stringify(value, null, 2)
              : ""
          }
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={field.placeholder ?? "{}"}
          disabled={disabled}
          rows={6}
          className="font-mono text-sm"
        />
      );

    case "hidden":
      return <input type="hidden" value={value != null ? String(value) : ""} />;

    case "readonly":
      return (
        <div
          id={id}
          aria-labelledby={`${id}-label`}
          className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm"
        >
          {value != null ? String(value) : "—"}
        </div>
      );

    case "locale-tabbed-input":
      return (
        <LocalizedStringInput
          id={id}
          value={(value ?? {}) as LocalizedString}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          placeholder={field.placeholder}
        />
      );

    case "metadata-select": {
      if (!field.metadataType) {
        return (
          <Input
            id={id}
            type="text"
            value={value != null ? String(value) : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );
      }
      if (Array.isArray(value)) {
        if (!warnedMetadataMultiFields.has(field.name)) {
          warnedMetadataMultiFields.add(field.name);
          console.warn(
            `[EntityField] metadata-select widget received array value for "${field.name}"; multi-select rendering deferred — showing read-only list.`
          );
        }
        return (
          <div
            id={id}
            aria-labelledby={`${id}-label`}
            className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm"
          >
            {value.length > 0 ? value.map((v) => String(v)).join(", ") : "—"}
          </div>
        );
      }
      return (
        <MetadataField
          id={id}
          typeCode={field.metadataType}
          typeLabel={field.label}
          value={value != null ? String(value) : ""}
          onValueChange={(v, isSuggested) => onChange(v, { isSuggested })}
          disabled={disabled}
          placeholder={field.placeholder}
        />
      );
    }

    case "reference":
    case "reference-multi":
      if (!warnedReferenceFields.has(field.name)) {
        warnedReferenceFields.add(field.name);
        console.warn(
          `[EntityField] reference widget for "${field.name}" (entityCode=${field.entityCode ?? "unknown"}) falling back to text input. Per-entity wrapper dispatch lands in 0.10b.`
        );
      }
      return (
        <Input
          id={id}
          type="text"
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );

    // Default to text input
    case "text":
    default:
      return (
        <Input
          id={id}
          type="text"
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );
  }
}
