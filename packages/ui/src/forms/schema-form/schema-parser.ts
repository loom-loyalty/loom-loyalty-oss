import { z } from "zod";

import type { FieldConfig, FieldOption, FieldOverride, FieldType } from "./types";

/**
 * Convert a field name to a human-readable label
 * @example
 * fieldNameToLabel('firstName') // 'First Name'
 * fieldNameToLabel('email_address') // 'Email Address'
 * fieldNameToLabel('programId') // 'Program ID'
 */
export function fieldNameToLabel(name: string): string {
  return (
    name
      // Handle camelCase
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Handle snake_case
      .replace(/_/g, " ")
      // Handle kebab-case
      .replace(/-/g, " ")
      // Capitalize first letter of each word
      .replace(/\b\w/g, (char) => char.toUpperCase())
      // Special case: ID should be uppercase
      .replace(/\bId\b/g, "ID")
      .trim()
  );
}

/**
 * Unwrap optional, nullable, and default wrappers to get the inner type
 */
function unwrapType(zodType: z.ZodTypeAny): {
  innerType: z.ZodTypeAny;
  isOptional: boolean;
  isNullable: boolean;
  defaultValue?: unknown;
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let innerType: any = zodType;
  let isOptional = false;
  let isNullable = false;
  let defaultValue: unknown;

  // Keep unwrapping until we get to the base type
  while (true) {
    if (innerType instanceof z.ZodOptional) {
      isOptional = true;
      innerType = innerType.unwrap();
    } else if (innerType instanceof z.ZodNullable) {
      isNullable = true;
      innerType = innerType.unwrap();
    } else if (innerType instanceof z.ZodDefault) {
      const raw = innerType._def.defaultValue;
      defaultValue = typeof raw === "function" ? raw() : raw;
      innerType = innerType._def.innerType;
    } else {
      break;
    }
  }

  return { innerType, isOptional, isNullable, defaultValue };
}

/**
 * Extract options from a Zod enum type.
 * In Zod v4, both z.enum() and z.nativeEnum() return ZodEnum.
 * For native enums, entries have different keys/values (e.g. {Active: 'active'}).
 * For regular enums, keys equal values (e.g. {active: 'active'}).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEnumOptions(zodType: z.ZodEnum<any>): FieldOption[] {
  const entries = zodType._def.entries as Record<string, string>;
  return Object.entries(entries).map(([key, value]) => ({
    label: fieldNameToLabel(key),
    value: String(value),
  }));
}

/**
 * Determine the field type from a Zod type
 */
function zodTypeToFieldType(zodType: z.ZodTypeAny): FieldType {
  const { innerType } = unwrapType(zodType);

  // String types with specific format checks
  if (innerType instanceof z.ZodString) {
    // Zod v4: use .format property for email/url detection
    const format = (innerType as z.ZodString & { format?: string }).format;
    if (format === "email") return "email";
    if (format === "url") return "url";

    // Check for long text hint (maxLength > 200 suggests textarea)
    const maxLength = (innerType as z.ZodString & { maxLength?: number | null }).maxLength;
    if (maxLength && maxLength > 200) return "textarea";

    return "text";
  }

  // Number types
  if (innerType instanceof z.ZodNumber) {
    return "number";
  }

  // Boolean types
  if (innerType instanceof z.ZodBoolean) {
    return "checkbox";
  }

  // Enum types (includes both z.enum() and z.nativeEnum() in v4)
  if (innerType instanceof z.ZodEnum) {
    return "select";
  }

  // Array types (for multiselect)
  if (innerType instanceof z.ZodArray) {
    return "multiselect";
  }

  // Date types
  if (innerType instanceof z.ZodDate) {
    return "date";
  }

  // Literal types (typically used with unions for radio groups)
  if (innerType instanceof z.ZodLiteral) {
    return "radio";
  }

  // Union of literals (radio group)
  if (innerType instanceof z.ZodUnion) {
    const options = innerType._def.options;
    if (
      Array.isArray(options) &&
      options.every((opt: z.ZodTypeAny) => opt instanceof z.ZodLiteral)
    ) {
      return "radio";
    }
  }

  // Default to text
  return "text";
}

/**
 * Extract constraints from a Zod type.
 * In Zod v4, use direct properties (.minLength, .maxLength, .minValue, .maxValue)
 * instead of iterating _def.checks.
 */
function extractConstraints(zodType: z.ZodTypeAny): {
  min?: number;
  max?: number;
  pattern?: RegExp;
} {
  const { innerType } = unwrapType(zodType);
  const constraints: { min?: number; max?: number; pattern?: RegExp } = {};

  if (innerType instanceof z.ZodString) {
    const str = innerType as z.ZodString & {
      minLength?: number | null;
      maxLength?: number | null;
    };
    if (str.minLength != null) constraints.min = str.minLength;
    if (str.maxLength != null) constraints.max = str.maxLength;
  }

  if (innerType instanceof z.ZodNumber) {
    const num = innerType as z.ZodNumber & {
      minValue?: number | null;
      maxValue?: number | null;
    };
    if (num.minValue != null) constraints.min = num.minValue;
    if (num.maxValue != null) constraints.max = num.maxValue;
  }

  return constraints;
}

/**
 * Extract options from enum/union types
 */
function extractOptions(zodType: z.ZodTypeAny): FieldOption[] | undefined {
  const { innerType } = unwrapType(zodType);

  // Enum types (covers both z.enum() and z.nativeEnum() in v4)
  if (innerType instanceof z.ZodEnum) {
    return extractEnumOptions(innerType);
  }

  // Union of literals
  if (innerType instanceof z.ZodUnion) {
    const options = innerType._def.options as z.ZodTypeAny[];
    if (options.every((opt) => opt instanceof z.ZodLiteral)) {
      return options.map((opt) => {
        // In Zod v4, ZodLiteral._def.values is an array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values = (opt as z.ZodLiteral<any>)._def.values as unknown[];
        const value = String(values[0]);
        return {
          label: fieldNameToLabel(value),
          value,
        };
      });
    }
  }

  // Array with enum inner type
  if (innerType instanceof z.ZodArray) {
    const elementType = innerType._def.element;
    if (elementType instanceof z.ZodEnum) {
      return extractEnumOptions(elementType);
    }
  }

  return undefined;
}

/**
 * Widget hint embedded in Zod `.describe()` strings by the schema-dsl compiler.
 * Format: `<!-- widget:{"type":"select",...} -->`
 */
interface WidgetHint {
  widget?: string;
  placeholder?: string;
  helpText?: string;
  metadataType?: string;
  entityType?: string;
}

function extractWidgetHint(description?: string): WidgetHint | null {
  if (!description) return null;
  const match = description.match(/<!-- widget:(.*?) -->/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as WidgetHint;
  } catch {
    return null;
  }
}

/** Valid widget hint types that map to FieldType */
const VALID_WIDGET_FIELD_TYPES = new Set<string>([
  "text",
  "number",
  "email",
  "password",
  "url",
  "tel",
  "textarea",
  "select",
  "multiselect",
  "checkbox",
  "switch",
  "radio",
  "date",
  "datetime",
  "code",
  "hidden",
  "custom",
]);

/**
 * Parse a single field from a Zod schema
 */
function parseField(
  name: string,
  zodType: z.ZodTypeAny,
  override?: FieldOverride
): FieldConfig | null {
  // Skip hidden fields
  if (override?.hidden) {
    return null;
  }

  const { isOptional, isNullable, defaultValue } = unwrapType(zodType);
  const constraints = extractConstraints(zodType);
  const options = override?.options ?? extractOptions(zodType);

  const config: FieldConfig = {
    name,
    label: override?.label ?? fieldNameToLabel(name),
    type: override?.type ?? zodTypeToFieldType(zodType),
    required: !isOptional && !isNullable && defaultValue === undefined,
    placeholder: override?.placeholder,
    description: override?.description,
    options,
    min: constraints.min,
    max: constraints.max,
    pattern: constraints.pattern,
    defaultValue,
    disabled: override?.disabled,
    meta: {
      fullWidth: override?.fullWidth,
      className: override?.className,
      order: override?.order,
    },
  };

  // Check for widget hints embedded in Zod .describe() strings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const innerDescription = (unwrapType(zodType).innerType as any).description as string | undefined;
  const widgetHint = extractWidgetHint(innerDescription);

  if (widgetHint) {
    // Override type with widget hint if it maps to a valid FieldType
    if (widgetHint.widget && VALID_WIDGET_FIELD_TYPES.has(widgetHint.widget) && !override?.type) {
      config.type = widgetHint.widget as FieldType;
    }

    // Set placeholder from hint if not already set by override
    if (widgetHint.placeholder && !config.placeholder) {
      config.placeholder = widgetHint.placeholder;
    }

    // Set description from hint's helpText if not already set
    if (widgetHint.helpText && !config.description) {
      config.description = widgetHint.helpText;
    }

    // Store metadataType and entityType in meta
    if (widgetHint.metadataType) {
      config.meta = { ...config.meta, metadataType: widgetHint.metadataType };
    }
    if (widgetHint.entityType) {
      config.meta = { ...config.meta, entityType: widgetHint.entityType };
    }
  }

  return config;
}

/**
 * Parse a Zod object schema into field configurations
 *
 * @param schema - Zod object schema to parse
 * @param overrides - Optional field overrides for customization
 * @returns Array of field configurations
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 *   remember: z.boolean().optional(),
 * });
 *
 * const fields = parseSchema(schema, {
 *   password: { type: 'password', description: 'At least 8 characters' },
 *   remember: { label: 'Remember me' },
 * });
 * ```
 */
export function parseSchema(
  schema: z.ZodObject<z.ZodRawShape>,
  overrides?: Record<string, FieldOverride>
): FieldConfig[] {
  const shape = schema.shape;
  const fields: FieldConfig[] = [];

  for (const [name, zodType] of Object.entries(shape)) {
    const override = overrides?.[name];
    const config = parseField(name, zodType as z.ZodTypeAny, override);

    if (config) {
      fields.push(config);
    }
  }

  // Sort by order if specified
  fields.sort((a, b) => {
    const orderA = (a.meta?.order as number) ?? Infinity;
    const orderB = (b.meta?.order as number) ?? Infinity;
    return orderA - orderB;
  });

  return fields;
}

/**
 * Get the default values from a Zod schema
 */
export function getSchemaDefaults<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T
): Partial<z.infer<T>> {
  const shape = schema.shape;
  const defaults: Record<string, unknown> = {};

  for (const [name, zodType] of Object.entries(shape)) {
    const { defaultValue } = unwrapType(zodType as z.ZodTypeAny);
    if (defaultValue !== undefined) {
      defaults[name] = defaultValue;
    }
  }

  return defaults as Partial<z.infer<T>>;
}

/**
 * Validate a value against a Zod schema field
 */
export function validateField(
  schema: z.ZodObject<z.ZodRawShape>,
  fieldName: string,
  value: unknown
): string | undefined {
  const shape = schema.shape;
  const fieldSchema = shape[fieldName];

  if (!fieldSchema) {
    return undefined;
  }

  const result = (fieldSchema as z.ZodTypeAny).safeParse(value);

  if (!result.success) {
    return result.error.issues[0]?.message;
  }

  return undefined;
}

/**
 * Validate all values against a Zod schema
 */
export function validateSchema<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  values: Partial<z.infer<T>>
): Record<string, string> {
  const result = schema.safeParse(values);

  if (result.success) {
    return {};
  }

  const errors: Record<string, string> = {};

  for (const error of result.error.issues) {
    const path = error.path.join(".");
    if (!errors[path]) {
      errors[path] = error.message;
    }
  }

  return errors;
}
