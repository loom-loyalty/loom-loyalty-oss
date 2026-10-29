"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { z } from "zod";

import { getSchemaDefaults, parseSchema, validateField, validateSchema } from "./schema-parser";
import type { FieldRendererProps, UseSchemaFormOptions, UseSchemaFormReturn } from "./types";

/**
 * Hook for managing schema-driven form state.
 * Use this when you need more control than SchemaForm provides.
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * });
 *
 * function MyForm() {
 *   const form = useSchemaForm({
 *     schema,
 *     onSubmit: async (data) => {
 *       await saveData(data);
 *     },
 *   });
 *
 *   return (
 *     <form onSubmit={form.handleSubmit}>
 *       {form.fields.map((field) => (
 *         <div key={field.name}>
 *           <label>{field.label}</label>
 *           <input {...form.register(field.name)} />
 *           {form.errors[field.name] && (
 *             <span>{form.errors[field.name]}</span>
 *           )}
 *         </div>
 *       ))}
 *       <button type="submit" disabled={form.isSubmitting}>
 *         Submit
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useSchemaForm<TSchema extends z.ZodObject<z.ZodRawShape>>({
  schema,
  defaultValues: providedDefaults,
  overrides,
  onSubmit,
  onChange,
  mode = "onBlur",
}: UseSchemaFormOptions<TSchema>): UseSchemaFormReturn<TSchema> {
  // Parse schema into field configurations
  const fields = useMemo(() => parseSchema(schema, overrides), [schema, overrides]);

  // Get defaults from schema and merge with provided defaults
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

  // Track initial values for dirty checking
  const initialValuesRef = useRef(defaultValues);

  // Computed state
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);
  }, [values]);

  const isTouched = touched.size > 0;

  const isValid = useMemo(() => {
    const validationErrors = validateSchema(schema, values);
    return Object.keys(validationErrors).length === 0;
  }, [schema, values]);

  // Field value setter
  const setValue = useCallback(
    <K extends keyof z.infer<TSchema>>(key: K, value: z.infer<TSchema>[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        onChange?.(next as Partial<z.infer<TSchema>>);
        return next;
      });

      // Clear error for this field
      setErrors((prev) => {
        if (prev[key as string]) {
          const { [key as string]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });

      // Validate on change if mode is onChange
      if (mode === "onChange") {
        const error = validateField(schema, key as string, value);
        if (error) {
          setErrors((prev) => ({ ...prev, [key as string]: error }));
        }
      }
    },
    [schema, onChange, mode]
  );

  // Batch value setter
  const setValuesImpl = useCallback(
    (newValues: Partial<z.infer<TSchema>>) => {
      setValues((prev) => {
        const next = { ...prev, ...newValues };
        onChange?.(next as Partial<z.infer<TSchema>>);
        return next;
      });

      // Clear errors for updated fields
      const updatedFields = Object.keys(newValues);
      setErrors((prev) => {
        const next = { ...prev };
        for (const field of updatedFields) {
          delete next[field];
        }
        return next;
      });
    },
    [onChange]
  );

  // Get field props for custom rendering
  const getFieldProps = useCallback(
    (name: string): FieldRendererProps => {
      const fieldConfig = fields.find((f) => f.name === name);

      if (!fieldConfig) {
        throw new Error(`Field "${name}" not found in schema`);
      }

      return {
        config: fieldConfig,
        value: values[name as keyof typeof values],
        error: touched.has(name) ? errors[name] : undefined,
        onChange: (value: unknown) => {
          setValue(
            name as keyof z.infer<TSchema>,
            value as z.infer<TSchema>[keyof z.infer<TSchema>]
          );
          setTouched((prev) => new Set(prev).add(name));
        },
        onBlur: () => {
          setTouched((prev) => new Set(prev).add(name));

          // Validate on blur if mode is onBlur
          if (mode === "onBlur") {
            const error = validateField(schema, name, values[name as keyof typeof values]);
            if (error) {
              setErrors((prev) => ({ ...prev, [name]: error }));
            }
          }
        },
      };
    },
    [fields, values, errors, touched, mode, schema, setValue]
  );

  // Register function for uncontrolled inputs
  const register = useCallback(
    (name: string) => {
      return {
        name,
        value: values[name as keyof typeof values] ?? "",
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
          setValue(
            name as keyof z.infer<TSchema>,
            value as z.infer<TSchema>[keyof z.infer<TSchema>]
          );
        },
        onBlur: () => {
          setTouched((prev) => new Set(prev).add(name));

          if (mode === "onBlur") {
            const error = validateField(schema, name, values[name as keyof typeof values]);
            if (error) {
              setErrors((prev) => ({ ...prev, [name]: error }));
            }
          }
        },
      };
    },
    [values, mode, schema, setValue]
  );

  // Validate all fields
  const validate = useCallback(async (): Promise<boolean> => {
    const validationErrors = validateSchema(schema, values);
    setErrors(validationErrors);
    setTouched(new Set(fields.map((f) => f.name)));
    return Object.keys(validationErrors).length === 0;
  }, [schema, values, fields]);

  // Validate single field
  const validateFieldFn = useCallback(
    async (name: string): Promise<boolean> => {
      const error = validateField(schema, name, values[name as keyof typeof values]);
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }));
        return false;
      } else {
        setErrors((prev) => {
          const { [name]: _, ...rest } = prev;
          return rest;
        });
        return true;
      }
    },
    [schema, values]
  );

  // Error management
  const setError = useCallback((name: string, message: string) => {
    setErrors((prev) => ({ ...prev, [name]: message }));
  }, []);

  const clearError = useCallback((name: string) => {
    setErrors((prev) => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Form submission
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // Validate all fields
      const validationErrors = validateSchema(schema, values);

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        setTouched(new Set(fields.map((f) => f.name)));
        return;
      }

      if (!onSubmit) return;

      setIsSubmitting(true);

      try {
        await onSubmit(values as z.infer<TSchema>);
      } finally {
        setIsSubmitting(false);
      }
    },
    [schema, values, fields, onSubmit]
  );

  // Reset form to initial values
  const reset = useCallback(() => {
    setValues(initialValuesRef.current);
    setErrors({});
    setTouched(new Set());
    setIsSubmitting(false);
  }, []);

  return {
    // State
    values,
    errors,
    isValid,
    isSubmitting,
    isDirty,
    isTouched,

    // Field operations
    setValue,
    setValues: setValuesImpl,
    getFieldProps,
    register,

    // Validation
    validate,
    validateField: validateFieldFn,
    setError,
    clearError,
    clearErrors,

    // Form operations
    handleSubmit,
    reset,

    // Schema info
    fields,
  };
}
