/**
 * Config management commands for Loom Loyalty CLI.
 *
 * These commands provide:
 * - generate: Generate starter hub.config.ts from the organization's data models
 * - push: Push local hub.config.ts to the backend (which syncs to KV)
 * - pull: Pull config from the backend to local file
 * - validate: Validate local hub.config.ts
 *
 * NOTE: The CLI talks to the backend API, NOT directly to Cloudflare KV.
 * The backend is responsible for syncing configurations to Cloudflare KV.
 */

import type { HubLocalConfig } from "@loom-loyalty/core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ApiClient } from "../api/client.js";
import { DEFAULT_MANIFEST_FILE, HUB_KEYS } from "../manifest/schema.js";
import { createApiClient, DEFAULT_DEPLOYMENT, getApiUrl } from "../utils/deployment.js";
import { colors } from "../utils/output.js";

// ============================================================
// Option Interfaces
// ============================================================

export interface ConfigGenerateOptions {
  /** Deployment to fetch data models from (production, staging, development) */
  environment: string;
  /** Output file path */
  output: string;
}

export interface ConfigPushOptions {
  /** Environment (production, staging, development) */
  environment: string;
  /** Organization slug */
  org: string;
  /** Path to hub.config.ts file */
  configFile: string;
  /** Dry run - show what would be pushed without pushing */
  dryRun: boolean;
}

export interface ConfigPullOptions {
  /** Environment (production, staging, development) */
  environment: string;
  /** Organization slug */
  org: string;
  /** Output file path */
  output: string;
}

export interface ConfigValidateOptions {
  /** Path to hub.config.ts file */
  configFile: string;
}

// ============================================================
// Authentication
// ============================================================

/**
 * Get token from ApiClient (accessing private field for API calls)
 */
function getClientToken(client: ApiClient): string {
  return (client as unknown as { token: string }).token;
}

// ============================================================
// Config Generate Command
// ============================================================

/**
 * Generate a starter hub.config.ts from the organization's data models.
 *
 * Fetches the data models from the Platform, then generates a hub.config.ts
 * with entity overrides pre-populated.
 */
export async function configGenerate(options: ConfigGenerateOptions): Promise<void> {
  console.log(`\n${colors.cyan}Loom Config Generate${colors.reset}`);
  console.log("═".repeat(50));
  console.log(`Output: ${resolve(options.output)}`);
  console.log("");

  console.log(`${colors.dim}Fetching data models from ${options.environment}...${colors.reset}`);
  const client = await createApiClient(options.environment);
  const models = await client.getDataModels();
  const entityNames = models.map((m) => m.type.code);

  console.log(`${colors.green}✓ Found ${entityNames.length} entities${colors.reset}\n`);

  // Generate the hub.config.ts file
  const configContent = generateConfigFile(entityNames);

  // Ensure output directory exists
  await mkdir(dirname(resolve(options.output)), { recursive: true });

  // Write the file
  await writeFile(resolve(options.output), configContent, "utf-8");

  console.log(`${colors.green}✓ Generated ${options.output}${colors.reset}`);
  console.log(`\nEdit the file to customize your Hub configuration.`);
}

/**
 * Generate the content of a hub.config.ts file.
 */
function generateConfigFile(entityNames: string[]): string {
  const entityOverridesLines = entityNames
    .map((name) => {
      const label = toDisplayLabel(name);
      return `    // ${name}: {
    //   label: { singular: '${label}', plural: '${pluralize(label)}' },
    //   hidden: false,
    //   readonly: false,
    // },`;
    })
    .join("\n");

  return `/**
 * Loom Loyalty Hub Configuration
 *
 * This file defines Hub-specific UI settings for your organization.
 * Organization identity, API config, branding, and features are
 * fetched from the backend when you run \`treadle config push\`.
 *
 * @see https://github.com/loom-loyalty/loom-loyalty/blob/main/prds/hub-consolidated-prd.md
 */
import { defineLocalConfig } from '@loom-loyalty/core';

export default defineLocalConfig({
  /**
   * UI behavior settings
   */
  uiSettings: {
    /** Show API explorer in the Hub */
    showApiExplorer: false,
    /** Default view mode for entity lists */
    defaultListView: 'table',
  },

  /**
   * Per-entity display overrides
   * Uncomment and customize entities as needed.
   */
  entityOverrides: {
${entityOverridesLines}
  },

  /**
   * Theme color overrides (optional)
   * These will override the organization's default branding colors.
   */
  // theme: {
  //   primaryColor: '#0e7490',
  //   secondaryColor: '#f59e0b',
  // },

  /**
   * Custom component configuration (optional)
   * Load custom components from an external manifest.
   */
  // customComponents: {
  //   manifestUrl: 'https://cdn.example.com/hub-components/manifest.json',
  //   version: '1.0.0',
  // },
});
`;
}

/**
 * Convert snake_case entity name to Title Case display label.
 */
function toDisplayLabel(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Simple pluralization.
 */
function pluralize(word: string): string {
  if (word.endsWith("y") && !word.endsWith("ey") && !word.endsWith("oy")) {
    return word.slice(0, -1) + "ies";
  }
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("ch") || word.endsWith("sh")) {
    return word + "es";
  }
  return word + "s";
}

// ============================================================
// Config Validate Command
// ============================================================

/**
 * Validate a hub.config.ts file locally.
 */
export async function configValidate(options: ConfigValidateOptions): Promise<void> {
  console.log(`\n${colors.cyan}Loom Config Validate${colors.reset}`);
  console.log("═".repeat(50));
  console.log(`Config: ${resolve(options.configFile)}`);
  console.log("");

  try {
    // Load and validate the config file
    const config = await loadLocalConfig(options.configFile);

    console.log(`${colors.green}✓ Configuration is valid${colors.reset}\n`);

    // Display summary
    console.log("Configuration summary:");
    console.log(`  UI Settings:`);
    console.log(`    - showApiExplorer: ${config.uiSettings?.showApiExplorer ?? "false"}`);
    console.log(`    - defaultListView: ${config.uiSettings?.defaultListView ?? "table"}`);

    const overrideCount = Object.keys(config.entityOverrides ?? {}).length;
    console.log(`  Entity Overrides: ${overrideCount}`);

    if (config.theme) {
      console.log(`  Theme:`);
      if (config.theme.primaryColor) {
        console.log(`    - primaryColor: ${config.theme.primaryColor}`);
      }
      if (config.theme.secondaryColor) {
        console.log(`    - secondaryColor: ${config.theme.secondaryColor}`);
      }
    }

    if (config.customComponents) {
      console.log(`  Custom Components:`);
      console.log(`    - manifestUrl: ${config.customComponents.manifestUrl}`);
      console.log(`    - version: ${config.customComponents.version}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${colors.red}✗ Validation failed: ${message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Load and validate a local hub.config.ts file.
 */
async function loadLocalConfig(configFile: string): Promise<HubLocalConfig> {
  const fullPath = resolve(configFile);

  // Check if file exists
  try {
    await readFile(fullPath, "utf-8");
  } catch {
    throw new Error(`Config file not found: ${fullPath}`);
  }

  // Dynamic import of the config file
  // We use tsx to load TypeScript files
  try {
    const module = await import(fullPath);
    const config = module.default as HubLocalConfig;

    // Basic validation
    validateLocalConfig(config);

    return config;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot find module")) {
      throw new Error(`Failed to load config file: ${fullPath}`);
    }
    throw error;
  }
}

/**
 * Validate a HubLocalConfig object.
 */
function validateLocalConfig(config: HubLocalConfig): void {
  // Validate theme colors
  if (config.theme?.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.theme.primaryColor)) {
    throw new Error(
      `Invalid primary color format: ${config.theme.primaryColor}. Use hex format (#RRGGBB)`
    );
  }
  if (config.theme?.secondaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.theme.secondaryColor)) {
    throw new Error(
      `Invalid secondary color format: ${config.theme.secondaryColor}. Use hex format (#RRGGBB)`
    );
  }

  // Validate custom components URL
  if (config.customComponents?.manifestUrl) {
    try {
      new URL(config.customComponents.manifestUrl);
    } catch {
      throw new Error(`Invalid manifest URL: ${config.customComponents.manifestUrl}`);
    }
  }

  // Validate defaultListView
  if (
    config.uiSettings?.defaultListView &&
    !["table", "cards"].includes(config.uiSettings.defaultListView)
  ) {
    throw new Error(
      `Invalid defaultListView: ${config.uiSettings.defaultListView}. Use 'table' or 'cards'`
    );
  }
}

// ============================================================
// Config Push Command
// ============================================================

/**
 * Hub config response from the backend API.
 * Based on the FE Integration PRD.
 */
interface HubConfigResponse {
  hubConfigId: string;
  organizationEnvironmentId: string;
  subdomain: string;
  customDomain?: string;
  status: "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "DELETED";
  lastDeployedAt?: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
  featureFlags?: Record<string, boolean>;
  customComponents?: {
    manifestUrl: string;
    currentVersion: string;
    deployedAt: string;
  };
}

/**
 * Push local hub.config.ts to the backend.
 *
 * The backend will:
 * 1. Validate the configuration
 * 2. Store it in the database
 * 3. Sync it to Cloudflare KV
 *
 * Flow:
 * 1. Load local hub.config.ts
 * 2. Get existing hub config by subdomain (if exists)
 * 3. Create or update the hub config via backend API
 */
export async function configPush(options: ConfigPushOptions): Promise<void> {
  console.log(`\n${colors.cyan}Loom Config Push${colors.reset}`);
  console.log("═".repeat(50));
  console.log(`Environment: ${options.environment}`);
  console.log(`Organization: ${options.org}`);
  console.log(`Config: ${resolve(options.configFile)}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log("");

  // Load local config
  console.log(`${colors.dim}Loading local configuration...${colors.reset}`);
  const localConfig = await loadLocalConfig(options.configFile);
  console.log(`${colors.green}✓ Local config loaded${colors.reset}`);

  // Authenticate
  const client = await createApiClient(options.environment);
  const baseUrl = getApiUrl(options.environment);
  const token = getClientToken(client);

  // Check if hub config exists for this subdomain
  console.log(`${colors.dim}Checking for existing hub config...${colors.reset}`);
  const existingConfig = await getHubConfigBySubdomain(baseUrl, token, options.org);

  // Build the update payload
  const updatePayload = {
    subdomain: options.org,
    theme: localConfig.theme
      ? {
          primaryColor: localConfig.theme.primaryColor,
          secondaryColor: localConfig.theme.secondaryColor,
        }
      : undefined,
    featureFlags: {
      showApiExplorer: localConfig.uiSettings?.showApiExplorer ?? false,
    },
    // Entity overrides are part of the full config sync
    entityOverrides: localConfig.entityOverrides,
    uiSettings: localConfig.uiSettings,
    customComponents: localConfig.customComponents
      ? {
          manifestUrl: localConfig.customComponents.manifestUrl,
          version: localConfig.customComponents.version,
        }
      : undefined,
  };

  // Display what will be pushed
  console.log("\nConfiguration to push:");
  console.log(`  Subdomain: ${options.org}`);
  if (localConfig.theme?.primaryColor) {
    console.log(`  Primary Color: ${localConfig.theme.primaryColor}`);
  }
  if (localConfig.uiSettings) {
    console.log(`  Show API Explorer: ${localConfig.uiSettings.showApiExplorer ?? false}`);
    console.log(`  Default List View: ${localConfig.uiSettings.defaultListView ?? "table"}`);
  }
  const overrideCount = Object.keys(localConfig.entityOverrides ?? {}).length;
  if (overrideCount > 0) {
    console.log(`  Entity Overrides: ${overrideCount}`);
  }
  if (localConfig.customComponents) {
    console.log(`  Custom Components: ${localConfig.customComponents.manifestUrl}`);
  }
  console.log("");

  if (options.dryRun) {
    console.log(`${colors.yellow}Dry run - skipping push${colors.reset}`);
    console.log("\nPayload that would be sent:");
    console.log(JSON.stringify(updatePayload, null, 2));
    return;
  }

  // Create or update the hub config
  if (existingConfig) {
    console.log(`${colors.dim}Updating existing hub config...${colors.reset}`);
    await updateHubConfig(baseUrl, token, existingConfig.hubConfigId, updatePayload);
    console.log(`${colors.green}✓ Hub config updated${colors.reset}`);
  } else {
    console.log(`${colors.dim}Creating new hub config...${colors.reset}`);
    await createHubConfig(baseUrl, token, updatePayload);
    console.log(`${colors.green}✓ Hub config created${colors.reset}`);
  }

  console.log(`\nHub will be available at: https://${options.org}.weave.host`);
  console.log(`${colors.dim}(Config will be synced to KV by the backend)${colors.reset}`);
}

/**
 * Get hub config by subdomain.
 */
async function getHubConfigBySubdomain(
  baseUrl: string,
  token: string,
  subdomain: string
): Promise<HubConfigResponse | null> {
  try {
    const response = await fetch(`${baseUrl}/hub-configs/by-subdomain/${subdomain}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch hub config: ${response.statusText}`);
    }

    const data = (await response.json()) as { data: HubConfigResponse };
    return data.data;
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof Error && error.message.includes("fetch")) {
      console.log(`${colors.yellow}⚠ Could not reach backend API - is it running?${colors.reset}`);
      return null;
    }
    throw error;
  }
}

/**
 * Create a new hub config.
 */
async function createHubConfig(
  baseUrl: string,
  token: string,
  payload: Record<string, unknown>
): Promise<HubConfigResponse> {
  const response = await fetch(`${baseUrl}/hub-configs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create hub config: ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as { data: HubConfigResponse };
  return data.data;
}

/**
 * Update an existing hub config.
 */
async function updateHubConfig(
  baseUrl: string,
  token: string,
  hubConfigId: string,
  payload: Record<string, unknown>
): Promise<HubConfigResponse> {
  const response = await fetch(`${baseUrl}/hub-configs/${hubConfigId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update hub config: ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as { data: HubConfigResponse };
  return data.data;
}

// ============================================================
// Config Pull Command
// ============================================================

/**
 * Pull config from the backend to local file.
 */
export async function configPull(options: ConfigPullOptions): Promise<void> {
  console.log(`\n${colors.cyan}Loom Config Pull${colors.reset}`);
  console.log("═".repeat(50));
  console.log(`Environment: ${options.environment}`);
  console.log(`Organization: ${options.org}`);
  console.log(`Output: ${resolve(options.output)}`);
  console.log("");

  // Authenticate
  const client = await createApiClient(options.environment);
  const baseUrl = getApiUrl(options.environment);
  const token = getClientToken(client);

  // Fetch hub config from backend
  console.log(`${colors.dim}Fetching hub config from backend...${colors.reset}`);
  const hubConfig = await getHubConfigBySubdomain(baseUrl, token, options.org);

  if (!hubConfig) {
    console.log(`${colors.red}✗ No hub config found for ${options.org}${colors.reset}`);
    console.log(`\nTo create a hub config, run: treadle config push --org ${options.org}`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ Hub config fetched${colors.reset}\n`);

  // Convert to local config format
  const localConfig: HubLocalConfig = {
    uiSettings: {
      showApiExplorer: hubConfig.featureFlags?.showApiExplorer ?? false,
      defaultListView: "table",
    },
    theme: hubConfig.theme
      ? {
          primaryColor: hubConfig.theme.primaryColor,
          secondaryColor: hubConfig.theme.secondaryColor,
        }
      : undefined,
    customComponents: hubConfig.customComponents
      ? {
          manifestUrl: hubConfig.customComponents.manifestUrl,
          version: hubConfig.customComponents.currentVersion,
        }
      : undefined,
  };

  // Generate hub.config.ts content
  const configContent = `/**
 * Loom Loyalty Hub Configuration
 * Pulled from ${options.environment} environment for ${options.org}
 * Hub Config ID: ${hubConfig.hubConfigId}
 * Status: ${hubConfig.status}
 *
 * @see https://github.com/loom-loyalty/loom-loyalty/blob/main/prds/hub-consolidated-prd.md
 */
import { defineLocalConfig } from '@loom-loyalty/core';

export default defineLocalConfig(${JSON.stringify(localConfig, null, 2)});
`;

  // Ensure output directory exists
  await mkdir(dirname(resolve(options.output)), { recursive: true });

  // Write the file
  await writeFile(resolve(options.output), configContent, "utf-8");

  console.log(`${colors.green}✓ Wrote ${options.output}${colors.reset}`);
}

// ============================================================
// Command Runner
// ============================================================

/**
 * Parse config command arguments and run the appropriate subcommand.
 */
export async function runConfigCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "generate": {
      const options = parseGenerateArgs(args.slice(1));
      await configGenerate(options);
      break;
    }

    case "validate": {
      const options = parseValidateArgs(args.slice(1));
      await configValidate(options);
      break;
    }

    case "push": {
      const options = parsePushArgs(args.slice(1));
      printHubSectionHint("push");
      await configPush(options);
      break;
    }

    case "pull": {
      const options = parsePullArgs(args.slice(1));
      printHubSectionHint("pull");
      await configPull(options);
      break;
    }

    case "help":
    case "--help":
    case "-h":
    case undefined:
      printConfigHelp();
      break;

    default:
      console.error(`Unknown config subcommand: ${subcommand}`);
      console.error('Run "treadle config help" for usage.\n');
      process.exit(1);
  }
}

/**
 * `config push` and `config pull` give way to the manifest's `hub:` section, which `treadle apply` and
 * `treadle pull` manage and `--env` promotes through the approval workflow. A manifest can't create a hub
 * or set its custom components, so these commands stay for that until it can.
 */
export function printHubSectionHint(subcommand: "push" | "pull"): void {
  const replacement = subcommand === "push" ? "treadle apply" : "treadle pull";
  const remaining =
    subcommand === "push"
      ? "to create a hub or set its custom components"
      : "for custom components";
  console.error(
    `${colors.yellow}treadle config ${subcommand} is deprecated: declare the hub's ${HUB_KEYS.join(", ")} in ${DEFAULT_MANIFEST_FILE} (hub:) and use ${replacement}. Use config ${subcommand} only ${remaining}.${colors.reset}`
  );
}

// ============================================================
// Argument Parsing
// ============================================================

/**
 * An option a subcommand doesn't take stops it, so a typo can't fall through to the default
 * (production) deployment. `-e/--env` named the deployment until 0.6.0; it now means an organization
 * environment code, and only `plan`/`apply` take it.
 */
function rejectOption(subcommand: string, arg: string): never {
  if (arg === "-e" || arg === "--env") {
    console.error(
      `Error: treadle config ${subcommand} no longer takes ${arg}; use --deployment <name>.`
    );
  } else {
    console.error(`Error: unknown option ${arg}`);
  }
  console.error(`Run "treadle config ${subcommand} --help" for usage.\n`);
  process.exit(1);
}

function parseGenerateArgs(args: string[]): ConfigGenerateOptions {
  const options: ConfigGenerateOptions = {
    environment: DEFAULT_DEPLOYMENT,
    output: "hub.config.ts",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--deployment":
        options.environment = args[++i] ?? options.environment;
        break;
      case "-o":
      case "--output":
        options.output = args[++i] ?? options.output;
        break;
      case "-h":
      case "--help":
        printGenerateHelp();
        process.exit(0);
      // eslint-disable-next-line no-fallthrough -- process.exit() never returns
      default:
        if (arg?.startsWith("-")) rejectOption("generate", arg);
    }
  }

  return options;
}

function parseValidateArgs(args: string[]): ConfigValidateOptions {
  const options: ConfigValidateOptions = {
    configFile: "hub.config.ts",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-h":
      case "--help":
        printValidateHelp();
        process.exit(0);
      // eslint-disable-next-line no-fallthrough -- process.exit() never returns
      default:
        // Positional argument - treat as config file
        if (!arg?.startsWith("-")) {
          options.configFile = arg ?? options.configFile;
        }
    }
  }

  return options;
}

function parsePushArgs(args: string[]): ConfigPushOptions {
  const options: ConfigPushOptions = {
    environment: DEFAULT_DEPLOYMENT,
    org: "",
    configFile: "hub.config.ts",
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--deployment":
        options.environment = args[++i] ?? options.environment;
        break;
      case "--org":
        options.org = args[++i] ?? "";
        break;
      case "-c":
      case "--config":
        options.configFile = args[++i] ?? options.configFile;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "-h":
      case "--help":
        printPushHelp();
        process.exit(0);
      // eslint-disable-next-line no-fallthrough -- process.exit() never returns
      default:
        if (arg?.startsWith("-")) rejectOption("push", arg);
    }
  }

  if (!options.org) {
    console.error("Error: --org is required");
    console.error('Run "treadle config push --help" for usage.\n');
    process.exit(1);
  }

  return options;
}

function parsePullArgs(args: string[]): ConfigPullOptions {
  const options: ConfigPullOptions = {
    environment: DEFAULT_DEPLOYMENT,
    org: "",
    output: "hub.config.ts",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--deployment":
        options.environment = args[++i] ?? options.environment;
        break;
      case "--org":
        options.org = args[++i] ?? "";
        break;
      case "-o":
      case "--output":
        options.output = args[++i] ?? options.output;
        break;
      case "-h":
      case "--help":
        printPullHelp();
        process.exit(0);
      // eslint-disable-next-line no-fallthrough -- process.exit() never returns
      default:
        if (arg?.startsWith("-")) rejectOption("pull", arg);
    }
  }

  if (!options.org) {
    console.error("Error: --org is required");
    console.error('Run "treadle config pull --help" for usage.\n');
    process.exit(1);
  }

  return options;
}

// ============================================================
// Help Messages
// ============================================================

function printConfigHelp(): void {
  console.log(`
Loom Config - Hub configuration management

Usage:
  treadle config <command> [options]

Commands:
  generate    Generate starter hub.config.ts from the organization's data models
  validate    Validate local hub.config.ts
  push        Push local hub.config.ts to the backend
  pull        Pull config from the backend to local file
  help        Show this help message

Run "treadle config <command> --help" for more information on a command.
`);
}

function printGenerateHelp(): void {
  console.log(`
Generate starter hub.config.ts from the organization's data models

Usage:
  treadle config generate [options]

Options:
  --deployment <name>  production, staging or development (default: production)
  -o, --output <path>  Output file path (default: hub.config.ts)
  -h, --help           Show this help message

Examples:
  treadle config generate                             # From production's data models
  treadle config generate --deployment staging        # From staging
  treadle config generate -o ./config/hub.config.ts   # Custom output path
`);
}

function printValidateHelp(): void {
  console.log(`
Validate local hub.config.ts

Usage:
  treadle config validate [config-file]

Arguments:
  config-file   Path to hub.config.ts (default: ./hub.config.ts)

Options:
  -h, --help    Show this help message

Examples:
  treadle config validate                   # Validate ./hub.config.ts
  treadle config validate ./config/hub.config.ts  # Validate specific file
`);
}

function printPushHelp(): void {
  console.log(`
Push local hub.config.ts to the backend

Usage:
  treadle config push --org <slug> [options]

Required:
  --org <slug>         Organization slug (e.g., "acme")

Options:
  --deployment <name>  production, staging or development (default: production)
  -c, --config <path>  Config file path (default: hub.config.ts)
  --dry-run            Show what would be pushed without pushing
  -h, --help           Show this help message

The push command:
1. Loads your local hub.config.ts
2. Authenticates with the backend
3. Creates or updates the hub configuration
4. The backend syncs the config to Cloudflare KV

Examples:
  treadle config push --org acme                 # Push to production for acme
  treadle config push --org acme --deployment staging  # Push to staging
  treadle config push --org acme --dry-run       # Preview what would be pushed
`);
}

function printPullHelp(): void {
  console.log(`
Pull config from the backend to local file

Usage:
  treadle config pull --org <slug> [options]

Required:
  --org <slug>         Organization slug (e.g., "acme")

Options:
  --deployment <name>  production, staging or development (default: production)
  -o, --output <path>  Output file path (default: hub.config.ts)
  -h, --help           Show this help message

Examples:
  treadle config pull --org acme                       # Pull from production
  treadle config pull --org acme --deployment staging  # Pull from staging
  treadle config pull --org acme -o ./config/hub.config.ts  # Custom output
`);
}
