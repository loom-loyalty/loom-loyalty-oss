/**
 * JSON Schema Parser
 *
 * Parses JSON Schema definitions into ParsedField and ParsedEntitySchema structures.
 */

import type {
  EntityReference,
  FieldDataType,
  FieldFormat,
  FieldValidation,
  ParsedEntitySchema,
  ParsedField,
} from "../types/schema.js";

/**
 * JSON Schema property definition
 */
interface JSONSchemaProperty {
  type?: string | string[];
  format?: string;
  description?: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  $ref?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  title?: string;
  // Extensions
  "x-entity-ref"?: string;
  "x-display-field"?: string;
}

/**
 * JSON Schema definition
 */
interface JSONSchema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  // Extensions
  "x-entity-code"?: string;
  "x-primary-key"?: string;
  "x-display-field"?: string;
  "x-created-at"?: string;
  "x-updated-at"?: string;
}

/**
 * Parser options
 */
export interface JSONSchemaParserOptions {
  /** Resolve $ref references using this map */
  definitions?: Record<string, JSONSchema>;
  /** Default primary key field name */
  defaultPrimaryKey?: string;
  /** Entity code (if not in schema) */
  entityCode?: string;
  /** Entity name (if not in schema) */
  entityName?: string;
}

/**
 * Convert JSON Schema type to our FieldDataType
 */
function mapJSONSchemaType(
  schemaType: string | string[] | undefined,
  format?: string
): FieldDataType {
  // Handle nullable types
  const type = Array.isArray(schemaType) ? schemaType.find((t) => t !== "null") : schemaType;

  // Check format first for more specific types
  if (format) {
    switch (format) {
      case "date":
        return "date";
      case "date-time":
        return "datetime";
      case "time":
        return "time";
      case "email":
        return "email";
      case "uri":
      case "url":
        return "url";
      case "uuid":
        return "uuid";
      case "currency":
        return "currency";
      case "percentage":
        return "percentage";
    }
  }

  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "integer":
      return "integer";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "string";
  }
}

/**
 * Convert JSON Schema format to our FieldFormat
 */
function mapJSONSchemaFormat(format?: string): FieldFormat | undefined {
  if (!format) return undefined;

  const formatMap: Record<string, FieldFormat> = {
    date: "date",
    "date-time": "date-time",
    time: "time",
    email: "email",
    uri: "uri",
    url: "uri",
    uuid: "uuid",
    hostname: "hostname",
    ipv4: "ipv4",
    ipv6: "ipv6",
    password: "password",
    byte: "byte",
    binary: "binary",
    int32: "int32",
    int64: "int64",
    float: "float",
    double: "double",
    currency: "currency",
    percentage: "percentage",
  };

  return formatMap[format];
}

/**
 * Convert property name to human-readable label
 */
function nameToLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse a JSON Schema property into a ParsedField
 */
export function parseJSONSchemaProperty(
  name: string,
  schema: JSONSchemaProperty,
  isRequired: boolean,
  options: JSONSchemaParserOptions = {}
): ParsedField {
  const type = mapJSONSchemaType(schema.type, schema.format);
  const format = mapJSONSchemaFormat(schema.format);

  // Build validation constraints
  const validation: FieldValidation = {
    required: isRequired,
    minimum: schema.minimum,
    maximum: schema.maximum,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minItems: schema.minItems,
    maxItems: schema.maxItems,
    pattern: schema.pattern,
    enum: schema.enum,
    default: schema.default,
  };

  // Handle reference fields
  let reference: EntityReference | undefined;
  if (schema["x-entity-ref"]) {
    reference = {
      entityCode: schema["x-entity-ref"],
      displayField: schema["x-display-field"],
      isArray: type === "array",
    };
  } else if (schema.$ref) {
    // Extract entity code from $ref like "#/definitions/Member"
    const refMatch = schema.$ref.match(/#\/(?:definitions|components\/schemas)\/(\w+)/);
    if (refMatch?.[1]) {
      reference = {
        entityCode: refMatch[1].toLowerCase(),
        isArray: false,
      };
    }
  }

  // Handle array items
  let items: Omit<ParsedField, "name" | "label"> | undefined;
  if (schema.items) {
    const itemField = parseJSONSchemaProperty("item", schema.items, false, options);
    items = {
      type: itemField.type,
      format: itemField.format,
      description: itemField.description,
      validation: itemField.validation,
      reference: itemField.reference,
      properties: itemField.properties,
      readonly: itemField.readonly,
      writeOnly: itemField.writeOnly,
      nullable: itemField.nullable,
    };

    // Check if array items have a reference
    if (schema.items["x-entity-ref"] || schema.items.$ref) {
      const itemEntityCode =
        schema.items["x-entity-ref"] || extractRefEntityCode(schema.items.$ref);
      // Only create reference if we have a valid entity code
      if (itemEntityCode) {
        reference = {
          entityCode: itemEntityCode,
          displayField: schema.items["x-display-field"],
          isArray: true,
        };
      }
    }
  }

  // Handle nested object properties
  let properties: Record<string, ParsedField> | undefined;
  if (schema.properties) {
    properties = {};
    const nestedRequired = schema.required ?? [];
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      properties[propName] = parseJSONSchemaProperty(
        propName,
        propSchema,
        nestedRequired.includes(propName),
        options
      );
    }
  }

  // Determine if nullable
  const nullable = schema.nullable || (Array.isArray(schema.type) && schema.type.includes("null"));

  return {
    name,
    label: schema.title || nameToLabel(name),
    description: schema.description,
    type: reference ? "reference" : schema.enum ? "enum" : type,
    format,
    validation,
    reference,
    items,
    properties,
    readonly: schema.readOnly,
    writeOnly: schema.writeOnly,
    nullable,
    _raw: schema,
  };
}

/**
 * Extract entity code from a $ref string.
 * Returns undefined if the ref is invalid or doesn't match expected patterns.
 */
function extractRefEntityCode(ref?: string): string | undefined {
  if (!ref) return undefined;
  const match = ref.match(/#\/(?:definitions|components\/schemas)\/(\w+)/);
  return match?.[1]?.toLowerCase();
}

/**
 * Parse a complete JSON Schema into a ParsedEntitySchema
 */
export function parseJSONSchema(
  schema: JSONSchema,
  options: JSONSchemaParserOptions = {}
): ParsedEntitySchema {
  const {
    defaultPrimaryKey = "id",
    entityCode = schema["x-entity-code"],
    entityName = schema.title,
  } = options;

  if (!entityCode) {
    throw new Error("Entity code is required. Provide via options or x-entity-code in schema.");
  }

  const required = schema.required ?? [];
  const fields: Record<string, ParsedField> = {};
  const fieldOrder: string[] = [];

  // Parse all properties
  if (schema.properties) {
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      fields[name] = parseJSONSchemaProperty(name, propSchema, required.includes(name), options);
      fieldOrder.push(name);
    }
  }

  // Determine primary key
  const primaryKey = schema["x-primary-key"] || defaultPrimaryKey;

  // Determine display field (first string field that's not the primary key, or name/title)
  let displayField = schema["x-display-field"];
  if (!displayField) {
    const candidates = ["name", "title", "label", "displayName", "display_name"];
    displayField =
      candidates.find((c) => fields[c]) ||
      fieldOrder.find(
        (f) => f !== primaryKey && fields[f]?.type === "string" && !fields[f]?.writeOnly
      );
  }

  // Extract timestamp fields
  const timestamps: ParsedEntitySchema["timestamps"] = {};
  if (schema["x-created-at"] || fields.createdAt || fields.created_at) {
    timestamps.createdAt =
      schema["x-created-at"] || (fields.createdAt ? "createdAt" : "created_at");
  }
  if (schema["x-updated-at"] || fields.updatedAt || fields.updated_at) {
    timestamps.updatedAt =
      schema["x-updated-at"] || (fields.updatedAt ? "updatedAt" : "updated_at");
  }

  return {
    code: entityCode,
    name: entityName || nameToLabel(entityCode),
    description: schema.description,
    primaryKey,
    displayField,
    fields,
    fieldOrder,
    timestamps: Object.keys(timestamps).length > 0 ? timestamps : undefined,
    _raw: schema,
  };
}
