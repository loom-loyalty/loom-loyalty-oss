/**
 * `treadle pull`: write the organization's live configuration to `loom-loyalty-config.yaml`.
 *
 * The Platform exports the configuration as a manifest; applying the pulled file to the same organization
 * plans no change, so `pull` followed by `plan` exits 0. The file is written the same way every time:
 * sections in the schema's order, records in the order the Platform sends them (by code) and no
 * timestamp, so pulling an unchanged organization changes no byte and a git diff shows only real changes.
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseDocument, stringify } from "yaml";
import { ApiError, type ApiClient } from "../api/client.js";
import { parseManifest } from "../manifest/load.js";
import {
  DEFAULT_MANIFEST_FILE,
  MANIFEST_SECTIONS,
  SCHEMA_V1,
  sectionRecordCount,
} from "../manifest/schema.js";
import { createApiClient, DEFAULT_DEPLOYMENT, DEPLOYMENTS } from "../utils/deployment.js";
import { colors } from "../utils/output.js";
import { EXIT_ERROR, EXIT_OK } from "./manifest.js";

export interface PullOptions {
  /** Where to write the manifest */
  file: string;
  /** Loom deployment: production, staging or development */
  deployment: string;
  /** A WorkOS session token or an llk_ M2M API key; without one, a browser login */
  token?: string;
  /** The manifest's code; without it, the existing file's */
  code?: string;
  /** One program's code: pull that program and everything it uses */
  program?: string;
  /** Overwrite an existing file */
  force: boolean;
}

/** Reading and writing the manifest file; the tests replace it. */
export interface PullFiles {
  /** The file's text, or null when it doesn't exist */
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
}

type Log = (line: string) => void;

// ============================================================
// Arguments
// ============================================================

export function parsePullArgs(args: string[]): PullOptions | { error: string } | { help: true } {
  const options: PullOptions = {
    file: DEFAULT_MANIFEST_FILE,
    deployment: DEFAULT_DEPLOYMENT,
    force: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const value = () => {
      const next = args[i + 1];
      if (next === undefined || next.startsWith("-")) return undefined;
      i++;
      return next;
    };
    switch (arg) {
      case "-f":
      case "--file": {
        const file = value();
        if (!file) return { error: `${arg} requires a path` };
        options.file = file;
        break;
      }
      case "--deployment": {
        const deployment = value();
        if (!deployment || !(DEPLOYMENTS as readonly string[]).includes(deployment)) {
          return { error: `--deployment must be one of ${DEPLOYMENTS.join(", ")}` };
        }
        options.deployment = deployment;
        break;
      }
      case "-t":
      case "--token": {
        const token = value();
        if (!token) return { error: `${arg} requires a token` };
        options.token = token;
        break;
      }
      case "--code": {
        const code = value();
        if (!code) return { error: "--code requires the manifest's code" };
        options.code = code;
        break;
      }
      case "--program": {
        const program = value();
        if (!program) return { error: "--program requires a program code" };
        options.program = program;
        break;
      }
      case "--force":
        options.force = true;
        break;
      case "-h":
      case "--help":
        return { help: true };
      default:
        return { error: `Unknown option: ${arg}` };
    }
  }
  return options;
}

// ============================================================
// The file
// ============================================================

/** The `code` and `name` of an existing manifest, read without validating the rest of it. */
export function readIdentity(text: string): { code?: string; name?: string } {
  const document = parseDocument(text);
  if (document.errors.length > 0) return {};
  const value = document.toJS() as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const { code, name } = value as Record<string, unknown>;
  return {
    ...(typeof code === "string" ? { code } : {}),
    ...(typeof name === "string" ? { name } : {}),
  };
}

/** The manifest's code: `--code`, else the existing file's; an error when they differ or neither is set. */
export function resolveCode(
  options: PullOptions,
  existing: { code?: string } | null
): { code: string } | { error: string } {
  if (options.code && existing?.code && options.code !== existing.code) {
    return {
      error: `--code ${options.code} differs from ${options.file}'s code ${existing.code}; pull into another file, or drop --code`,
    };
  }
  const code = options.code ?? existing?.code;
  if (!code) return { error: "--code is required: the code to give the manifest, such as acme" };
  return { code };
}

/**
 * The manifest as YAML: `schema`, `code` and `name` first, then each section in the schema's order. A
 * section with no records is left out, and so is any key this CLI doesn't know. `hub` is one object, not a
 * list, and is left out when it sets nothing.
 */
export function renderManifest(
  exported: Record<string, unknown>,
  identity: { code: string; name?: string },
  header: string[]
): string {
  const manifest: Record<string, unknown> = { schema: SCHEMA_V1, code: identity.code };
  if (identity.name) manifest.name = identity.name;
  for (const section of MANIFEST_SECTIONS) {
    const records = exported[section];
    if (sectionRecordCount(records) > 0) manifest[section] = records;
  }
  const comment = header.map((line) => `# ${line}`.trimEnd()).join("\n");
  return `${comment}\n${stringify(manifest, { lineWidth: 0, minContentWidth: 0, aliasDuplicateObjects: false })}`;
}

/** How many records `exported` holds, for the summary line. */
function countRecords(exported: Record<string, unknown>): number {
  return MANIFEST_SECTIONS.reduce(
    (total, section) => total + sectionRecordCount(exported[section]),
    0
  );
}

// ============================================================
// Command
// ============================================================

/**
 * Pulls the organization's configuration into `options.file`. The file is checked before any API call:
 * an existing one is refused without `--force`, and its code is the manifest's unless `--code` is given.
 */
export async function executePull(
  options: PullOptions,
  connect: () => Promise<ApiClient>,
  files: PullFiles,
  log: Log = console.log
): Promise<number> {
  const text = await files.read(options.file);
  if (text !== null && !options.force) {
    log(
      `${colors.red}${options.file} exists; pass --force to overwrite it (its comments are not kept).${colors.reset}`
    );
    return EXIT_ERROR;
  }
  const existing = text === null ? null : readIdentity(text);
  const resolved = resolveCode(options, existing);
  if ("error" in resolved) {
    log(`${colors.red}${resolved.error}${colors.reset}`);
    return EXIT_ERROR;
  }

  const client = await connect();
  const exported = await client.exportManifest({
    code: resolved.code,
    sections: MANIFEST_SECTIONS,
    program: options.program,
  });
  const manifest = exported.manifest ?? {};
  const source = options.program
    ? `program ${options.program} from ${options.deployment}`
    : options.deployment;
  const yaml = renderManifest(manifest, { code: resolved.code, name: existing?.name }, [
    `Pulled from ${source} with treadle pull.`,
    "Applying it to the same organization changes nothing; edit it, then run treadle plan.",
  ]);

  // The Platform's export is meant to load as it is; a file that doesn't would fail plan, so say so now.
  const loaded = parseManifest(yaml);
  if (!loaded.ok) {
    log(
      `${colors.red}The export doesn't load as a loom-loyalty-config.v1 manifest; nothing was written:${colors.reset}`
    );
    for (const problem of loaded.problems) log(`  - ${problem}`);
    return EXIT_ERROR;
  }

  await files.write(options.file, yaml);
  for (const warning of exported.warnings ?? []) {
    log(`${colors.yellow}warning:${colors.reset} ${warning}`);
  }
  log(
    `${colors.green}✓ Wrote ${countRecords(manifest)} records to ${options.file}${colors.reset} (code ${resolved.code})`
  );
  return EXIT_OK;
}

// ============================================================
// Entry point
// ============================================================

const diskFiles: PullFiles = {
  async read(path) {
    try {
      return await readFile(path, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  write: (path, text) => writeFile(path, text, "utf-8"),
};

/** Runs `pull` and returns the exit code. */
export async function runPullCommand(args: string[]): Promise<number> {
  const parsed = parsePullArgs(args);
  if ("help" in parsed) {
    printPullHelp();
    return EXIT_OK;
  }
  if ("error" in parsed) {
    console.error(`${colors.red}${parsed.error}${colors.reset}`);
    printPullHelp();
    return EXIT_ERROR;
  }
  try {
    return await executePull(
      parsed,
      () => createApiClient(parsed.deployment, parsed.token),
      diskFiles
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.describe()
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(`${colors.red}${message}${colors.reset}`);
    return EXIT_ERROR;
  }
}

export function printPullHelp(): void {
  console.log(`
treadle pull — Write the organization's live configuration to the manifest

Applying the pulled file to the same organization changes nothing, so "treadle plan" exits 0 after it.
Records another manifest or a catalog package manages are left out, as is what organization creation
seeds; each is reported as a warning.

Usage:
  treadle pull [options]

Options:
  -f, --file <path>          Manifest to write (default: ${DEFAULT_MANIFEST_FILE})
      --code <code>          The manifest's code (default: the existing file's code)
      --program <code>       Pull one program and everything it uses, not the whole organization
      --force                Overwrite an existing file; its comments are not kept
      --deployment <name>    ${DEPLOYMENTS.join(" | ")} (default: ${DEFAULT_DEPLOYMENT})
  -t, --token <token>        Skip browser login: a WorkOS session token or an llk_ API key (CI);
                             LOOM_API_TOKEN sets it without putting it on the command line
  -h, --help                 Show this help
`);
}
