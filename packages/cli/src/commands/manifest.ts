/**
 * `treadle plan`, `treadle apply` and `treadle status`: manage an organization's configuration from
 * `loom-loyalty-config.yaml`.
 *
 * - plan: what applying the file would do to each record. Exits 0 when nothing would change, 2 when
 *   something would, 1 on an error, a conflict or a blocked record, so CI can gate on it.
 * - apply: shows the plan, then applies it. With `--env`, it also opens the approval workflow requests
 *   that promote the records into that organization environment.
 * - status: the workflow requests still open for the records the file manages.
 */

import { createInterface } from "node:readline/promises";
import { ApiError, type ApiClient } from "../api/client.js";
import type {
  PackageInstallationResult,
  PackageInstallPlanRecord,
  PackagePromotion,
  WorkflowRequest,
} from "../api/types.js";
import { loadManifest } from "../manifest/load.js";
import { DEFAULT_MANIFEST_FILE, type TenantManifest } from "../manifest/schema.js";
import { createApiClient, DEFAULT_DEPLOYMENT, DEPLOYMENTS } from "../utils/deployment.js";
import { colors } from "../utils/output.js";

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_CHANGES = 2;

export interface ManifestOptions {
  /** Path to the manifest */
  file: string;
  /** Organization environment code to promote into (apply) or to check promotion into (plan) */
  env?: string;
  /** Loom deployment: production, staging or development */
  deployment: string;
  /** A WorkOS session token or an llk_ M2M API key; without one, a browser login */
  token?: string;
  /** apply: skip the confirmation */
  yes: boolean;
}

/** Actions that leave a record as it is. */
const NO_CHANGE = new Set(["UNCHANGED"]);
/** Actions that stop an install: nothing is written while any record has one. */
const STOPS = new Set(["CONFLICT", "BLOCKED"]);

const SYMBOLS: Record<string, string> = {
  CREATE: `${colors.green}+${colors.reset}`,
  ADOPT: `${colors.cyan}&${colors.reset}`,
  UPDATE: `${colors.yellow}~${colors.reset}`,
  UNCHANGED: `${colors.dim}=${colors.reset}`,
  CONFLICT: `${colors.red}!${colors.reset}`,
  BLOCKED: `${colors.red}x${colors.reset}`,
};

// ============================================================
// Arguments
// ============================================================

export function parseManifestArgs(
  args: string[]
): ManifestOptions | { error: string } | { help: true } {
  const options: ManifestOptions = {
    file: DEFAULT_MANIFEST_FILE,
    deployment: DEFAULT_DEPLOYMENT,
    yes: false,
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
      case "--env": {
        const env = value();
        if (!env) return { error: "--env requires an organization environment code, such as prod" };
        options.env = env;
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
      case "-y":
      case "--yes":
        options.yes = true;
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
// Plan results
// ============================================================

export interface PlanSummary {
  counts: Record<string, number>;
  changes: number;
  stops: number;
}

export function records(result: PackageInstallationResult): PackageInstallPlanRecord[] {
  return result.packages.flatMap((plan) => plan.records);
}

export function summarize(result: PackageInstallationResult): PlanSummary {
  const counts: Record<string, number> = {};
  let changes = 0;
  let stops = 0;
  for (const record of records(result)) {
    counts[record.action] = (counts[record.action] ?? 0) + 1;
    if (STOPS.has(record.action)) stops++;
    // An action this CLI doesn't know is counted as a change, so a gate never passes it silently.
    else if (!NO_CHANGE.has(record.action)) changes++;
  }
  return { counts, changes, stops };
}

/** plan's exit code: 1 when anything stops the install, 2 when something would change, else 0. */
export function planExitCode(result: PackageInstallationResult): number {
  const summary = summarize(result);
  if (result.conflicted || summary.stops > 0) return EXIT_ERROR;
  return summary.changes > 0 ? EXIT_CHANGES : EXIT_OK;
}

export function renderPlan(result: PackageInstallationResult): string {
  const lines: string[] = [];
  const all = records(result);
  const kindWidth = Math.max(4, ...all.map((record) => record.kind.length));
  for (const record of all) {
    const symbol = SYMBOLS[record.action] ?? "?";
    const reason = record.reason ? `  ${colors.dim}${record.reason}${colors.reset}` : "";
    lines.push(
      `  ${symbol} ${record.action.padEnd(9)} ${record.kind.padEnd(kindWidth)} ${record.code}${reason}`
    );
  }
  const { counts } = summarize(result);
  const parts = Object.entries(counts).map(([action, count]) => `${count} ${action.toLowerCase()}`);
  lines.push("");
  lines.push(`Plan: ${parts.length > 0 ? parts.join(", ") : "no records"}.`);
  return lines.join("\n");
}

export function renderPromotions(promotions: PackagePromotion[]): string {
  return promotions
    .map((promotion) => {
      const failed = promotion.status === "FAILED";
      const color = failed ? colors.red : colors.green;
      const request = promotion.workflowRequestId ? ` request ${promotion.workflowRequestId}` : "";
      const message = promotion.message ? `: ${promotion.message}` : "";
      return `  ${color}${promotion.status ?? "?"}${colors.reset} ${promotion.entityType} x${promotion.entityCount}${request}${message}`;
    })
    .join("\n");
}

// ============================================================
// Commands
// ============================================================

type Log = (line: string) => void;

/** Asks the person to confirm; false when they decline or no one can be asked. */
export type Confirm = (question: string) => Promise<boolean>;

export async function executePlan(
  options: ManifestOptions,
  manifest: TenantManifest,
  client: ApiClient,
  log: Log = console.log
): Promise<number> {
  const result = await client.installManifest({
    code: manifest.code,
    manifest,
    dryRun: true,
    targetEnvironmentCode: options.env,
  });
  log(renderPlan(result));
  const code = planExitCode(result);
  if (code === EXIT_ERROR) {
    log(
      `\n${colors.red}Conflicted or blocked records stop the install; nothing would be written.${colors.reset}`
    );
  } else if (options.env) {
    log(
      `\n${colors.dim}apply --env ${options.env} opens workflow requests for records not yet in ${options.env}.${colors.reset}`
    );
  }
  return code;
}

export async function executeApply(
  options: ManifestOptions,
  manifest: TenantManifest,
  client: ApiClient,
  confirm: Confirm,
  log: Log = console.log
): Promise<number> {
  const planCode = await executePlan(options, manifest, client, log);
  if (planCode === EXIT_ERROR) return EXIT_ERROR;
  if (planCode === EXIT_OK && !options.env) {
    log(`\n${colors.green}No changes.${colors.reset}`);
    return EXIT_OK;
  }
  const question = options.env
    ? `Apply ${manifest.code} and open workflow requests into ${options.env}?`
    : `Apply ${manifest.code}?`;
  if (!options.yes && !(await confirm(question))) {
    log("Not applied.");
    return EXIT_ERROR;
  }

  const result = await client.installManifest({
    code: manifest.code,
    manifest,
    dryRun: false,
    targetEnvironmentCode: options.env,
  });
  if (!result.applied || result.conflicted) {
    // The organization changed between the plan and the apply.
    log(`\n${colors.red}Not applied: the plan changed since it was shown.${colors.reset}\n`);
    log(renderPlan(result));
    return EXIT_ERROR;
  }
  log(`\n${colors.green}✓ Applied ${manifest.code}${colors.reset}`);
  const promotions = result.promotions ?? [];
  if (options.env) {
    if (promotions.length === 0) {
      log(
        `Nothing to promote into ${options.env}: every record is there or already awaits approval.`
      );
    } else {
      log(`\nWorkflow requests into ${options.env} (nothing is enabled there until approved):`);
      log(renderPromotions(promotions));
    }
    if (promotions.some((promotion) => promotion.status === "FAILED")) {
      log(`\n${colors.red}A request failed to open; apply again to retry the rest.${colors.reset}`);
      return EXIT_ERROR;
    }
  }
  return EXIT_OK;
}

/** The ids of the records an installation's ledger names (`record:<KIND>:<code>` → id). */
export function managedIds(resources: Record<string, unknown> | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(resources ?? {})) {
    if (key.startsWith("record:") && typeof value === "string") ids.add(value);
  }
  return ids;
}

const OPEN = new Set(["PENDING", "IN_PROGRESS"]);

/** The open workflow requests that carry any of `ids`. */
export function openRequestsFor(requests: WorkflowRequest[], ids: Set<string>): WorkflowRequest[] {
  return requests.filter(
    (request) =>
      OPEN.has(request.status) &&
      (request.entities ?? []).some((entity) => ids.has(entity.entityId))
  );
}

export async function executeStatus(
  manifest: TenantManifest,
  client: ApiClient,
  log: Log = console.log
): Promise<number> {
  const installation = await client.findInstallation(manifest.code);
  if (!installation) {
    log(`${manifest.code} has not been applied to this organization yet.`);
    return EXIT_OK;
  }
  const ids = managedIds(installation.resources);
  const open = openRequestsFor(await client.listWorkflowRequests(), ids);
  if (open.length === 0) {
    log(
      `${colors.green}No workflow requests are waiting for ${manifest.code}'s records.${colors.reset}`
    );
    return EXIT_OK;
  }
  log(`Workflow requests waiting for ${manifest.code}'s records:`);
  for (const request of open) {
    const types = new Map<string, number>();
    for (const entity of request.entities ?? []) {
      if (ids.has(entity.entityId))
        types.set(entity.entityType, (types.get(entity.entityType) ?? 0) + 1);
    }
    const carried = [...types].map(([type, count]) => `${type} x${count}`).join(", ");
    const requested = request.requestedDateTime
      ? `  ${colors.dim}${request.requestedDateTime}${colors.reset}`
      : "";
    log(
      `  ${colors.yellow}${request.status}${colors.reset} ${request.environmentWorkflowRequestId}  ${carried}${requested}`
    );
  }
  return EXIT_OK;
}

// ============================================================
// Entry points
// ============================================================

async function confirmOnTerminal(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      `${colors.red}No terminal to confirm on; pass --yes to apply without asking.${colors.reset}`
    );
    return false;
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`\n${question} Only "yes" applies: `);
    return answer.trim() === "yes";
  } finally {
    readline.close();
  }
}

/** Runs `plan`, `apply` or `status` and returns the exit code. */
export async function runManifestCommand(
  command: "plan" | "apply" | "status",
  args: string[]
): Promise<number> {
  const parsed = parseManifestArgs(args);
  if ("help" in parsed) {
    printManifestHelp(command);
    return EXIT_OK;
  }
  if ("error" in parsed) {
    console.error(`${colors.red}${parsed.error}${colors.reset}`);
    printManifestHelp(command);
    return EXIT_ERROR;
  }

  const loaded = await loadManifest(parsed.file);
  if (!loaded.ok) {
    console.error(
      `${colors.red}${parsed.file} is not a valid loom-loyalty-config.v1 manifest:${colors.reset}`
    );
    for (const problem of loaded.problems) console.error(`  - ${problem}`);
    return EXIT_ERROR;
  }

  try {
    const client = await createApiClient(parsed.deployment, parsed.token);
    switch (command) {
      case "plan":
        return await executePlan(parsed, loaded.manifest, client);
      case "apply":
        return await executeApply(parsed, loaded.manifest, client, confirmOnTerminal);
      case "status":
        return await executeStatus(loaded.manifest, client);
    }
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

export function printManifestHelp(command: "plan" | "apply" | "status"): void {
  const summary = {
    plan: "Show what applying the manifest would change. Exits 0 (no changes), 2 (changes) or 1 (error, conflict or blocked).",
    apply:
      "Apply the manifest; with --env, also open workflow requests that promote its records into that environment.",
    status: "List the workflow requests still waiting for the records the manifest manages.",
  }[command];
  console.log(`
treadle ${command} — ${summary}

Usage:
  treadle ${command} [options]

Options:
  -f, --file <path>          Manifest (default: ${DEFAULT_MANIFEST_FILE})
${command === "status" ? "" : "      --env <code>           Organization environment to promote into, such as prod\n"}      --deployment <name>    ${DEPLOYMENTS.join(" | ")} (default: ${DEFAULT_DEPLOYMENT})
  -t, --token <token>        Skip browser login: a WorkOS session token or an llk_ API key (CI);
                             LOOM_API_TOKEN sets it without putting it on the command line
${command === "apply" ? "  -y, --yes                  Apply without asking\n" : ""}  -h, --help                 Show this help
`);
}
