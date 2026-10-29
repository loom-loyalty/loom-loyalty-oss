/**
 * Schema utilities for Data Model Management
 *
 * Three concerns, isolated:
 * 1. generateClientSchema — best-effort client-side JSON Schema preview from elements
 * 2. validateJsonAgainstSchema — lazy-loads ajv (zero initial bundle cost) and validates
 * 3. copyToClipboard — wraps the Clipboard API with a graceful fallback
 *
 * The client-side schema generator is approximate; the server is the source of truth.
 * It exists so the form sheet can show a live preview as the user adds elements,
 * not to enforce validation.
 */

import type AjvCtor from "ajv";

import type { BuilderFieldRow } from "./builder/types.js";
import { dataModelCodeKey } from "./code-key.js";
import type { DataModelElementFormData } from "./types.js";

/**
 * Build a JSON Schema (draft-07) approximation from a list of element definitions.
 *
 * Mirrors the shape the server generates — primitive type codes map to JSON Schema
 * primitives, custom types become `$ref` strings, arrays wrap with `type: array`.
 *
 * The output is for preview only. The authoritative schema comes from the server
 * via GET /data-models/{id}/schema after the model is saved.
 */
export function generateClientSchema(
  elements: DataModelElementFormData[] | BuilderFieldRow[],
  options?: { title?: string }
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const entry of elements) {
    const isBuilderRow = isBuilderFieldRow(entry);
    const row = isBuilderRow ? entry : undefined;
    const el = isBuilderRow ? entry.field : entry;
    if (!el.outputAttribute && !el.inputAttribute) continue;
    const attr = el.outputAttribute || el.inputAttribute || "";
    if (!attr) continue;

    properties[attr] = fieldToJsonSchema(el, row);

    if (el.required) {
      required.push(attr);
    }
  }

  const schema: Record<string, unknown> = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties,
    additionalProperties: false,
  };

  if (options?.title) {
    schema.title = options.title;
  }

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

function isBuilderFieldRow(
  entry: DataModelElementFormData | BuilderFieldRow
): entry is BuilderFieldRow {
  return "field" in entry;
}

function fieldToJsonSchema(
  element: DataModelElementFormData,
  row?: BuilderFieldRow
): Record<string, unknown> {
  const itemSchema =
    row?.state === "needs-review-nested"
      ? nestedRowsToObjectSchema(row.nested ?? [])
      : elementToJsonSchema(element);
  return element.isArray ? { type: "array", items: itemSchema } : itemSchema;
}

/** Render nested builder rows inline for the local preview; submission creates real child types. */
function nestedRowsToObjectSchema(rows: BuilderFieldRow[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const row of rows) {
    const attr = row.field.outputAttribute || row.field.inputAttribute || "";
    if (!attr) continue;
    properties[attr] = fieldToJsonSchema(row.field, row);
    if (row.field.required) required.push(attr);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Find element attributes that would collide as JSON Schema property keys.
 *
 * `generateClientSchema` writes into `properties[attr]` keyed by outputAttribute
 * (falling back to inputAttribute), so two elements sharing the same attribute
 * silently clobber each other — only the last one survives. Callers should
 * surface these as validation errors before submit.
 *
 * Returns the set of duplicated attribute names (each appears once in the result).
 */
export function findDuplicateAttributes(elements: DataModelElementFormData[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const el of elements) {
    const attr = el.outputAttribute || el.inputAttribute || "";
    if (!attr) continue;
    if (seen.has(attr)) {
      duplicates.add(attr);
    } else {
      seen.add(attr);
    }
  }
  return Array.from(duplicates);
}

/**
 * Map a single element to its JSON Schema fragment.
 *
 * Primitive type codes get full JSON Schema definitions.
 * Non-primitive (system or custom) type codes become $ref strings.
 */
function elementToJsonSchema(el: DataModelElementFormData): Record<string, unknown> {
  // Fold via dataModelCodeKey, not a bare .toUpperCase(): the primitive palette
  // is part of DataModelType's resource-code migration too, so a multi-segment
  // name like DATE_TIME / LOCALIZED_STRING now arrives as "date-time" /
  // "localized-string". Uppercasing alone turns "date-time" into "DATE-TIME",
  // which matches neither spelling and silently fell through to the $ref
  // default below instead of the primitive fragment.
  const code = dataModelCodeKey(el.typeCode);
  switch (code) {
    case "string":
      return { type: "string" };
    case "integer":
      return { type: "integer" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date" };
    case "date-time":
      return { type: "string", format: "date-time" };
    case "uuid":
      return { type: "string", format: "uuid" };
    case "localized-string":
      return {
        type: "object",
        patternProperties: {
          "^[a-z]{2}(-[A-Z]{2})?$": { type: "string" },
        },
      };
    case "any":
      return {
        anyOf: [
          { type: "string" },
          { type: "number" },
          { type: "integer" },
          { type: "boolean" },
          { type: "object" },
          { type: "array" },
          { type: "null" },
        ],
      };
    default:
      // System or custom type: reference by its ACTUAL code, not the upper-cased
      // form used for the primitive switch above. Custom DataModelType codes are
      // lowercase-hyphenated, so `${code}` would label the
      // ref `ORDER-LINE-ITEM` for a type that is really `order-line-item`.
      return { $ref: `#/definitions/${(el.typeCode || "").trim()}` };
  }
}

/**
 * Memoized ajv instance. Constructing ajv compiles its meta-schema, which is
 * meaningful work (tens of ms on a cold machine). We pay it once per session
 * on first call, then reuse the instance for every subsequent validation.
 *
 * Memoize on the pending promise, not the resolved instance: if two callers
 * race before the first `import("ajv")` resolves, both must await the same
 * in-flight promise so we never build two Ajv instances (one of which would
 * be orphaned and break any future instance-keyed compile caches).
 */
let ajvPromise: Promise<InstanceType<typeof AjvCtor>> | null = null;

function getAjvInstance(): Promise<InstanceType<typeof AjvCtor>> {
  if (!ajvPromise) {
    ajvPromise = import("ajv")
      .then(({ default: Ajv }) => new Ajv({ allErrors: true, strict: false }))
      .catch((err) => {
        // Reset on failure so a later retry (e.g., user reconnects) can try again
        // instead of caching a rejected promise forever.
        ajvPromise = null;
        throw err;
      });
  }
  return ajvPromise;
}

export interface SchemaValidationResult {
  /** Whether the input passed validation */
  valid: boolean;
  /** Per-field error messages (empty if valid) */
  errors: SchemaValidationError[];
  /** Top-level error if the input couldn't be parsed as JSON */
  parseError?: string;
}

export interface SchemaValidationError {
  /** JSON path to the failing field (e.g., "/email" or "/items/0/name") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The keyword that failed (e.g., "type", "required", "format") */
  keyword?: string;
}

/**
 * Validate a JSON string against a JSON Schema.
 *
 * Lazy-loads ajv only when called, so the ~150KB ajv bundle never hits the
 * initial page load. Pays the import cost once per session, on first validate.
 *
 * @param json - Raw JSON string from the user
 * @param schema - JSON Schema object to validate against
 * @returns Validation result with parse errors, schema errors, or success
 */
export async function validateJsonAgainstSchema(
  json: string,
  schema: Record<string, unknown>
): Promise<SchemaValidationResult> {
  // Step 1: Parse the JSON
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    return {
      valid: false,
      errors: [],
      parseError: err instanceof Error ? err.message : "Invalid JSON",
    };
  }

  // Step 2: Lazy-load ajv (only loaded when sandbox is used).
  // Dynamic import can reject under strict CSP, chunk 404s, or offline conditions —
  // surface as a structured error instead of an unhandled promise rejection.
  let ajv: InstanceType<typeof AjvCtor>;
  try {
    ajv = await getAjvInstance();
  } catch (err) {
    return {
      valid: false,
      errors: [],
      parseError: `Validator unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          path: "/",
          message: `Schema compilation failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  const valid = validate(data);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: SchemaValidationError[] = (validate.errors ?? []).map((e) => ({
    // Preserve AJV's empty string for root-level errors (JSON Pointer spec:
    // "" means the root). The sandbox display layer substitutes "/" visually,
    // but storing "" keeps the object semantically correct for other consumers.
    path: e.instancePath ?? "/",
    message: e.message ?? "Validation error",
    keyword: e.keyword,
  }));

  return { valid: false, errors };
}

/**
 * Copy text to the clipboard with a graceful fallback.
 *
 * Uses the modern Clipboard API when available (HTTPS contexts).
 * Falls back to the legacy execCommand path for older browsers / file:// URLs.
 *
 * @returns true if the copy succeeded, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern path
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy path
    }
  }

  // Legacy fallback (synchronous, less reliable)
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    const ok = document.execCommand("copy");
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Format a JSON object as a pretty-printed string for display.
 *
 * Used by the schema preview and copy-to-clipboard features.
 */
export function formatJson(obj: unknown, indent = 2): string {
  return JSON.stringify(obj, null, indent);
}
