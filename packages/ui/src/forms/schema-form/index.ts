/**
 * Schema-Driven Form System
 *
 * Auto-generates form fields from Zod schemas with customization support.
 *
 * @example
 * ```tsx
 * import { SchemaForm, useSchemaForm, parseSchema } from "@loom-loyalty/ui/forms";
 * import { z } from "zod";
 *
 * const schema = z.object({
 *   name: z.string().min(1, "Required"),
 *   email: z.string().email(),
 *   role: z.enum(["admin", "user"]),
 * });
 *
 * // Option 1: Use SchemaForm component
 * function FormWithComponent() {
 *   return (
 *     <SchemaForm
 *       schema={schema}
 *       onSubmit={(data) => console.log(data)}
 *       overrides={{
 *         role: { label: "User Role" },
 *       }}
 *     />
 *   );
 * }
 *
 * // Option 2: Use hook for custom UI
 * function FormWithHook() {
 *   const form = useSchemaForm({ schema, onSubmit: handleSubmit });
 *
 *   return (
 *     <form onSubmit={form.handleSubmit}>
 *       {form.fields.map((field) => (
 *         <FormField key={field.name} {...form.getFieldProps(field.name)} />
 *       ))}
 *     </form>
 *   );
 * }
 * ```
 */

// Component
export { SchemaForm, createOverride } from "./schema-form";

// Hook
export { useSchemaForm } from "./use-schema-form";

// Schema utilities
export {
  fieldNameToLabel,
  getSchemaDefaults,
  parseSchema,
  validateField,
  validateSchema,
} from "./schema-parser";

// Field renderers
export {
  fieldRenderers,
  getFieldRenderer,
  registerFieldRenderer,
  renderField,
} from "./field-renderers";

// Types
export type {
  FieldConfig,
  FieldOption,
  FieldOverride,
  FieldRenderer,
  FieldRendererProps,
  FieldType,
  FormLayout,
  SchemaFormProps,
  UseSchemaFormOptions,
  UseSchemaFormReturn,
} from "./types";
