/**
 * OpenAPI Parser
 *
 * Parses OpenAPI 3.0+ specifications into ParsedEntitySchema structures.
 */

import type { ParsedEntitySchema, SchemaRegistry } from "../types/schema.js";
import { parseJSONSchema, type JSONSchemaParserOptions } from "./json-schema.js";

/**
 * OpenAPI Schema Object
 */
interface OpenAPISchema {
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
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  $ref?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  title?: string;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  // Extensions
  "x-entity-code"?: string;
  "x-primary-key"?: string;
  "x-display-field"?: string;
  "x-created-at"?: string;
  "x-updated-at"?: string;
  "x-entity-ref"?: string;
}

/**
 * OpenAPI Components Object
 */
interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
}

/**
 * OpenAPI Info Object
 */
interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
}

/**
 * Simplified OpenAPI Document
 */
interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  components?: OpenAPIComponents;
  paths?: Record<string, unknown>;
}

/**
 * OpenAPI parser options
 */
export interface OpenAPIParserOptions {
  /** Only include schemas matching this pattern */
  includePattern?: RegExp;
  /** Exclude schemas matching this pattern */
  excludePattern?: RegExp;
  /** Schema name to entity code mapping */
  entityCodeMap?: Record<string, string>;
  /** Schemas that should be treated as entities (vs value objects) */
  entitySchemas?: string[];
  /** Default primary key field */
  defaultPrimaryKey?: string;
}

/**
 * Resolve $ref references in a schema
 */
function resolveRef(ref: string, components?: OpenAPIComponents): OpenAPISchema | undefined {
  if (!ref.startsWith("#/components/schemas/")) {
    return undefined;
  }

  const schemaName = ref.replace("#/components/schemas/", "");
  return components?.schemas?.[schemaName];
}

/**
 * Merge allOf schemas into a single schema
 */
function mergeAllOf(schemas: OpenAPISchema[], components?: OpenAPIComponents): OpenAPISchema {
  const merged: OpenAPISchema = {
    type: "object",
    properties: {},
    required: [],
  };

  for (const schema of schemas) {
    // Resolve $ref if present
    const resolved = schema.$ref ? resolveRef(schema.$ref, components) : schema;
    if (!resolved) continue;

    // Merge properties
    if (resolved.properties) {
      merged.properties = { ...merged.properties, ...resolved.properties };
    }

    // Merge required
    if (resolved.required) {
      merged.required = [...(merged.required || []), ...resolved.required];
    }

    // Copy other fields from first schema that has them
    for (const key of [
      "title",
      "description",
      "x-entity-code",
      "x-primary-key",
      "x-display-field",
    ]) {
      const typedKey = key as keyof OpenAPISchema;
      if (resolved[typedKey] && !merged[typedKey]) {
        (merged as Record<string, unknown>)[key] = resolved[typedKey];
      }
    }
  }

  return merged;
}

/**
 * Determine if a schema represents an entity (vs a value object)
 */
function isEntitySchema(
  name: string,
  schema: OpenAPISchema,
  options: OpenAPIParserOptions
): boolean {
  // Explicitly marked as entity
  if (schema["x-entity-code"]) return true;

  // In the entity list
  if (options.entitySchemas?.includes(name)) return true;

  // Has CRUD-like structure (id, timestamps, etc.)
  const props = schema.properties || {};
  const hasId = "id" in props || "uuid" in props;
  const hasTimestamps =
    ("createdAt" in props || "created_at" in props) &&
    ("updatedAt" in props || "updated_at" in props);

  return hasId && hasTimestamps;
}

/**
 * Convert schema name to entity code
 */
function schemaNameToEntityCode(name: string, mapping?: Record<string, string>): string {
  if (mapping?.[name]) return mapping[name];

  // Convert PascalCase to snake_case
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Parse a single OpenAPI schema into a ParsedEntitySchema
 */
export function parseOpenAPISchema(
  name: string,
  schema: OpenAPISchema,
  components?: OpenAPIComponents,
  options: OpenAPIParserOptions = {}
): ParsedEntitySchema {
  // Handle allOf composition
  let resolvedSchema = schema;
  if (schema.allOf) {
    resolvedSchema = mergeAllOf(schema.allOf, components);
  }

  // Handle $ref at top level
  if (schema.$ref) {
    const refSchema = resolveRef(schema.$ref, components);
    if (refSchema) {
      resolvedSchema = refSchema;
    }
  }

  const entityCode =
    resolvedSchema["x-entity-code"] || schemaNameToEntityCode(name, options.entityCodeMap);

  const parserOptions: JSONSchemaParserOptions = {
    entityCode,
    entityName: resolvedSchema.title || name,
    defaultPrimaryKey: options.defaultPrimaryKey,
    definitions: components?.schemas as Record<string, unknown> as Record<
      string,
      Parameters<typeof parseJSONSchema>[0]
    >,
  };

  return parseJSONSchema(resolvedSchema as Parameters<typeof parseJSONSchema>[0], parserOptions);
}

/**
 * Parse an OpenAPI document into a SchemaRegistry
 */
export function parseOpenAPIDocument(
  doc: OpenAPIDocument,
  options: OpenAPIParserOptions = {}
): SchemaRegistry {
  const { includePattern, excludePattern } = options;
  const entities: Record<string, ParsedEntitySchema> = {};

  const schemas = doc.components?.schemas || {};

  for (const [name, schema] of Object.entries(schemas)) {
    // Apply filters
    if (includePattern && !includePattern.test(name)) continue;
    if (excludePattern && excludePattern.test(name)) continue;

    // Check if this is an entity schema
    if (!isEntitySchema(name, schema, options)) continue;

    try {
      const entitySchema = parseOpenAPISchema(name, schema, doc.components, options);
      entities[entitySchema.code] = entitySchema;
    } catch (error) {
      console.warn(`Failed to parse schema "${name}":`, error);
    }
  }

  return {
    entities,
    version: doc.info.version,
  };
}

/**
 * Parse an OpenAPI document from JSON string
 */
export function parseOpenAPIFromJSON(
  json: string,
  options: OpenAPIParserOptions = {}
): SchemaRegistry {
  const doc = JSON.parse(json) as OpenAPIDocument;
  return parseOpenAPIDocument(doc, options);
}
