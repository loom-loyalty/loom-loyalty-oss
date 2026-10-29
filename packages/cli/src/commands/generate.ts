/**
 * Generate command - authenticates, downloads OpenAPI spec, regenerates API client
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { downloadOpenApiSpec } from "../api/download-spec.js";
import { authenticateViaBrowser } from "../auth/browser-auth.js";
import { findMonorepoRoot } from "../utils/find-root.js";

interface GenerateOptions {
  /** Dashboard URL (default: https://dashboard.loomloyalty.com) */
  dashboardUrl?: string;
  /** Working directory (default: process.cwd()) */
  cwd?: string;
  /** Skip browser auth if provided: a WorkOS session token or an llk_ M2M API key (CI) */
  token?: string;
  /** Skip API client generation */
  skipGenerate?: boolean;
}

/**
 * Run the generate command
 */
export async function generate(options: GenerateOptions = {}): Promise<void> {
  const { dashboardUrl, skipGenerate = false } = options;
  const cwd = options.cwd || process.cwd();

  console.log("\n=== Loom Loyalty API Client Generator ===\n");

  // Step 1: Authenticate
  let token = options.token;

  if (!token) {
    console.log("Step 1/3: Authenticating...");
    const auth = await authenticateViaBrowser({ dashboardUrl });
    token = auth.token;
    console.log("Authentication successful!\n");
  } else {
    console.log("Step 1/3: Using provided token\n");
  }

  // Step 2: Download OpenAPI spec
  console.log("Step 2/3: Downloading OpenAPI spec...");
  // Find the monorepo root to place openapi.yaml where orval expects it
  const monorepoRoot = findMonorepoRoot(cwd);
  const outputPath = resolve(monorepoRoot, "openapi.yaml");
  await downloadOpenApiSpec({
    token,
    dashboardUrl,
    outputPath,
  });
  console.log("");

  // Step 3: Generate API client
  if (skipGenerate) {
    console.log("Step 3/3: Skipping API client generation (--skip-generate)\n");
    console.log("=== Done ===\n");
    return;
  }

  console.log("Step 3/3: Generating API client...");
  // Run SDK generation from the monorepo root
  await runPnpmGenerate(monorepoRoot);
  console.log("");
  console.log("=== Done ===\n");
}

/**
 * Run pnpm generate for the SDK package
 */
function runPnpmGenerate(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["--filter", "@loom-loyalty/sdk", "generate"], {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to run pnpm generate: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pnpm generate exited with code ${code}`));
      }
    });
  });
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): GenerateOptions {
  const options: GenerateOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    const nextArg = args[i + 1];

    // A bare `--` end-of-options marker. Ignore it rather than erroring: pnpm
    // (unlike npm) forwards this separator verbatim when a script is invoked
    // as `pnpm <script> -- <args>`, so it can legitimately appear here.
    if (arg === "--") {
      continue;
    }

    if (arg === "--dashboard-url" || arg === "-d") {
      if (!nextArg || nextArg.startsWith("-")) {
        console.error(`Error: ${arg} requires a URL value`);
        process.exit(1);
      }
      options.dashboardUrl = nextArg;
      i++;
    } else if (arg === "--token" || arg === "-t") {
      if (!nextArg || nextArg.startsWith("-")) {
        console.error(`Error: ${arg} requires a token value`);
        process.exit(1);
      }
      options.token = nextArg;
      i++;
    } else if (arg === "--skip-generate") {
      options.skipGenerate = true;
    } else if (arg === "--cwd") {
      if (!nextArg || nextArg.startsWith("-")) {
        console.error(`Error: ${arg} requires a path value`);
        process.exit(1);
      }
      options.cwd = nextArg;
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      console.error(`Error: Unknown option: ${arg}`);
      console.error('Run "treadle generate --help" for usage.');
      process.exit(1);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Loom Loyalty CLI - Generate API Client

Usage:
  treadle generate [options]

Options:
  -d, --dashboard-url <url>  Dashboard URL (default: https://dashboard.loomloyalty.com)
  -t, --token <token>        Skip browser auth; accepts a WorkOS session token or an llk_ M2M API key (CI)
  --skip-generate            Only download spec, skip API client generation
  --cwd <path>               Working directory (default: current directory)
  -h, --help                 Show this help message

Examples:
  treadle generate
  treadle generate --dashboard-url http://localhost:3000
  treadle generate --skip-generate
`);
}
