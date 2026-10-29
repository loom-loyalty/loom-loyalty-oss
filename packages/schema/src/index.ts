/**
 * @loom-loyalty/schema
 *
 * Schema parsing and UI generation for Loom Loyalty Hub.
 *
 * @example
 * ```typescript
 * import {
 *   parseOpenAPIFromJSON,
 *   generateUISchema,
 * } from '@loom-loyalty/schema';
 *
 * // Parse OpenAPI spec
 * const registry = parseOpenAPIFromJSON(openapiJson);
 *
 * // Generate UI schemas
 * for (const [code, entitySchema] of Object.entries(registry.entities)) {
 *   const uiSchema = generateUISchema(entitySchema);
 *   console.log(uiSchema);
 * }
 * ```
 */

// Types
export * from "./types/index.js";

// Parser
export * from "./parser/index.js";

// Registry
export * from "./registry/index.js";

// Generator
export * from "./generator/index.js";

// Bridge (Schema-to-OpenUI mapping and prompt generation)
export * from "./bridge/index.js";
