/**
 * `treadle doctor`: checks what `plan` and `apply` depend on and says what to do about each
 * problem. It writes nothing unless `--fix` is given; then it pins the organization (as `treadle
 * use` does) and declares in the manifest the lookup values its records name but nothing has.
 *
 * Checks, in order: 1 sign-in, 2 organization, 3 permissions, 4 versions, 7 approvals,
 * 8 file and dependencies, 9 drift. One sign-in and one dry run feed them all.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ApiError, type ApiClient } from "../api/client.js";
import type { PackageInstallationResult, PackageInstallPlanRecord } from "../api/types.js";
import { classifyToken } from "../auth/token.js";
import { addMetadataValues, missingDependencies } from "../manifest/fix.js";
import { parseManifest } from "../manifest/load.js";
import type { TenantManifest } from "../manifest/schema.js";
import { resolveOrganization, signInClient, type SignedInClient } from "../utils/deployment.js";
import { colors } from "../utils/output.js";
import {
  EXIT_ERROR,
  EXIT_OK,
  managedIds,
  openRequestsFor,
  parseManifestArgs,
  records,
  type Confirm,
  type ManifestOptions,
} from "./manifest.js";
import { executeUse, organizationOfToken } from "./use.js";

export type CheckStatus = "pass" | "warn" | "fail" | "skip" | "fixed";

export interface CheckResult {
  id: number;
  name: string;
  status: CheckStatus;
  /** The finding, first line first; later lines are detail or the next step */
  lines: string[];
}

export interface DoctorOptions extends ManifestOptions {
  fix: boolean;
}

type Log = (line: string) => void;

export interface DoctorDeps {
  signIn: (deployment: string, token?: string, organization?: string) => Promise<SignedInClient>;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, text: string) => Promise<void>;
  confirm: Confirm;
  /** Pins `organization` for `deployment` in .treadlerc, as `treadle use --org`; the exit code */
  pinOrganization: (deployment: string, organization: string) => Promise<number>;
  cliVersion: () => Promise<string | undefined>;
  nodeVersion: string;
  log: Log;
}

/** The minimum Node major version, from package.json's engines. */
const MIN_NODE_MAJOR = 18;

const SYMBOL: Record<CheckStatus, string> = {
  pass: `${colors.green}✓${colors.reset}`,
  fixed: `${colors.green}✓${colors.reset}`,
  warn: `${colors.yellow}!${colors.reset}`,
  fail: `${colors.red}✗${colors.reset}`,
  skip: `${colors.dim}-${colors.reset}`,
};

// ============================================================
// Arguments
// ============================================================

export function parseDoctorArgs(
  args: string[]
): DoctorOptions | { error: string } | { help: true } {
  const fix = args.includes("--fix");
  const parsed = parseManifestArgs(args.filter((arg) => arg !== "--fix"));
  if ("error" in parsed || "help" in parsed) return parsed;
  return { ...parsed, fix };
}

// ============================================================
// Checks
// ============================================================

export function checkVersions(cliVersion: string | undefined, nodeVersion: string): CheckResult {
  const major = Number(nodeVersion.replace(/^v/, "").split(".")[0]);
  const cli = cliVersion ? `treadle ${cliVersion}` : "treadle (version unknown)";
  if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
    return {
      id: 4,
      name: "Versions",
      status: "fail",
      lines: [`${cli} on Node ${nodeVersion}`, `treadle needs Node ${MIN_NODE_MAJOR} or newer.`],
    };
  }
  return { id: 4, name: "Versions", status: "pass", lines: [`${cli} on Node ${nodeVersion}`] };
}

/** Check 1 for a failed sign-in, with what to do next. */
export function signInFailure(error: unknown): CheckResult {
  const message = error instanceof Error ? error.message : String(error);
  const lines = [message.split("\n")[0]!];
  if (/429|too many/i.test(message)) {
    lines.push(
      "The dashboard allows 10 CLI sign-ins per IP every 15 minutes. Wait, or set LOOM_API_TOKEN to an API key so treadle skips the browser."
    );
  } else {
    lines.push(...message.split("\n").slice(1));
    lines.push("Set LOOM_API_TOKEN to an API key to sign in without the browser.");
  }
  return { id: 1, name: "Sign-in", status: "fail", lines };
}

export function checkSignIn(signedIn: SignedInClient): CheckResult {
  if (signedIn.via === "token") {
    const kind = classifyToken(signedIn.token);
    if (kind.kind === "m2m") {
      return {
        id: 1,
        name: "Sign-in",
        status: "pass",
        lines: ["API key (--token or LOOM_API_TOKEN)"],
      };
    }
    if (kind.kind === "jwt" && kind.expired) {
      return {
        id: 1,
        name: "Sign-in",
        status: "fail",
        lines: [
          "The session token in --token or LOOM_API_TOKEN has expired.",
          "Get a new one, or unset it to sign in through the browser.",
        ],
      };
    }
    if (kind.kind === "unknown") {
      return {
        id: 1,
        name: "Sign-in",
        status: "fail",
        lines: [
          "The value in --token or LOOM_API_TOKEN is neither an API key nor a session token.",
          "Check it, or unset it to sign in through the browser.",
        ],
      };
    }
    return {
      id: 1,
      name: "Sign-in",
      status: "pass",
      lines: ["Session token (--token or LOOM_API_TOKEN)"],
    };
  }
  const how = {
    saved: "your saved sign-in",
    new: "a new sign-in, now saved in your keychain",
    browser: "a one-time browser sign-in (nothing saved)",
  }[signedIn.via];
  const lines = [`Signed in with ${how}`];
  if (signedIn.via === "browser") {
    lines.push(
      "Pin an organization (treadle use, or doctor --fix) so later commands reuse a saved sign-in."
    );
  }
  return { id: 1, name: "Sign-in", status: "pass", lines };
}

export function checkOrganization(
  deployment: string,
  pinned: { organization: string; source: string } | undefined,
  signedIn: SignedInClient | undefined,
  tokenOrganization: string | undefined
): CheckResult {
  const name = "Organization";
  if (signedIn?.via === "token") {
    const of = tokenOrganization
      ? `organization ${tokenOrganization}`
      : "the API key's organization";
    if (pinned && tokenOrganization && tokenOrganization !== pinned.organization) {
      return {
        id: 2,
        name,
        status: "warn",
        lines: [
          `The token is for ${tokenOrganization}, but ${pinned.source} pins ${pinned.organization}; the token wins.`,
        ],
      };
    }
    return { id: 2, name, status: "pass", lines: [`${of} (from the token)`] };
  }
  if (!pinned) {
    return {
      id: 2,
      name,
      status: "warn",
      lines: [
        `No organization is pinned for ${deployment}, so every command asks in the browser.`,
        "Run treadle use, or doctor --fix, to pin one.",
      ],
    };
  }
  const signedInTo = signedIn?.organizationId;
  if (
    signedInTo &&
    signedInTo !== pinned.organization &&
    signedInTo.startsWith("org_") &&
    pinned.organization.startsWith("org_")
  ) {
    return {
      id: 2,
      name,
      status: "warn",
      lines: [`Signed in to ${signedInTo}, but ${pinned.source} pins ${pinned.organization}.`],
    };
  }
  return {
    id: 2,
    name,
    status: "pass",
    lines: [`${pinned.organization} (pinned in ${pinned.source})`],
  };
}

/** Check 3 from the dry run: records the caller may not change. */
export function checkPermissions(
  result: PackageInstallationResult,
  envRefused?: string
): CheckResult {
  const blocked = records(result).filter((record) => record.action === "BLOCKED");
  const lines: string[] = [];
  if (envRefused) lines.push(envRefused);
  for (const record of blocked)
    lines.push(`${record.kind} ${record.code}: ${record.reason ?? "blocked"}`);
  if (lines.length === 0) {
    return {
      id: 3,
      name: "Permissions",
      status: "pass",
      lines: ["The sign-in can write every record in the file"],
    };
  }
  return {
    id: 3,
    name: "Permissions",
    status: "fail",
    lines: [`${lines.length} problem(s):`, ...lines],
  };
}

/** Check 8 from the dry run: conflicts, with missing dependencies grouped by what is missing. */
export function checkDependencies(result: PackageInstallationResult): CheckResult {
  const missing = missingDependencies(result);
  const conflicts = records(result).filter(
    (record) => record.action === "CONFLICT" && (record.missing ?? []).length === 0
  );
  if (missing.values.length === 0 && missing.records.length === 0 && conflicts.length === 0) {
    return {
      id: 8,
      name: "File and dependencies",
      status: "pass",
      lines: ["Every record's dependencies are in the file or the organization"],
    };
  }
  const lines: string[] = [];
  if (missing.values.length > 0) {
    lines.push("Lookup values to declare under metadata: (doctor --fix adds them):");
    for (const value of missing.values) {
      lines.push(`  ${value.type} ${value.code} ← ${value.neededBy.join(", ")}`);
    }
  }
  if (missing.records.length > 0) {
    lines.push("Records to add to the file:");
    for (const record of missing.records) {
      lines.push(`  ${record.kind} ${record.code} ← ${record.neededBy.join(", ")}`);
    }
  }
  for (const record of conflicts) {
    lines.push(`${record.kind} ${record.code}: ${record.reason ?? "conflict"}`);
  }
  return { id: 8, name: "File and dependencies", status: "fail", lines };
}

/** Check 9 from the dry run: records that differ from the organization. */
export function checkDrift(result: PackageInstallationResult): CheckResult {
  const differs = records(result).filter(
    (record) =>
      record.action === "CREATE" || record.action === "UPDATE" || record.action === "ADOPT"
  );
  if (differs.length === 0) {
    return { id: 9, name: "Drift", status: "pass", lines: ["The organization matches the file"] };
  }
  return {
    id: 9,
    name: "Drift",
    status: "warn",
    lines: [
      `${differs.length} record(s) differ from the organization: new or changed in the file, or changed outside it.`,
      ...differs.map(
        (record: PackageInstallPlanRecord) =>
          `  ${record.action} ${record.kind} ${record.code}${record.reason ? `: ${record.reason}` : ""}`
      ),
      "If the organization is right, treadle pull brings its changes into the file.",
    ],
  };
}

/** Check 7: approval requests still waiting for the file's records, and how records reach `env`. */
export async function checkApprovals(
  client: ApiClient,
  manifest: TenantManifest,
  env: string | undefined
): Promise<CheckResult> {
  const name = "Approvals";
  const lines: string[] = [];
  let status: CheckStatus = "pass";
  const installation = await client.findInstallation(manifest.code);
  if (!installation) {
    lines.push(`${manifest.code} has not been applied to this organization yet`);
  } else {
    const open = openRequestsFor(
      await client.listWorkflowRequests(),
      managedIds(installation.resources)
    );
    if (open.length === 0) {
      lines.push("No approval requests are waiting for the file's records");
    } else {
      status = "warn";
      lines.push(`${open.length} approval request(s) still wait (treadle status lists them):`);
      for (const request of open)
        lines.push(`  ${request.status} ${request.environmentWorkflowRequestId}`);
    }
  }
  if (env) {
    try {
      const policies = (await client.listActiveEnablePolicies()).filter(
        (policy) => policy.targetEnvironmentCode === env
      );
      if (policies.length === 0) {
        status = "warn";
        lines.push(
          `No active enable policy targets ${env}, so apply --env ${env} has no workflow to open requests in.`
        );
      } else if (policies.every((policy) => policy.autoEnable)) {
        lines.push(
          `New records reach ${env} automatically (${policies.map((policy) => policy.code).join(", ")}); changes to existing records go through the enable request apply --env opens, which approves itself`
        );
      } else {
        lines.push(
          `Records reach ${env} once someone approves them (${policies.map((policy) => policy.code).join(", ")})`
        );
      }
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 403 && error.status !== 401))
        throw error;
      status = "warn";
      lines.push(`The sign-in can't read enable policies, so how records reach ${env} is unknown.`);
    }
  }
  return { id: 7, name, status, lines };
}

// ============================================================
// Doctor
// ============================================================

export function renderCheck(check: CheckResult): string {
  const [first, ...rest] = check.lines;
  const head = `${SYMBOL[check.status]} ${check.id} ${check.name.padEnd(22)} ${first ?? ""}`;
  return [head, ...rest.map((line) => `      ${colors.dim}${line}${colors.reset}`)].join("\n");
}

const skipped = (id: number, name: string, why: string): CheckResult => ({
  id,
  name,
  status: "skip",
  lines: [why],
});

export async function executeDoctor(options: DoctorOptions, deps: DoctorDeps): Promise<number> {
  const checks = new Map<number, CheckResult>();
  checks.set(4, checkVersions(await deps.cliVersion(), deps.nodeVersion));

  // 8, first half: the file itself.
  let manifest: TenantManifest | undefined;
  let text: string | undefined;
  try {
    text = await deps.readText(options.file);
    const loaded = parseManifest(text);
    if (loaded.ok) manifest = loaded.manifest;
    else
      checks.set(8, {
        id: 8,
        name: "File and dependencies",
        status: "fail",
        lines: [
          `${options.file} is not a valid loom-loyalty-config.v1 manifest:`,
          ...loaded.problems,
        ],
      });
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "not found" : String(error);
    checks.set(8, {
      id: 8,
      name: "File and dependencies",
      status: "fail",
      lines: [`${options.file}: ${reason}`],
    });
  }

  // 1 and 2: one sign-in.
  const pinned = resolveOrganization(options.deployment, options.organization);
  let signedIn: SignedInClient | undefined;
  try {
    signedIn = await deps.signIn(options.deployment, options.token, options.organization);
    checks.set(1, checkSignIn(signedIn));
  } catch (error) {
    checks.set(1, signInFailure(error));
  }
  const tokenOrganization =
    signedIn?.via === "token" && classifyToken(signedIn.token).kind === "jwt"
      ? organizationOfToken(signedIn.token)
      : undefined;
  checks.set(2, checkOrganization(options.deployment, pinned, signedIn, tokenOrganization));
  // The organization this sign-in picked, so the checks and the pin agree.
  const picked = signedIn
    ? (signedIn.organizationId ?? organizationOfToken(signedIn.token))
    : undefined;
  if (
    options.fix &&
    checks.get(2)!.status === "warn" &&
    !pinned &&
    picked &&
    signedIn?.via !== "token"
  ) {
    if ((await deps.pinOrganization(options.deployment, picked)) === EXIT_OK) {
      checks.set(2, {
        ...checks.get(2)!,
        status: "fixed",
        lines: ["Pinned the organization you picked in .treadlerc"],
      });
    }
  }

  // 3, 7, 8, 9: one dry run.
  const client = checks.get(1)!.status === "pass" ? signedIn?.client : undefined;
  if (!client || !manifest) {
    const why = !client ? "needs a sign-in" : "needs a valid file";
    for (const [id, name] of [
      [3, "Permissions"],
      [7, "Approvals"],
      [8, "File and dependencies"],
      [9, "Drift"],
    ] as const) {
      if (!checks.has(id)) checks.set(id, skipped(id, name, why));
    }
    return finish(checks, deps.log);
  }

  let result: PackageInstallationResult | undefined;
  let envRefused: string | undefined;
  try {
    result = await plan(client, manifest, options.env);
  } catch (error) {
    if (options.env && error instanceof ApiError && error.status === 403) {
      envRefused = `The sign-in can't open approval requests into ${options.env}: ${error.describe()}`;
      try {
        result = await plan(client, manifest, undefined);
      } catch (retryError) {
        checks.set(8, planFailure(retryError));
      }
    } else {
      checks.set(8, planFailure(error));
    }
  }
  if (result) {
    checks.set(3, checkPermissions(result, envRefused));
    checks.set(8, checkDependencies(result));
    checks.set(9, checkDrift(result));
    if (options.fix && text !== undefined) {
      const fixed = await fixMissingValues(options, deps, text, result);
      if (fixed) checks.set(8, fixed);
    }
  } else {
    checks.set(3, skipped(3, "Permissions", "needs a plan"));
    checks.set(9, skipped(9, "Drift", "needs a plan"));
  }
  try {
    checks.set(7, await checkApprovals(client, manifest, options.env));
  } catch (error) {
    checks.set(7, {
      id: 7,
      name: "Approvals",
      status: "warn",
      lines: [`Couldn't read approval requests: ${describe(error)}`],
    });
  }
  return finish(checks, deps.log);
}

async function plan(
  client: ApiClient,
  manifest: TenantManifest,
  env: string | undefined
): Promise<PackageInstallationResult> {
  return client.installManifest({
    code: manifest.code,
    manifest,
    dryRun: true,
    targetEnvironmentCode: env,
  });
}

function planFailure(error: unknown): CheckResult {
  return {
    id: 8,
    name: "File and dependencies",
    status: "fail",
    lines: [`The Platform couldn't plan the file: ${describe(error)}`],
  };
}

function describe(error: unknown): string {
  return error instanceof ApiError
    ? error.describe()
    : error instanceof Error
      ? error.message
      : String(error);
}

/** Declares the plan's missing lookup values in the file, after asking; the new check 8, or undefined if nothing changed. */
async function fixMissingValues(
  options: DoctorOptions,
  deps: DoctorDeps,
  text: string,
  result: PackageInstallationResult
): Promise<CheckResult | undefined> {
  const { values } = missingDependencies(result);
  if (values.length === 0) return undefined;
  deps.log(`\nAdd to ${options.file} under metadata:`);
  for (const value of values)
    deps.log(`  ${colors.green}+ ${value.type} ${value.code} "${value.name}"${colors.reset}`);
  if (
    !options.yes &&
    !(await deps.confirm(`Write ${values.length} value(s) to ${options.file}?`))
  ) {
    deps.log("Not written.");
    return undefined;
  }
  await deps.writeText(options.file, addMetadataValues(text, values));
  const rest = checkDependencies(result).lines.filter(
    (line) =>
      !line.startsWith("Lookup values") &&
      !values.some((value) => line.startsWith(`  ${value.type} ${value.code} `))
  );
  return {
    id: 8,
    name: "File and dependencies",
    status: rest.length === 0 ? "fixed" : "fail",
    lines: [
      `Declared ${values.length} lookup value(s) in ${options.file}; run treadle plan to check`,
      ...rest,
    ],
  };
}

function finish(checks: Map<number, CheckResult>, log: Log): number {
  const ordered = [...checks.values()].sort((a, b) => a.id - b.id);
  for (const check of ordered) log(renderCheck(check));
  const failed = ordered.filter((check) => check.status === "fail").length;
  const warned = ordered.filter((check) => check.status === "warn").length;
  log("");
  if (failed > 0) {
    log(
      `${colors.red}${failed} check(s) failed${warned ? `, ${warned} to look at` : ""}.${colors.reset}`
    );
    return EXIT_ERROR;
  }
  log(
    warned
      ? `${colors.yellow}No failures; ${warned} to look at.${colors.reset}`
      : `${colors.green}All checks passed.${colors.reset}`
  );
  return EXIT_OK;
}

// ============================================================
// Entry point
// ============================================================

async function confirmOnTerminal(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      `${colors.red}No terminal to confirm on; pass --yes to write without asking.${colors.reset}`
    );
    return false;
  }
  const { createInterface } = await import("node:readline/promises");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`\n${question} Only "yes" writes: `);
    return answer.trim() === "yes";
  } finally {
    readline.close();
  }
}

async function packageVersion(): Promise<string | undefined> {
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
    return JSON.parse(await readFile(path, "utf-8")).version;
  } catch {
    return undefined;
  }
}

export async function runDoctorCommand(args: string[]): Promise<number> {
  const parsed = parseDoctorArgs(args);
  if ("help" in parsed) {
    printDoctorHelp();
    return EXIT_OK;
  }
  if ("error" in parsed) {
    console.error(`${colors.red}${parsed.error}${colors.reset}`);
    printDoctorHelp();
    return EXIT_ERROR;
  }
  return executeDoctor(parsed, {
    signIn: signInClient,
    readText: (path) => readFile(path, "utf-8"),
    writeText: (path, text) => writeFile(path, text, "utf-8"),
    confirm: confirmOnTerminal,
    pinOrganization: (deployment, organization) => executeUse({ deployment, organization }),
    cliVersion: packageVersion,
    nodeVersion: process.version,
    log: console.log,
  });
}

export function printDoctorHelp(): void {
  console.log(`
treadle doctor — Check what plan and apply depend on, and say what to fix

Usage:
  treadle doctor [options]

Checks: 1 sign-in, 2 organization, 3 permissions, 4 versions, 7 approvals,
8 file and dependencies (lookup values the file's records name but nothing has), 9 drift.
Exits 1 when a check fails, else 0. It signs in once and plans once; nothing is written
unless you pass --fix.

Options:
      --fix                  Pin the organization when none is, and declare the missing
                             lookup values under metadata: (asks first)
  -f, --file <path>          Manifest (default: loom-loyalty-config.yaml)
      --env <code>           Also check promoting into this organization environment
      --deployment <name>    production | staging | development
      --org <id>             Organization or environment id to sign in to
  -t, --token <token>        A session token or llk_ API key (else LOOM_API_TOKEN)
  -y, --yes                  With --fix, write without asking
  -h, --help                 Show this help
`);
}
