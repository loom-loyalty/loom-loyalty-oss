/**
 * `.treadlerc`: a person's own treadle settings for a checkout, never committed (the repository
 * ignores it). It names the deployment to use by default and, per deployment, its URLs and the
 * organization environment to sign in to, so a browser login skips the picker:
 *
 *   deployment: staging
 *   staging:
 *     apiUrl: https://api.staging.example.com
 *     dashboardUrl: https://dashboard.staging.example.com
 *     organization: org_01...   # the picked organization or environment, as `treadle use` saves it
 *
 * It holds no credential: a file with a token or an llk_ key in it is refused.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseDocument, stringify } from "yaml";
import { z } from "zod";

export const RC_FILE = ".treadlerc";

const deploymentSettings = z
  .object({
    apiUrl: z.string().url().optional(),
    dashboardUrl: z.string().url().optional(),
    organization: z.string().min(1).optional(),
  })
  .strict();

const rcSchema = z
  .object({
    deployment: z.string().min(1).optional(),
    production: deploymentSettings.optional(),
    staging: deploymentSettings.optional(),
    development: deploymentSettings.optional(),
  })
  .strict();

export type DeploymentSettings = z.infer<typeof deploymentSettings>;
export type TreadleRc = z.infer<typeof rcSchema>;

export interface LoadedRc {
  path: string;
  rc: TreadleRc;
}

/** The nearest `.treadlerc` at or above `startDir`, or undefined when there is none. */
export function findRc(startDir: string = process.cwd()): string | undefined {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, RC_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Whether `value` anywhere looks like a credential, which `.treadlerc` must never hold. */
function holdsCredential(value: unknown, key?: string): boolean {
  if (key && /token|secret|key|password/i.test(key)) return true;
  if (typeof value === "string") return value.trim().startsWith("llk_");
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => holdsCredential(v, k));
  }
  return false;
}

/** `text`, the contents of the `.treadlerc` at `path`, checked; throws with what is wrong. */
export function parseRc(text: string, path: string): TreadleRc {
  const document = parseDocument(text);
  if (document.errors.length > 0) {
    throw new Error(`${path} is not valid YAML: ${document.errors[0]!.message}`);
  }
  const raw: unknown = document.toJS() ?? {};
  if (holdsCredential(raw)) {
    throw new Error(
      `${path} holds a token or key. Remove it: .treadlerc is for settings only; pass a token with --token or LOOM_API_TOKEN.`
    );
  }
  const parsed = rcSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const where = issue.path.join(".") || "(top level)";
    throw new Error(`${path}: ${where}: ${issue.message}`);
  }
  return parsed.data;
}

/** The nearest `.treadlerc`, read and checked; undefined when there is none. Cached per process. */
let cached: { startDir: string; loaded: LoadedRc | undefined } | undefined;

export function loadRc(startDir: string = process.cwd()): LoadedRc | undefined {
  if (cached?.startDir === startDir) return cached.loaded;
  const path = findRc(startDir);
  const loaded = path ? { path, rc: parseRc(readFileSync(path, "utf-8"), path) } : undefined;
  cached = { startDir, loaded };
  return loaded;
}

/** Forgets what {@link loadRc} read, for tests and after {@link saveRcSettings}. */
export function clearRcCache(): void {
  cached = undefined;
}

/** `deployment`'s settings in the nearest `.treadlerc`, with the file they came from. */
export function rcSettings(
  deployment: string,
  startDir?: string
): { path: string; settings: DeploymentSettings } | undefined {
  const loaded = loadRc(startDir);
  const settings = loaded?.rc[deployment as keyof Omit<TreadleRc, "deployment">];
  if (!loaded || !settings || typeof settings !== "object") return undefined;
  return { path: loaded.path, settings };
}

/**
 * Sets `deployment`'s settings in the nearest `.treadlerc` (or a new one in `startDir`), keeping its
 * other keys and comments, and with `makeDefault` makes it the default deployment. Returns the
 * file written.
 */
export function saveRcSettings(
  deployment: string,
  settings: DeploymentSettings,
  startDir: string = process.cwd(),
  makeDefault = false
): string {
  const path = findRc(startDir) ?? join(resolve(startDir), RC_FILE);
  const document = existsSync(path)
    ? parseDocument(readFileSync(path, "utf-8"))
    : parseDocument(stringify({}));
  if (makeDefault) document.set("deployment", deployment);
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) document.setIn([deployment, key], value);
  }
  const text = document.toString();
  parseRc(text, path);
  writeFileSync(path, text, "utf-8");
  clearRcCache();
  return path;
}
