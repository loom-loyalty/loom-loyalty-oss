/**
 * EntityEdit Component
 *
 * A schema-driven form component for creating and editing entities
 * based on a UI schema configuration.
 */

import type { UIEntitySchema, UIFieldConfig, UIFieldGroup } from "@loom-loyalty/schema";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { LocalizedStringInput, type LocalizedString } from "../forms/localized-string-input.js";
import { MetadataField } from "../forms/metadata-field/index.js";
import { cn } from "../lib/utils.js";
import { Badge } from "../primitives/badge.js";
import { Button } from "../primitives/button.js";
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
import { Separator } from "../primitives/separator.js";
import { Skeleton } from "../primitives/skeleton.js";
import { Switch } from "../primitives/switch.js";
import { Textarea } from "../primitives/textarea.js";
import { useReadOnly } from "../shell/read-only.js";

import type { EntityFieldChangeMeta } from "./entity-field.js";

const warnedMetadataMultiFields = new Set<string>();

/**
 * Entity data record type
 */
export type EntityRecord = Record<string, unknown>;

/**
 * Field error state
 */
export type FieldErrors = Record<string, string | undefined>;

/**
 * EntityEdit props
 */
export interface EntityEditProps {
  /** UI schema for the entity */
  schema: UIEntitySchema;
  /** Whether this is a create or edit form */
  mode: "create" | "edit";
  /** Initial form values (for edit mode) */
  initialValues?: EntityRecord;
  /** Form submission handler */
  onSubmit: (values: EntityRecord) => void | Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Form values change handler */
  onChange?: (values: EntityRecord) => void;
  /** Field validation handler */
  onValidate?: (field: string, value: unknown) => string | undefined;
  /** Custom field renderer */
  renderField?: (
    field: UIFieldConfig,
    value: unknown,
    onChange: (value: unknown) => void,
    error?: string
  ) => ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Submitting state */
  isSubmitting?: boolean;
  /** Field errors from external validation */
  errors?: FieldErrors;
  /** Additional class name */
  className?: string;
}

/**
 * Get default value for a field based on widget type
 */
function getDefaultValue(field: UIFieldConfig): unknown {
  switch (field.widget) {
    case "checkbox":
    case "switch":
      return false;
    case "number":
    case "currency":
    case "percentage":
      return undefined;
    case "multi-select":
    case "reference-multi":
    case "tags":
      return [];
    case "locale-tabbed-input":
      return {};
    default:
      return "";
  }
}

/**
 * Field input component
 */
function FieldInput({
  field,
  value,
  onChange,
  error,
  options,
}: {
  field: UIFieldConfig;
  value: unknown;
  onChange: (value: unknown, meta?: EntityFieldChangeMeta) => void;
  error?: string;
  options?: { value: string; label: string }[];
}): ReactNode {
  const id = `field-${field.name}`;
  const hasError = !!error;

  switch (field.widget) {
    case "locale-tabbed-input":
      return (
        <LocalizedStringInput
          id={id}
          value={(value ?? {}) as LocalizedString}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
        />
      );

    case "metadata-select": {
      if (!field.metadataType) {
        return (
          <Input
            id={id}
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
            className={cn(hasError && "border-destructive")}
          />
        );
      }
      if (Array.isArray(value)) {
        if (!warnedMetadataMultiFields.has(field.name)) {
          warnedMetadataMultiFields.add(field.name);
          console.warn(
            `[EntityEdit] metadata-select widget received array value for "${field.name}"; multi-select editing deferred — showing read-only list.`
          );
        }
        return (
          <div
            id={id}
            aria-labelledby={`${id}-label`}
            className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm"
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
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
          placeholder={field.placeholder}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
        />
      );
    }

    case "text":
    case "email":
    case "url":
    case "password":
      return (
        <Input
          id={id}
          type={
            field.widget === "password" ? "password" : field.widget === "email" ? "email" : "text"
          }
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={cn(hasError && "border-destructive")}
        />
      );

    case "textarea":
    case "markdown":
      return (
        <Textarea
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={5}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={cn(hasError && "border-destructive")}
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
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === "" ? undefined : Number(val));
          }}
          placeholder={field.placeholder}
          step={field.widget === "currency" ? "0.01" : field.widget === "percentage" ? "0.1" : "1"}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={cn(hasError && "border-destructive")}
        />
      );

    case "checkbox":
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
          />
          {field.helpText && (
            <span className="text-muted-foreground text-sm">{field.helpText}</span>
          )}
        </div>
      );

    case "switch":
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
          />
          {field.helpText && (
            <span className="text-muted-foreground text-sm">{field.helpText}</span>
          )}
        </div>
      );

    case "select":
    case "reference":
      return (
        <Select value={String(value ?? "")} onValueChange={(val) => onChange(val)}>
          <SelectTrigger
            id={id}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
            className={cn(hasError && "border-destructive")}
          >
            <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={value ? String(value).split("T")[0] : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={cn(hasError && "border-destructive")}
        />
      );

    case "datetime":
      return (
        <Input
          id={id}
          type="datetime-local"
          value={value ? String(value).slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={cn(hasError && "border-destructive")}
        />
      );

    case "time":
      return (
        <Input
          id={id}
          type="time"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={cn(hasError && "border-destructive")}
        />
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="color"
            value={String(value ?? "#000000")}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-14 p-1"
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
          />
          <Input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className={cn("flex-1", hasError && "border-destructive")}
          />
        </div>
      );

    case "tags":
      return (
        <TagsInput
          id={id}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          placeholder={field.placeholder || "Add tag..."}
          hasError={hasError}
        />
      );

    case "json":
    case "code":
      return (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={field.placeholder}
          rows={8}
          className={cn("font-mono text-sm", hasError && "border-destructive")}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
        />
      );

    case "hidden":
      return <input type="hidden" value={String(value ?? "")} />;

    case "readonly":
      return (
        <div id={id} aria-labelledby={`${id}-label`} className="text-muted-foreground py-2 text-sm">
          {String(value ?? "—")}
        </div>
      );

    default:
      return (
        <Input
          id={id}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={cn(hasError && "border-destructive")}
        />
      );
  }
}

/**
 * Simple tags input component
 */
function TagsInput({
  id,
  value,
  onChange,
  placeholder,
  hasError,
}: {
  id: string;
  value: unknown[];
  onChange: (value: unknown[]) => void;
  placeholder?: string;
  hasError?: boolean;
}): ReactNode {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div
      className={cn(
        "focus-within:ring-ring flex flex-wrap gap-2 rounded-md border p-2 focus-within:ring-2",
        hasError && "border-destructive"
      )}
    >
      {value.map((tag, index) => (
        <Badge key={index} variant="secondary" className="gap-1">
          {String(tag)}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="hover:text-foreground ml-1 rounded-full"
            aria-label={`Remove ${String(tag)}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        aria-describedby={hasError ? `${id}-error` : undefined}
      />
    </div>
  );
}

/**
 * Form field wrapper component
 */
function FormField({
  field,
  value,
  onChange,
  error,
  renderField,
  options,
}: {
  field: UIFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  renderField?: EntityEditProps["renderField"];
  options?: { value: string; label: string }[];
}): ReactNode {
  const id = `field-${field.name}`;

  // Skip hidden fields visually
  if (field.widget === "hidden") {
    return <input type="hidden" name={field.name} value={String(value ?? "")} />;
  }

  // Custom renderer
  if (renderField) {
    const customElement = renderField(field, value, onChange, error);
    if (customElement !== undefined) {
      return customElement;
    }
  }

  // Checkbox/switch don't need labels above them
  const isInlineLabel = field.widget === "checkbox" || field.widget === "switch";

  return (
    <div className="space-y-2">
      {!isInlineLabel && (
        <Label id={`${id}-label`} htmlFor={id} className={cn(error && "text-destructive")}>
          {field.label}
          {/* Required indicator could go here */}
        </Label>
      )}
      {isInlineLabel && (
        <Label id={`${id}-label`} htmlFor={id} className={cn(error && "text-destructive")}>
          {field.label}
        </Label>
      )}
      <FieldInput field={field} value={value} onChange={onChange} error={error} options={options} />
      {error && (
        <p id={`${id}-error`} className="text-destructive flex items-center gap-1 text-sm">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      {!error && field.helpText && !isInlineLabel && (
        <p className="text-muted-foreground text-sm">{field.helpText}</p>
      )}
    </div>
  );
}

/**
 * Form group component
 */
function FormGroup({
  group,
  fields,
  values,
  errors,
  onChange,
  renderField,
}: {
  group: UIFieldGroup;
  fields: Record<string, UIFieldConfig>;
  values: EntityRecord;
  errors?: FieldErrors;
  onChange: (fieldName: string, value: unknown) => void;
  renderField?: EntityEditProps["renderField"];
}): ReactNode {
  const groupFields = group.fields.filter((name) => fields[name]);

  if (groupFields.length === 0) return null;

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-medium">{group.label}</legend>
      {group.description && <p className="text-muted-foreground text-sm">{group.description}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {groupFields.map((fieldName) => {
          const field = fields[fieldName];
          if (!field) return null;

          // Full width for textarea-like fields
          const isFullWidth =
            field.widget === "textarea" ||
            field.widget === "markdown" ||
            field.widget === "json" ||
            field.widget === "code" ||
            field.widget === "rich-text";

          return (
            <div key={fieldName} className={cn(isFullWidth && "md:col-span-2")}>
              <FormField
                field={field}
                value={values[fieldName] ?? getDefaultValue(field)}
                onChange={(value) => onChange(fieldName, value)}
                error={errors?.[fieldName]}
                renderField={renderField}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * EntityEdit component
 */
export function EntityEdit({
  schema,
  mode,
  initialValues = {},
  onSubmit,
  onCancel,
  onChange,
  onValidate,
  renderField,
  isLoading = false,
  isSubmitting = false,
  errors: externalErrors,
  className,
}: EntityEditProps): ReactNode {
  const [values, setValues] = useState<EntityRecord>(() => {
    // Initialize values from initialValues or defaults
    const initial: EntityRecord = { ...initialValues };
    const formConfig = mode === "create" ? schema.create : schema.edit;

    formConfig.groups.forEach((group) => {
      group.fields.forEach((fieldName) => {
        const field = schema.fields[fieldName];
        if (field && initial[fieldName] === undefined) {
          initial[fieldName] = getDefaultValue(field);
        }
      });
    });

    return initial;
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Merge external errors with local validation errors
  const errors: FieldErrors = { ...fieldErrors, ...externalErrors };

  const formConfig = mode === "create" ? schema.create : schema.edit;

  const handleFieldChange = (fieldName: string, value: unknown) => {
    const newValues = { ...values, [fieldName]: value };
    setValues(newValues);
    setTouched((prev) => ({ ...prev, [fieldName]: true }));

    // Validate if field was touched
    if (onValidate && touched[fieldName]) {
      const error = onValidate(fieldName, value);
      setFieldErrors((prev) => ({ ...prev, [fieldName]: error }));
    }

    onChange?.(newValues);
  };

  const { readOnly, reason: readOnlyReason } = useReadOnly();
  const readOnlyNoteId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    // Validate all fields before submission
    if (onValidate) {
      const newErrors: FieldErrors = {};
      let hasErrors = false;

      formConfig.groups.forEach((group) => {
        group.fields.forEach((fieldName) => {
          const error = onValidate(fieldName, values[fieldName]);
          if (error) {
            newErrors[fieldName] = error;
            hasErrors = true;
          }
        });
      });

      if (hasErrors) {
        setFieldErrors(newErrors);
        return;
      }
    }

    await onSubmit(values);
  };

  const handleReset = () => {
    setValues(initialValues);
    setFieldErrors({});
    setTouched({});
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, fieldIndex) => (
                <div key={fieldIndex} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-8", className)}>
      {/* Form groups */}
      {formConfig.groups.map((group, index) => (
        <div key={group.id}>
          {index > 0 && <Separator className="mb-8" />}
          <FormGroup
            group={group}
            fields={schema.fields}
            values={values}
            errors={errors}
            onChange={handleFieldChange}
            renderField={renderField}
          />
        </div>
      ))}

      {/* Form actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {readOnly && (
          <p id={readOnlyNoteId} className="text-muted-foreground mr-auto text-sm">
            {readOnlyReason}
          </p>
        )}
        {formConfig.showReset && mode === "create" && (
          <Button type="button" variant="ghost" onClick={handleReset} disabled={isSubmitting}>
            Reset
          </Button>
        )}
        {formConfig.showCancel && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {formConfig.cancelLabel || "Cancel"}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary-gradient"
          disabled={isSubmitting || readOnly}
          aria-describedby={readOnly ? readOnlyNoteId : undefined}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {formConfig.submitLabel || (mode === "create" ? "Create" : "Save Changes")}
        </Button>
      </div>
    </form>
  );
}
