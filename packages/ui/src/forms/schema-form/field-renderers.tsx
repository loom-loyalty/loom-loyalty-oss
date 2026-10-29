"use client";

import type { ChangeEvent } from "react";

import { cn } from "../../lib/utils";
import { Checkbox } from "../../primitives/checkbox";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { RadioGroup, RadioGroupItem } from "../../primitives/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { Switch } from "../../primitives/switch";
import { Textarea } from "../../primitives/textarea";
import { MultiSelect } from "../multi-select";

import type { FieldRenderer, FieldRendererProps, FieldType } from "./types";

// ============================================
// Field Wrapper Component
// ============================================

interface FieldWrapperProps {
  config: FieldRendererProps["config"];
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function FieldWrapper({ config, error, children, className }: FieldWrapperProps) {
  const descriptionId = config.description ? `${config.name}-desc` : undefined;
  const errorId = error ? `${config.name}-error` : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={config.name} className={cn(error && "text-destructive")}>
        {config.label}
        {config.required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      {children}

      {config.description && !error && (
        <p id={descriptionId} className="text-muted-foreground text-sm">
          {config.description}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Text Field Renderer
// ============================================

function TextFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="text"
        value={(value as string) ?? ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
        minLength={config.min}
        maxLength={config.max}
      />
    </FieldWrapper>
  );
}

// ============================================
// Email Field Renderer
// ============================================

function EmailFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="email"
        value={(value as string) ?? ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder ?? "email@example.com"}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
      />
    </FieldWrapper>
  );
}

// ============================================
// Password Field Renderer
// ============================================

function PasswordFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="password"
        value={(value as string) ?? ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
        minLength={config.min}
        maxLength={config.max}
      />
    </FieldWrapper>
  );
}

// ============================================
// URL Field Renderer
// ============================================

function UrlFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="url"
        value={(value as string) ?? ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder ?? "https://example.com"}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
      />
    </FieldWrapper>
  );
}

// ============================================
// Tel Field Renderer
// ============================================

function TelFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="tel"
        value={(value as string) ?? ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
      />
    </FieldWrapper>
  );
}

// ============================================
// Number Field Renderer
// ============================================

function NumberFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="number"
        value={value !== undefined && value !== null ? String(value) : ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          onChange(val === "" ? undefined : Number(val));
        }}
        onBlur={onBlur}
        placeholder={config.placeholder}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
        min={config.min}
        max={config.max}
      />
    </FieldWrapper>
  );
}

// ============================================
// Textarea Field Renderer
// ============================================

function TextareaFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Textarea
        id={config.name}
        name={config.name}
        value={(value as string) ?? ""}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
        minLength={config.min}
        maxLength={config.max}
        rows={4}
      />
    </FieldWrapper>
  );
}

// ============================================
// Select Field Renderer
// ============================================

function SelectFieldRenderer({ config, value, error, onChange, disabled }: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Select
        value={(value as string) ?? ""}
        onValueChange={onChange}
        disabled={disabled || config.disabled}
      >
        <SelectTrigger
          id={config.name}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
          }
        >
          <SelectValue placeholder={config.placeholder ?? "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          {config.options?.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

// ============================================
// MultiSelect Field Renderer
// ============================================

function MultiSelectFieldRenderer({
  config,
  value,
  error,
  onChange,
  disabled,
}: FieldRendererProps) {
  const selectedValues = (value as string[]) ?? [];

  return (
    <FieldWrapper config={config} error={error}>
      <MultiSelect
        options={
          config.options?.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })) ?? []
        }
        value={selectedValues}
        onChange={onChange as (values: string[]) => void}
        placeholder={config.placeholder ?? "Select options"}
        disabled={disabled || config.disabled}
      />
    </FieldWrapper>
  );
}

// ============================================
// Checkbox Field Renderer
// ============================================

function CheckboxFieldRenderer({ config, value, error, onChange, disabled }: FieldRendererProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Checkbox
          id={config.name}
          checked={(value as boolean) ?? false}
          onCheckedChange={onChange}
          disabled={disabled || config.disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
          }
        />
        <Label htmlFor={config.name} className={cn("font-normal", error && "text-destructive")}>
          {config.label}
          {config.required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      </div>

      {config.description && !error && (
        <p id={`${config.name}-desc`} className="text-muted-foreground ml-7 text-sm">
          {config.description}
        </p>
      )}

      {error && (
        <p id={`${config.name}-error`} className="text-destructive ml-7 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Switch Field Renderer
// ============================================

function SwitchFieldRenderer({ config, value, error, onChange, disabled }: FieldRendererProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={config.name} className={cn("font-normal", error && "text-destructive")}>
          {config.label}
          {config.required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        <Switch
          id={config.name}
          checked={(value as boolean) ?? false}
          onCheckedChange={onChange}
          disabled={disabled || config.disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
          }
        />
      </div>

      {config.description && !error && (
        <p id={`${config.name}-desc`} className="text-muted-foreground text-sm">
          {config.description}
        </p>
      )}

      {error && (
        <p id={`${config.name}-error`} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Radio Field Renderer
// ============================================

function RadioFieldRenderer({ config, value, error, onChange, disabled }: FieldRendererProps) {
  return (
    <div className="space-y-3">
      <Label className={cn(error && "text-destructive")}>
        {config.label}
        {config.required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      <RadioGroup
        value={(value as string) ?? ""}
        onValueChange={onChange}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
      >
        {config.options?.map((option) => (
          <div key={option.value} className="flex items-center gap-3">
            <RadioGroupItem
              value={option.value}
              id={`${config.name}-${option.value}`}
              disabled={option.disabled}
            />
            <Label htmlFor={`${config.name}-${option.value}`} className="font-normal">
              {option.label}
              {option.description && (
                <span className="text-muted-foreground block text-sm">{option.description}</span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {config.description && !error && (
        <p id={`${config.name}-desc`} className="text-muted-foreground text-sm">
          {config.description}
        </p>
      )}

      {error && (
        <p id={`${config.name}-error`} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Date Field Renderer
// ============================================

function DateFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  // Convert Date to string for input, or use string directly
  const stringValue =
    value instanceof Date ? value.toISOString().split("T")[0] : ((value as string) ?? "");

  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="date"
        value={stringValue}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          // Return as string, let form handle conversion
          onChange(val || undefined);
        }}
        onBlur={onBlur}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
      />
    </FieldWrapper>
  );
}

// ============================================
// DateTime Field Renderer
// ============================================

function DateTimeFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  // Convert Date to string for input
  const stringValue =
    value instanceof Date ? value.toISOString().slice(0, 16) : ((value as string) ?? "");

  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="datetime-local"
        value={stringValue}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          onChange(val || undefined);
        }}
        onBlur={onBlur}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
      />
    </FieldWrapper>
  );
}

// ============================================
// Code Field Renderer
// ============================================

/**
 * Code field renderer - renders as a monospace text input.
 *
 * Note: For auto-generation from a source field, use the CodeInput component
 * directly with the sourceValue prop, or handle auto-generation at the form level.
 */
function CodeFieldRenderer({
  config,
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: FieldRendererProps) {
  return (
    <FieldWrapper config={config} error={error}>
      <Input
        id={config.name}
        name={config.name}
        type="text"
        value={(value as string) ?? ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder ?? "e.g., my-code"}
        disabled={disabled || config.disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${config.name}-error` : config.description ? `${config.name}-desc` : undefined
        }
        className="font-mono text-sm"
      />
    </FieldWrapper>
  );
}

// ============================================
// Hidden Field Renderer
// ============================================

function HiddenFieldRenderer({ config, value }: FieldRendererProps) {
  return <input type="hidden" name={config.name} value={(value as string) ?? ""} />;
}

// ============================================
// Field Renderer Registry
// ============================================

/**
 * Registry of built-in field renderers
 */
export const fieldRenderers: Record<FieldType, FieldRenderer> = {
  text: TextFieldRenderer,
  email: EmailFieldRenderer,
  password: PasswordFieldRenderer,
  url: UrlFieldRenderer,
  tel: TelFieldRenderer,
  number: NumberFieldRenderer,
  textarea: TextareaFieldRenderer,
  select: SelectFieldRenderer,
  multiselect: MultiSelectFieldRenderer,
  checkbox: CheckboxFieldRenderer,
  switch: SwitchFieldRenderer,
  radio: RadioFieldRenderer,
  date: DateFieldRenderer,
  datetime: DateTimeFieldRenderer,
  code: CodeFieldRenderer,
  hidden: HiddenFieldRenderer,
  custom: () => null, // Handled separately via override.component
};

/**
 * Custom renderer registry for user-defined field types
 */
const customRenderers: Map<string, FieldRenderer> = new Map();

/**
 * Register a custom field renderer
 *
 * @param type - Unique type identifier
 * @param renderer - React component to render the field
 *
 * @example
 * ```tsx
 * registerFieldRenderer('color', ColorPickerRenderer);
 * ```
 */
export function registerFieldRenderer(type: string, renderer: FieldRenderer): void {
  customRenderers.set(type, renderer);
}

/**
 * Get the renderer for a field type
 *
 * @param type - Field type
 * @returns Field renderer component or null if not found
 */
export function getFieldRenderer(type: FieldType | string): FieldRenderer | null {
  // Check custom renderers first
  const custom = customRenderers.get(type);
  if (custom) return custom;

  // Fall back to built-in renderers
  return fieldRenderers[type as FieldType] ?? null;
}

/**
 * Render a field using the appropriate renderer
 */
export function renderField(props: FieldRendererProps): React.ReactNode {
  const { config } = props;
  const Renderer = getFieldRenderer(config.type);

  if (!Renderer) {
    console.warn(`No renderer found for field type: ${config.type}`);
    return null;
  }

  return <Renderer {...props} />;
}
