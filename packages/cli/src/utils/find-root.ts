/**
 * Utility to find the monorepo root directory
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Find the monorepo root by traversing up from the given directory
 * looking for pnpm-workspace.yaml (the definitive monorepo marker)
 */
export function findMonorepoRoot(startDir: string = process.cwd()): string {
  let currentDir = resolve(startDir);

  // Traverse up until we reach the filesystem root (when dirname returns the same path)
  while (true) {
    // Check for pnpm-workspace.yaml which definitively marks the monorepo root
    if (existsSync(join(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }

    // Also check for the root package.json with name "loom-loyalty" as fallback
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const content = readFileSync(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(content);
        if (packageJson.name === "loom-loyalty") {
          return currentDir;
        }
      } catch {
        // Ignore parse errors and continue searching
      }
    }

    const parentDir = dirname(currentDir);
    // Stop if we've reached the filesystem root
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  // If we couldn't find the root, return the original start directory
  // This allows the command to still work when run directly
  return startDir;
}
