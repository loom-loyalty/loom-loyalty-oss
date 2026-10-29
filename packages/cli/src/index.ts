/**
 * treadle — the Loom Loyalty CLI
 *
 * Commands:
 * - generate: Download OpenAPI spec and regenerate API client
 * - plan, apply, status: Manage the organization's configuration from loom-loyalty-config.yaml
 * - pull: Write the organization's live configuration to loom-loyalty-config.yaml
 * - config: Manage Hub configuration (generate, push, pull, validate)
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runConfigCommand } from "./commands/config.js";
import { generate, parseArgs } from "./commands/generate.js";
import { runManifestCommand } from "./commands/manifest.js";
import { runPullCommand } from "./commands/pull.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export { downloadOpenApiSpec } from "./api/download-spec.js";
export { authenticateViaBrowser } from "./auth/browser-auth.js";
export {
  configGenerate,
  configPull,
  configPush,
  configValidate,
  runConfigCommand,
} from "./commands/config.js";
export { generate } from "./commands/generate.js";
export { runManifestCommand } from "./commands/manifest.js";
export { runPullCommand } from "./commands/pull.js";
export { loadManifest, parseManifest } from "./manifest/load.js";
export type { TenantManifest } from "./manifest/schema.js";

/**
 * Main CLI entry point
 */
export async function main(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case "generate":
    case undefined: {
      // Default to generate command
      const options = parseArgs(args.slice(command === "generate" ? 1 : 0));
      await generate(options);
      break;
    }

    case "plan":
    case "apply":
    case "status": {
      process.exitCode = await runManifestCommand(command, args.slice(1));
      break;
    }

    case "pull": {
      process.exitCode = await runPullCommand(args.slice(1));
      break;
    }

    case "schema":
      console.error(
        'treadle schema was removed: data models are declared in loom-loyalty-config.yaml (dataModels) and applied with "treadle apply".'
      );
      process.exitCode = 1;
      break;

    case "config": {
      // Hub configuration management commands
      await runConfigCommand(args.slice(1));
      break;
    }

    case "help":
    case "--help":
    case "-h":
      printMainHelp();
      break;

    case "version":
    case "--version":
    case "-v":
      await printVersion();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "treadle help" for usage.\n');
      process.exit(1);
  }
}

function printMainHelp(): void {
  console.log(`
treadle — the Loom Loyalty CLI

Usage:
  treadle <command> [options]

Commands:
  generate    Download OpenAPI spec and regenerate API client (default)
  plan        Show what applying loom-loyalty-config.yaml would change
  apply       Apply loom-loyalty-config.yaml; --env promotes through the approval workflow
  status      List workflow requests waiting for the manifest's records
  pull        Write the organization's live configuration to loom-loyalty-config.yaml
  config      Hub configuration files; the manifest's hub: section replaces push and pull
  help        Show this help message
  version     Show version number

Run "treadle <command> --help" for more information on a command.
`);
}

async function printVersion(): Promise<void> {
  try {
    // Read version from package.json
    const packageJsonPath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
    console.log(`@loom-loyalty/cli v${packageJson.version}`);
  } catch {
    console.log("@loom-loyalty/cli (version unknown)");
  }
}
