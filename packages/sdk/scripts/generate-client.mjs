#!/usr/bin/env node
/**
 * Generate LoomLoyalty Class-Based Client
 *
 * This script parses the OpenAPI spec and generates:
 * 1. Resource classes for each tag/domain (e.g., AuthManagementResource)
 * 2. The main LoomLoyalty class that instantiates all resources
 *
 * Usage: node scripts/generate-client.mjs
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI_PATH = join(__dirname, "../../../openapi.yaml");
const CLIENT_DIR = join(__dirname, "../src/client");
const RESOURCES_DIR = join(CLIENT_DIR, "resources");

/**
 * Convert kebab-case, snake_case, or slash-separated names to camelCase
 */
export function toCamelCase(str) {
  return str.replace(/[-_/]([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function resourceFileName(tag) {
  return tag.replaceAll("/", "-");
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert PascalCase to camelCase
 */
function toLowerCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Extract the method name from an operationId
 * e.g., "auth-management_listM2MClients" -> "listM2MClients"
 */
function extractMethodName(operationId) {
  const parts = operationId.split("_");
  return parts.length > 1 ? parts[1] : operationId;
}

/**
 * Extract the tag name from an operationId
 * e.g., "auth-management_listM2MClients" -> "auth-management"
 */
function extractTagFromOperationId(operationId) {
  const parts = operationId.split("_");
  return parts.length > 1 ? parts[0] : null;
}

/**
 * Normalize a type name to match the generated TypeScript type
 * Handles patterns like EventResponse<Void> -> EventResponseVoid
 * and EventResponse_Void_ -> EventResponseVoid
 * and HubComponentController.ComponentValidationInfo -> HubComponentControllerComponentValidationInfo
 */
function normalizeTypeName(typeName) {
  if (!typeName) return typeName;
  // Remove dots (namespace separators) by concatenating: A.B -> AB
  // HubComponentController.ComponentValidationInfo -> HubComponentControllerComponentValidationInfo
  let normalized = typeName.replace(/\./g, '');
  // Remove underscores used as angle bracket replacements: _T_ -> T
  // EventResponse_Void_ -> EventResponseVoid
  // IdListEventData_UUID_ -> IdListEventDataUUID
  normalized = normalized.replace(/_([A-Z][a-zA-Z0-9]*)_/g, '$1');
  // Remove trailing underscores (e.g., EventResponse_List_CustomerExternalOffer__ -> ...Offer)
  normalized = normalized.replace(/_+$/, '');
  return normalized;
}

/**
 * Get the TypeScript type from an OpenAPI schema reference
 */
function getTypeFromRef(ref) {
  if (!ref) return "unknown";
  const parts = ref.split("/");
  const typeName = parts[parts.length - 1];
  return normalizeTypeName(typeName);
}

/**
 * List of bare/invalid type names that should be skipped
 */
const INVALID_TYPE_NAMES = new Set([
  "Create", "Update", "Delete", "Response", "List", "Paged",
  "Get", "Post", "Put", "Patch", "Request", "Body", "Data"
]);

/**
 * Check if a type name is valid (not bare/invalid)
 */
function isValidTypeName(typeName) {
  if (!typeName || typeName.length === 0) return false;
  if (INVALID_TYPE_NAMES.has(typeName)) return false;
  return true;
}

/**
 * Get the unwrapped type from a response schema
 * For Response* or Paged* types, extract the inner data type
 *
 * `schemas` (the parsed OpenAPI components.schemas map) lets Response*
 * wrappers resolve their real `data` field instead of string-slicing the
 * wrapper's own name: the two can drift apart when the wrapped entity is
 * renamed but the response wrapper schema keeps its old name (e.g.
 * ResponsePortalConfig's name is stale, but its `data` field correctly
 * points at RewardsPortalConfig). Falls back to the name-slice when the
 * wrapper has no direct `data.$ref` (e.g. the polymorphic `oneOf` wrappers
 * like ResponseOffer, which have no single schema to resolve).
 */
export function getResponseType(schema, schemas) {
  if (schema?.$ref) return getUnwrappedType(getTypeFromRef(schema.$ref), schemas);
  if (schema?.type === "array" && schema.items?.$ref) {
    const itemType = getTypeFromRef(schema.items.$ref);
    if (isValidTypeName(itemType)) return `${itemType}[]`;
  }
  return "void";
}

export function getUnwrappedType(typeName, schemas) {
  if (!typeName || typeName.length === 0) return "void";

  // Handle bare invalid types first
  if (INVALID_TYPE_NAMES.has(typeName)) return "void";

  if (typeName.startsWith("Response")) {
    const data = schemas?.[typeName]?.properties?.data;
    // ResponseListAgreementAcceptance (Response<List<X>>) -> AgreementAcceptance[]
    if (data?.type === "array") {
      const itemType = data.items?.$ref ? getTypeFromRef(data.items.$ref) : "";
      return isValidTypeName(itemType) ? `${itemType}[]` : "unknown[]";
    }
    // ResponseOrganization -> Organization
    const inner = data?.$ref ? getTypeFromRef(data.$ref) : typeName.slice(8);
    if (inner === "Void" || inner === "") return "void";
    if (!isValidTypeName(inner)) return "void";
    return inner;
  }
  if (typeName.startsWith("Paged") && typeName.length > 5) {
    // PagedOrganization -> PagedOrganizationData
    const inner = typeName.slice(5);
    if (!isValidTypeName(inner)) return typeName;
    return `${typeName}Data`;
  }
  if (typeName.startsWith("List") && typeName.length > 4) {
    const inner = typeName.slice(4);
    if (!isValidTypeName(inner)) return typeName;
    // Avoid double-unwrap: if inner starts with "Response" or "Paged",
    // the type would be unwrapped again, referencing a non-existent schema.
    // Keep the full name as-is (e.g. ListResponseMessageOut stays as-is).
    if (inner.startsWith("Response") || inner.startsWith("Paged")) return typeName;
    // ListOrganization -> Organization[]
    return `${inner}[]`;
  }
  return typeName;
}

/**
 * Parse path parameters from a path template
 */
function parsePathParams(path) {
  const params = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }
  return params;
}

/**
 * Generate method parameters string
 */
function generateMethodParams(pathParams, hasQueryParams, hasBody, bodyType) {
  const params = [];

  for (const param of pathParams) {
    params.push(`${toCamelCase(param)}: string`);
  }

  if (hasBody) {
    params.push(`data: ${bodyType}`);
  }

  if (hasQueryParams) {
    params.push(`params?: Record<string, string | number | boolean | undefined>`);
  }

  return params.join(", ");
}

/**
 * Group operations by tag
 */
function groupOperationsByTag(paths, schemas) {
  const groups = new Map();

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (method === "parameters") continue;

      const operationId = operation.operationId;
      if (!operationId) continue;

      const tag = extractTagFromOperationId(operationId) || operation.tags?.[0] || "default";
      const methodName = extractMethodName(operationId);

      if (!groups.has(tag)) {
        groups.set(tag, []);
      }

      // Get response type
      const successResponse = operation.responses?.["200"] || operation.responses?.["201"];
      const responseSchema = successResponse?.content?.["application/json"]?.schema;
      const responseType = getResponseType(responseSchema, schemas);

      // Get request body type (validate it's not a bare/invalid type)
      const requestBody = operation.requestBody?.content?.["application/json"]?.schema;
      let bodyType = requestBody?.$ref ? getTypeFromRef(requestBody.$ref) : null;
      if (bodyType && !isValidTypeName(bodyType)) {
        bodyType = null; // Skip invalid body types
      }

      // Get query parameters
      const queryParams = (operation.parameters || []).filter((p) => p.in === "query");
      const pathParams = parsePathParams(path);

      groups.get(tag).push({
        methodName,
        path,
        method,
        responseType,
        bodyType,
        hasQueryParams: queryParams.length > 0,
        pathParams,
        summary: operation.summary || operation.description || "",
      });
    }
  }

  return groups;
}

/**
 * Collect all types used by the operations
 */
function collectUsedTypes(operations) {
  const types = new Set();

  for (const op of operations) {
    if (op.responseType && op.responseType !== "void") {
      // Handle array types
      const baseType = op.responseType.replace(/\[\]$/, "");
      if (isValidTypeName(baseType)) {
        types.add(baseType);
      }
    }
    if (op.bodyType && isValidTypeName(op.bodyType)) {
      types.add(op.bodyType);
    }
  }

  return Array.from(types).filter(t => isValidTypeName(t)).sort();
}

/**
 * Generate a resource class file
 */
export function generateResourceClass(tag, operations) {
  const className = `${toPascalCase(tag)}Resource`;
  const usedTypes = collectUsedTypes(operations);

  const imports = usedTypes.length > 0 ? `import type {\n  ${usedTypes.join(",\n  ")}\n} from "../../generated/schemas";\n` : "";

  const methods = operations.map((op) => {
    const params = generateMethodParams(op.pathParams, op.hasQueryParams, !!op.bodyType, op.bodyType);
    const returnType = op.responseType;

    // Build the path with template literals for path params
    let pathExpr;
    if (op.pathParams.length > 0) {
      pathExpr = "`" + op.path.replace(/\{([^}]+)\}/g, (_, param) => `\${${toCamelCase(param)}}`) + "`";
    } else {
      pathExpr = `"${op.path}"`;
    }

    const fetchOptions = [];
    fetchOptions.push(`method: "${op.method.toUpperCase()}"`);
    if (op.bodyType) {
      fetchOptions.push(`body: JSON.stringify(data)`);
    }
    if (op.hasQueryParams) {
      fetchOptions.push(`params`);
    }

    const fetchCall = `this.fetch<${returnType}>(${pathExpr}, { ${fetchOptions.join(", ")} })`;

    return `  /**
   * ${op.summary}
   */
  async ${op.methodName}(${params}): Promise<${returnType}> {
    return ${fetchCall};
  }`;
  });

  return `/**
 * Generated by generate-client.mjs
 * Do not edit manually.
 */

import { BaseResource } from "../base-resource";
${imports}

/**
 * ${toPascalCase(tag)} API Resource
 */
export class ${className} extends BaseResource {
${methods.join("\n\n")}
}
`;
}

/**
 * Generate the main LoomLoyalty client class
 */
function generateMainClient(tags) {
  const resourceImports = tags.map((tag) => {
    const className = `${toPascalCase(tag)}Resource`;
    const fileName = resourceFileName(tag);
    return `import { ${className} } from "./resources/${fileName}";`;
  });

  const resourceProps = tags.map((tag) => {
    const className = `${toPascalCase(tag)}Resource`;
    const propName = toLowerCamelCase(toPascalCase(tag));
    return `  public readonly ${propName}: ${className};`;
  });

  const resourceInits = tags.map((tag) => {
    const className = `${toPascalCase(tag)}Resource`;
    const propName = toLowerCamelCase(toPascalCase(tag));
    return `    this.${propName} = new ${className}(config);`;
  });

  return `/**
 * Generated by generate-client.mjs
 * Do not edit manually.
 *
 * LoomLoyalty Class-Based Client
 *
 * Provides a clean, object-oriented interface to the Loom Loyalty API.
 *
 * @example
 * const client = new LoomLoyalty({
 *   baseUrl: 'https://api.example.com',
 *   tokenProvider: () => getAccessToken()
 * });
 *
 * const members = await client.operationsCustomers.listCustomers({ page: 0, size: 10 });
 */

import type { LoomLoyaltyConfig } from "./base-resource";
${resourceImports.join("\n")}

export type { LoomLoyaltyConfig };

/**
 * LoomLoyalty API Client
 *
 * Main entry point for interacting with the Loom Loyalty API.
 * Provides typed access to all API resources.
 */
export class LoomLoyalty {
${resourceProps.join("\n")}

  /**
   * Create a new LoomLoyalty client
   *
   * @param config - Configuration options
   * @param config.baseUrl - The API base URL
   * @param config.tokenProvider - Function that returns the auth token
   */
  constructor(config: LoomLoyaltyConfig) {
${resourceInits.join("\n")}
  }
}
`;
}

/**
 * Generate the resources index file
 */
function generateResourcesIndex(tags) {
  const exports = tags.map((tag) => {
    const className = `${toPascalCase(tag)}Resource`;
    return `export { ${className} } from "./${resourceFileName(tag)}";`;
  });

  return `/**
 * Generated by generate-client.mjs
 * Do not edit manually.
 */

${exports.join("\n")}
`;
}

/**
 * Generate the client index file
 */
function generateClientIndex() {
  return `/**
 * Generated by generate-client.mjs
 * Do not edit manually.
 */

export { LoomLoyalty } from "./loom-loyalty";
export type { LoomLoyaltyConfig } from "./base-resource";
export * from "./resources";
`;
}

async function main() {
  console.log("Generating LoomLoyalty client from OpenAPI spec...\n");

  // Read and parse OpenAPI spec
  const openapiContent = await readFile(OPENAPI_PATH, "utf-8");
  const openapi = parseYaml(openapiContent);

  console.log(`OpenAPI version: ${openapi.openapi}`);
  console.log(`API title: ${openapi.info.title}`);
  console.log(`API version: ${openapi.info.version}\n`);

  // Group operations by tag
  const groups = groupOperationsByTag(openapi.paths, openapi.components.schemas);
  const tags = Array.from(groups.keys()).sort();

  console.log(`Found ${tags.length} resource groups:`);
  for (const tag of tags) {
    console.log(`  - ${tag} (${groups.get(tag).length} operations)`);
  }

  // Ensure directories exist
  await mkdir(RESOURCES_DIR, { recursive: true });

  // Generate resource files
  console.log("\nGenerating resource files...");
  for (const tag of tags) {
    const content = generateResourceClass(tag, groups.get(tag));
    const filePath = join(RESOURCES_DIR, `${resourceFileName(tag)}.ts`);
    await writeFile(filePath, content, "utf-8");
    console.log(`  Generated: ${resourceFileName(tag)}.ts`);
  }

  // Generate resources index
  const resourcesIndex = generateResourcesIndex(tags);
  await writeFile(join(RESOURCES_DIR, "index.ts"), resourcesIndex, "utf-8");
  console.log("  Generated: resources/index.ts");

  // Generate main client
  const mainClient = generateMainClient(tags);
  await writeFile(join(CLIENT_DIR, "loom-loyalty.ts"), mainClient, "utf-8");
  console.log("  Generated: loom-loyalty.ts");

  // Generate client index
  const clientIndex = generateClientIndex();
  await writeFile(join(CLIENT_DIR, "index.ts"), clientIndex, "utf-8");
  console.log("  Generated: index.ts");

  console.log("\nClient generation complete!");
}

// Guard so importing this module for unit tests (e.g. `getUnwrappedType`)
// doesn't also trigger a full spec-fetch-and-write run as a side effect.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
