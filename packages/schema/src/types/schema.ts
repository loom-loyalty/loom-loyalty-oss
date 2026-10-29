/**
 * Schema Types
 *
 * Core types for representing parsed schemas from OpenAPI/JSON Schema.
 */

/**
 * Supported field data types
 */
export type FieldDataType =
  | "string"
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "email"
  | "url"
  | "uuid"
  | "enum"
  | "array"
  | "object"
  | "reference"
  | "localized_string"
  | "metadata"
  | "currency"
  | "fiat_currency"
  | "percentage"
  | "json";

/**
 * Field format hints from OpenAPI/JSON Schema
 */
export type FieldFormat =
  | "date"
  | "date-time"
  | "time"
  | "email"
  | "uri"
  | "uuid"
  | "hostname"
  | "ipv4"
  | "ipv6"
  | "password"
  | "byte"
  | "binary"
  | "int32"
  | "int64"
  | "float"
  | "double"
  | "currency"
  | "percentage";

/**
 * Validation constraints for a field
 */
export interface FieldValidation {
  /** Field is required */
  required?: boolean;
  /** Minimum value (numbers) or length (strings) */
  minimum?: number;
  /** Maximum value (numbers) or length (strings) */
  maximum?: number;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
  /** Minimum array items */
  minItems?: number;
  /** Maximum array items */
  maxItems?: number;
  /** Regex pattern for string validation */
  pattern?: string;
  /** Allowed enum values */
  enum?: (string | number | boolean)[];
  /** Default value */
  default?: unknown;
}

/**
 * Reference to another entity
 */
export interface EntityReference {
  /** Referenced entity code */
  entityCode: string;
  /** Display field from referenced entity */
  displayField?: string;
  /** Whether this is a one-to-many relationship */
  isArray?: boolean;
}

/**
 * Parsed field definition
 */
export interface ParsedField {
  /** Field name/key */
  name: string;
  /** Human-readable label */
  label: string;
  /** Optional description/help text */
  description?: string;
  /** Data type */
  type: FieldDataType;
  /** Format hint */
  format?: FieldFormat;
  /** Validation constraints */
  validation: FieldValidation;
  /** Reference info (if type is 'reference') */
  reference?: EntityReference;
  /** Metadata-type code (if type is 'metadata') — e.g., "FIAT_CURRENCY_TYPE" */
  metadataType?: string;
  /** Metadata category (if type is 'metadata') — METADATA, DATA_TYPE, LOCATION, ITEM */
  metadataTypeCategory?: string;
  /** Original BE typeReference string — preserved so consumers can render unknown types */
  originalTypeReference?: string;
  /** Array item type (if type is 'array') */
  items?: Omit<ParsedField, "name" | "label">;
  /** Nested object properties (if type is 'object') */
  properties?: Record<string, ParsedField>;
  /** Whether field is read-only */
  readonly?: boolean;
  /** Whether field is write-only (e.g., password) */
  writeOnly?: boolean;
  /** Whether field is nullable */
  nullable?: boolean;
  /** Original schema for extension */
  _raw?: unknown;
}

/**
 * Parsed entity schema
 */
export interface ParsedEntitySchema {
  /** Entity code/identifier */
  code: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Primary key field name */
  primaryKey: string;
  /** Display/title field name */
  displayField?: string;
  /** All fields */
  fields: Record<string, ParsedField>;
  /** Field order (for UI) */
  fieldOrder: string[];
  /** Timestamp fields (created, updated) */
  timestamps?: {
    createdAt?: string;
    updatedAt?: string;
  };
  /** Original schema for extension */
  _raw?: unknown;
}

/**
 * Collection of entity schemas
 */
export interface SchemaRegistry {
  /** Map of entity code to schema */
  entities: Record<string, ParsedEntitySchema>;
  /** Schema version/revision */
  version?: string;
}
