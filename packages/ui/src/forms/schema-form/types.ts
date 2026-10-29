import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";

/**
 * Supported field types for schema-driven forms
 */
export type FieldType =
  | "text"
  | "number"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "textarea"
  | "select"
  | "multiselect"
  | "checkbox"
  | "switch"
  | "radio"
  | "date"
  | "datetime"
  | "code" // For slug/code fields with auto-generation
  | "hidden"
  | "custom";

/**
 * Option for select/multiselect/radio fields
 */
export interface FieldOption {
  /** Display label */
  label: string;
  /** Option value */
  value: string;
  /** Optional description */
  description?: string;
  /** Whether option is disabled */
  disabled?: boolean;
}

/**
 * Configuration for a single form field, derived from Zod schema
 */
export interface FieldConfig {
  /** Field name (path in form data) */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: FieldType;
  /** Whether field is required */
  required: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Help text / description */
  description?: string;
  /** Options for select/multiselect/radio fields */
  options?: FieldOption[];
  /** Minimum value (for number) or length (for string) */
  min?: number;
  /** Maximum value (for number) or length (for string) */
  max?: number;
  /** Validation pattern */
  pattern?: RegExp;
  /** Default value */
  defaultValue?: unknown;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Additional field-specific metadata */
  meta?: Record<string, unknown>;
}

/**
 * Props passed to field renderer components
 */
export interface FieldRendererProps {
  /** Field configuration */
  config: FieldConfig;
  /** Current field value */
  value: unknown;
  /** Error message if validation failed */
  error?: string;
  /** Called when value changes */
  onChange: (value: unknown) => void;
  /** Called when field loses focus */
  onBlur: () => void;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Field renderer component type
 */
export type FieldRenderer = ComponentType<FieldRendererProps>;

/**
 * Override configuration for specific fields
 */
export interface FieldOverride {
  /** Override auto-detected label */
  label?: string;
  /** Override placeholder */
  placeholder?: string;
  /** Add description/help text */
  description?: string;
  /** Force specific field type */
  type?: FieldType;
  /** Hide field from form */
  hidden?: boolean;
  /** Custom renderer component */
  component?: FieldRenderer;
  /** Field order (lower = first) */
  order?: number;
  /** Span full width in grid layout */
  fullWidth?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Transform value before display */
  transform?: (value: unknown) => unknown;
  /** Source field for auto-code generation (for 'code' type) */
  sourceField?: string;
  /** Options override for select/multiselect */
  options?: FieldOption[];
  /** Whether field is disabled */
  disabled?: boolean;
}

/**
 * Form layout options
 */
export type FormLayout = "vertical" | "horizontal" | "grid";

/**
 * Props for SchemaForm component
 */
export interface SchemaFormProps<TSchema extends z.ZodObject<z.ZodRawShape>> {
  /** Zod schema defining form fields */
  schema: TSchema;
  /** Initial/default values */
  defaultValues?: Partial<z.infer<TSchema>>;
  /** Called on successful validation and submit */
  onSubmit: (data: z.infer<TSchema>) => void | Promise<void>;
  /** Called when values change (for controlled forms) */
  onChange?: (data: Partial<z.infer<TSchema>>) => void;
  /** Field overrides for customization */
  overrides?: Record<string, FieldOverride>;
  /** Form layout */
  layout?: FormLayout;
  /** Number of columns for grid layout */
  columns?: 1 | 2 | 3 | 4;
  /** Gap between fields */
  gap?: "sm" | "md" | "lg";
  /** Disable all fields */
  disabled?: boolean;
  /** Show submit button */
  showSubmit?: boolean;
  /** Submit button text */
  submitText?: string;
  /** Loading state (disables form and shows spinner) */
  isLoading?: boolean;
  /** Custom footer (replaces default submit button) */
  children?: ReactNode;
  /** Additional class name for form element */
  className?: string;
  /** ID for form element */
  id?: string;
}

/**
 * Return type for useSchemaForm hook
 */
export interface UseSchemaFormReturn<TSchema extends z.ZodObject<z.ZodRawShape>> {
  // Form state
  /** Current form values */
  values: Partial<z.infer<TSchema>>;
  /** Field-level errors */
  errors: Record<string, string>;
  /** Whether form is valid */
  isValid: boolean;
  /** Whether form is submitting */
  isSubmitting: boolean;
  /** Whether form has been modified */
  isDirty: boolean;
  /** Whether form has been touched */
  isTouched: boolean;

  // Field operations
  /** Set a single field value */
  setValue: <K extends keyof z.infer<TSchema>>(key: K, value: z.infer<TSchema>[K]) => void;
  /** Set multiple field values */
  setValues: (values: Partial<z.infer<TSchema>>) => void;
  /** Get props for a field renderer */
  getFieldProps: (name: string) => FieldRendererProps;
  /** Register a field (for uncontrolled inputs) */
  register: (name: string) => {
    name: string;
    value: unknown;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
  };

  // Validation
  /** Validate all fields */
  validate: () => Promise<boolean>;
  /** Validate a single field */
  validateField: (name: string) => Promise<boolean>;
  /** Set an error for a field */
  setError: (name: string, message: string) => void;
  /** Clear error for a field */
  clearError: (name: string) => void;
  /** Clear all errors */
  clearErrors: () => void;

  // Form operations
  /** Handle form submission */
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  /** Reset form to initial values */
  reset: () => void;

  // Parsed schema info
  /** Field configurations parsed from schema */
  fields: FieldConfig[];
}

/**
 * Options for useSchemaForm hook
 */
export interface UseSchemaFormOptions<TSchema extends z.ZodObject<z.ZodRawShape>> {
  /** Zod schema for validation */
  schema: TSchema;
  /** Initial/default values */
  defaultValues?: Partial<z.infer<TSchema>>;
  /** Field overrides */
  overrides?: Record<string, FieldOverride>;
  /** Called on successful submission */
  onSubmit?: (data: z.infer<TSchema>) => void | Promise<void>;
  /** Called when values change */
  onChange?: (data: Partial<z.infer<TSchema>>) => void;
  /** Validation mode */
  mode?: "onBlur" | "onChange" | "onSubmit";
}
