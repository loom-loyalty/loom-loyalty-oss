"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { z } from "zod";

import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";

import { getFieldRenderer, renderField } from "./field-renderers";
import { getSchemaDefaults, parseSchema, validateSchema } from "./schema-parser";
import type { FieldConfig, FieldOverride, FieldRendererProps, SchemaFormProps } from "./types";

// ============================================
// Layout Configuration
// ============================================

const gapClasses = {
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
};

const columnClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

// ============================================
// Field Component
// ============================================

interface FieldProps {
  config: FieldConfig;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  disabled?: boolean;
  override?: FieldOverride;
}

function Field({ config, value, error, onChange, onBlur, disabled, override }: FieldProps) {
  const rendererProps: FieldRendererProps = {
    config,
    value,
    error,
    onChange,
    onBlur,
    disabled,
    className: override?.className,
  };

  // If there's a custom override component, render it directly
  if (override?.component) {
    const OverrideComponent = override.component;
    return <OverrideComponent {...rendererProps} />;
  }

  // Check if renderer exists for the type
  const renderer = getFieldRenderer(config.type);
  if (!renderer) {
    return null;
  }

  // Use the renderField function to avoid creating component during render
  return <>{renderField(rendererProps)}</>;
}

// ============================================
// SchemaForm Component
// ============================================

/**
 * Schema-driven form component that auto-generates fields from a Zod schema.
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   name: z.string().min(1, "Required"),
 *   email: z.string().email(),
 *   notify: z.boolean().optional(),
 * });
 *
 * function MyForm() {
 *   return (
 *     <SchemaForm
 *       schema={schema}
 *       onSubmit={(data) => console.log(data)}
 *       overrides={{
 *         email: { description: "We'll never share your email" },
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export function SchemaForm<TSchema extends z.ZodObject<z.ZodRawShape>>({
  schema,
  defaultValues: providedDefaults,
  onSubmit,
  onChange,
  overrides,
  layout = "vertical",
  columns = 2,
  gap = "md",
  disabled,
  showSubmit = true,
  submitText = "Submit",
  isLoading,
  children,
  className,
  id,
}: SchemaFormProps<TSchema>) {
  // Parse schema into field configurations (memoized)
  const fields = useMemo(() => parseSchema(schema, overrides), [schema, overrides]);

  // Get default values from schema + provided defaults
  const schemaDefaults = useMemo(() => getSchemaDefaults(schema), [schema]);
  const defaultValues = useMemo(
    () => ({ ...schemaDefaults, ...providedDefaults }),
    [schemaDefaults, providedDefaults]
  );

  // Form state
  const [values, setValues] = useState<Partial<z.infer<TSchema>>>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update a single field value
  const handleChange = useCallback(
    (fieldName: string, fieldValue: unknown) => {
      setValues((prev) => {
        const next = { ...prev, [fieldName]: fieldValue };
        onChange?.(next as Partial<z.infer<TSchema>>);
        return next;
      });

      // Clear error when value changes
      if (errors[fieldName]) {
        setErrors((prev) => {
          const { [fieldName]: _, ...rest } = prev;
          return rest;
        });
      }
    },
    [errors, onChange]
  );

  // Mark field as touched on blur
  const handleBlur = useCallback((fieldName: string) => {
    setTouched((prev) => new Set(prev).add(fieldName));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // Validate all fields
      const validationErrors = validateSchema(schema, values);

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        // Mark all fields as touched
        setTouched(new Set(fields.map((f) => f.name)));
        return;
      }

      setIsSubmitting(true);

      try {
        await onSubmit(values as z.infer<TSchema>);
      } finally {
        setIsSubmitting(false);
      }
    },
    [schema, values, fields, onSubmit]
  );

  // Determine if form is disabled
  const isDisabled = disabled || isLoading || isSubmitting;

  // Layout classes
  const layoutClasses = useMemo(() => {
    switch (layout) {
      case "horizontal":
        return cn("space-y-0", gapClasses[gap]);
      case "grid":
        return cn("grid", columnClasses[columns], gapClasses[gap]);
      case "vertical":
      default:
        return cn("flex flex-col", gapClasses[gap]);
    }
  }, [layout, columns, gap]);

  return (
    <form id={id} className={cn("space-y-6", className)} onSubmit={handleSubmit} noValidate>
      <div className={layoutClasses}>
        {fields.map((field) => {
          const override = overrides?.[field.name];
          const isFullWidth = override?.fullWidth || layout !== "grid";

          return (
            <div
              key={field.name}
              className={cn(isFullWidth && layout === "grid" && `col-span-${columns}`)}
              style={
                isFullWidth && layout === "grid" ? { gridColumn: `span ${columns}` } : undefined
              }
            >
              <Field
                config={field}
                value={values[field.name as keyof typeof values]}
                error={touched.has(field.name) ? errors[field.name] : undefined}
                onChange={(value) => handleChange(field.name, value)}
                onBlur={() => handleBlur(field.name)}
                disabled={isDisabled}
                override={override}
              />
            </div>
          );
        })}
      </div>

      {/* Custom children (replaces submit button) or default submit button */}
      {children ? (
        children
      ) : showSubmit ? (
        <Button
          type="submit"
          variant="primary-gradient"
          disabled={isDisabled}
          className="w-full sm:w-auto"
        >
          {isSubmitting || isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            submitText
          )}
        </Button>
      ) : null}
    </form>
  );
}

/**
 * Utility to create field override with proper typing
 */
export function createOverride(config: FieldOverride): FieldOverride {
  return config;
}
