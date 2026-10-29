#!/usr/bin/env node
/**
 * Post-processing script to fix Orval-generated files
 *
 * This script fixes common issues with generated TypeScript files:
 * 1. Casing issues with file names and imports
 * 2. Malformed/corrupted lines
 * 3. Response type unwrapping (transforms wrapper types to inner data types)
 *
 * The response unwrapping is needed because sdkFetch now automatically unwraps
 * API response envelopes ({ success, data, eventId, ... } -> data).
 */

import { readdir, readFile, writeFile, rename, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The package whose generated tree to fix: this one, or the root passed as the first argument
// (another package can run these scripts over its own generated tree).
const PACKAGE_ROOT = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("..", import.meta.url));
const SCHEMAS_DIR = join(PACKAGE_ROOT, "src/generated/schemas");
const API_DIR = join(PACKAGE_ROOT, "src/generated/api");

/**
 * Mapping of wrapper response types to their inner data types
 * This is populated by scanning the schema files
 */
const responseTypeMapping = new Map();

/**
 * Case sensitivity and type name fixes
 * Map from incorrect values to correct values
 */
const CASING_FIXES = {
  // Import path casing
  "./m2MClient": "./m2mClient",
  "./createM2MClient": "./createM2mClient",
  "./updateM2MClient": "./updateM2mClient",
  "./responseM2MClient": "./responseM2mClient",
  "./pagedM2MClientData": "./pagedM2mClientData",
};

/**
 * Type name fixes for incorrect type references
 */
const TYPE_NAME_FIXES = {
  // Fix lowercase M2mClient references to uppercase M2MClient
  "M2mClient": "M2MClient",
};

/**
 * Fix empty type annotations (e.g., `property?: ;` -> `property?: unknown;`)
 */
function fixEmptyTypes(content) {
  // Fix `property?: ;` or `property: ;` patterns
  return content.replace(/(\w+\??:\s*);/g, "$1 unknown;");
}

/**
 * Fix import path casing issues and type names
 */
function fixImportCasing(content) {
  let fixed = content;

  // Fix import path casing
  for (const [incorrect, correct] of Object.entries(CASING_FIXES)) {
    fixed = fixed.replaceAll(`'${incorrect}'`, `'${correct}'`);
    fixed = fixed.replaceAll(`"${incorrect}"`, `"${correct}"`);
  }

  // Fix type name references (as word boundaries)
  for (const [incorrect, correct] of Object.entries(TYPE_NAME_FIXES)) {
    // Match type names as whole words (not part of another word)
    const regex = new RegExp(`\\b${incorrect}\\b`, "g");
    fixed = fixed.replace(regex, correct);
  }

  return fixed;
}

/**
 * Fix corrupted/malformed lines and duplicate interfaces
 * These are lines that look like partial imports or broken syntax
 */
function fixMalformedLines(content) {
  const lines = content.split("\n");
  const fixedLines = [];
  let skipUntilClosingBrace = false;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip lines that look like corrupted partial imports
    // e.g., `le } from './createRole';`
    if (/^\w+\s*}\s*from/.test(trimmed)) {
      console.log(`  Removing malformed line: ${trimmed}`);
      continue;
    }

    // Detect and skip duplicate/malformed M2M client interfaces
    // These have lowercase "M2mClient" instead of "M2MClient". Rotation request data
    // (CreateM2mClientRotationData) is a real schema with no uppercase twin, so it stays.
    if (
      /^export\s+interface\s+(Create|Update)M2mClient\s*\{/.test(trimmed) ||
      /^export\s+interface\s+.*M2mClient(?!Rotation)[^M]/.test(trimmed)
    ) {
      console.log(`  Removing malformed interface starting at: ${trimmed}`);
      skipUntilClosingBrace = true;
      braceCount = 1;
      continue;
    }

    // If we're skipping a malformed interface, count braces
    if (skipUntilClosingBrace) {
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      if (braceCount <= 0) {
        skipUntilClosingBrace = false;
      }
      continue;
    }

    fixedLines.push(line);
  }

  return fixedLines.join("\n");
}

/**
 * Build the mapping of wrapper types to inner data types by scanning schema files
 *
 * Looks for patterns like:
 *   export interface PagedOrganization {
 *     success: boolean;
 *     data?: PagedOrganizationData;
 *     ...
 *   }
 *
 * And maps: PagedOrganization -> PagedOrganizationData
 */
async function buildResponseTypeMapping() {
  const entries = await readdir(SCHEMAS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;

    const filePath = join(SCHEMAS_DIR, entry.name);
    const content = await readFile(filePath, "utf-8");

    // Look for Response* or Paged* or List* interface/type definitions with success and data fields
    // Pattern: export interface/type WrapperType { success: boolean; ... data?: InnerType; ... }
    const wrapperPattern = /export\s+(?:interface|type)\s+((?:Response|Paged|List)\w+)\s*(?:=\s*)?{[^}]*success:\s*boolean[^}]*data\??\s*:\s*(\w+(?:\[\])?)/gs;

    let match;
    while ((match = wrapperPattern.exec(content)) !== null) {
      const wrapperType = match[1];
      const innerType = match[2];

      // Skip if the inner type is the same as wrapper (shouldn't happen, but be safe)
      if (wrapperType !== innerType) {
        responseTypeMapping.set(wrapperType, innerType);
      }
    }
  }

  console.log(`\nBuilt response type mapping (${responseTypeMapping.size} types):`);
  for (const [wrapper, inner] of responseTypeMapping) {
    console.log(`  ${wrapper} -> ${inner}`);
  }
}

/**
 * Transform API response types to use inner data types instead of wrappers
 *
 * Transforms patterns like:
 *   data: PagedOrganization
 * To:
 *   data: PagedOrganizationData
 */
function unwrapResponseTypes(content) {
  let fixed = content;

  for (const [wrapperType, innerType] of responseTypeMapping) {
    // Replace in response type definitions: data: WrapperType -> data: InnerType
    // Be careful to only replace in the response type context, not in import statements
    const responseDataPattern = new RegExp(`(data:\\s*)${wrapperType}\\b`, "g");
    fixed = fixed.replace(responseDataPattern, `$1${innerType}`);
  }

  return fixed;
}

/**
 * Update imports in API files to include the inner data types
 * when the wrapper types are replaced
 */
function updateImportsForUnwrapping(content) {
  let fixed = content;

  // For each wrapper type that's been replaced, add the inner type to imports
  for (const [wrapperType, innerType] of responseTypeMapping) {
    // Strip array suffix for import checking (imports don't include [])
    const baseInnerType = innerType.replace(/\[\]$/, "");
    // Check if the file uses the inner type (in response type definitions)
    // and the wrapper type is imported
    const escapedInnerType = innerType.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
    const usesInnerType = new RegExp(`data:\\s*${escapedInnerType}(?:\\b|$|\\s|;|,)`).test(fixed);
    const hasWrapperImport = new RegExp(`import\\s+type\\s*{[^}]*\\b${wrapperType}\\b`).test(fixed);
    const hasInnerImport = new RegExp(`import\\s+type\\s*{[^}]*\\b${baseInnerType}\\b`).test(fixed);

    if (usesInnerType && hasWrapperImport && !hasInnerImport) {
      // Add the inner type to the import that contains the wrapper type
      const importPattern = new RegExp(
        `(import\\s+type\\s*{[^}]*)(\\b${wrapperType}\\b)([^}]*}\\s*from\\s*['"]\\.\\.\/schemas['"])`,
        "g"
      );
      fixed = fixed.replace(importPattern, (_match, before, wrapper, after) => {
        return `${before}${wrapper},\n  ${baseInnerType}${after}`;
      });
    }
  }

  return fixed;
}

/**
 * Process a single file
 */
async function processFile(filePath, isApiFile = false) {
  const content = await readFile(filePath, "utf-8");
  let fixed = content;

  fixed = fixEmptyTypes(fixed);
  fixed = fixMalformedLines(fixed);
  fixed = fixImportCasing(fixed);

  // Apply response type unwrapping only to API files
  if (isApiFile) {
    fixed = unwrapResponseTypes(fixed);
    fixed = updateImportsForUnwrapping(fixed);
  }

  if (fixed !== content) {
    console.log(`Fixed: ${filePath}`);
    await writeFile(filePath, fixed, "utf-8");
    return true;
  }

  return false;
}

/**
 * Rename files to fix casing issues
 */
async function fixFileCasing(dirPath) {
  const renames = [
    { from: "m2MClient.ts", to: "m2mClient.ts" },
    { from: "createM2MClient.ts", to: "createM2mClient.ts" },
    { from: "updateM2MClient.ts", to: "updateM2mClient.ts" },
    { from: "responseM2MClient.ts", to: "responseM2mClient.ts" },
    { from: "pagedM2MClientData.ts", to: "pagedM2mClientData.ts" },
  ];

  for (const { from, to } of renames) {
    const fromPath = join(dirPath, from);
    const toPath = join(dirPath, to);

    try {
      await access(fromPath);
      // File exists with wrong casing, rename it
      // On macOS, we need to use a temp name due to case-insensitive filesystem
      const tempPath = join(dirPath, `_temp_${to}`);
      await rename(fromPath, tempPath);
      await rename(tempPath, toPath);
      console.log(`Renamed: ${from} -> ${to}`);
    } catch {
      // File doesn't exist with this name, skip
    }
  }
}

/**
 * Process all files in a directory
 */
async function processDirectory(dirPath, isApiDir = false) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  let fixedCount = 0;

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      fixedCount += await processDirectory(fullPath, isApiDir);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      if (await processFile(fullPath, isApiDir)) {
        fixedCount++;
      }
    }
  }

  return fixedCount;
}

async function main() {
  console.log("Fixing generated TypeScript files...");

  // First, fix file casing in schemas directory
  console.log("\nFixing file casing in schemas...");
  await fixFileCasing(SCHEMAS_DIR);

  // Build the response type mapping from schema files
  await buildResponseTypeMapping();

  // Process schema files (no response type unwrapping)
  console.log(`\nProcessing: ${SCHEMAS_DIR}`);
  let fixedCount = await processDirectory(SCHEMAS_DIR, false);

  // Process API files (with response type unwrapping)
  console.log(`\nProcessing: ${API_DIR}`);
  fixedCount += await processDirectory(API_DIR, true);

  console.log(`\nFixed ${fixedCount} file(s)`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
