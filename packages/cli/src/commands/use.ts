/**
 * `treadle use`: saves which organization environment (and, for a non-production deployment, which
 * URLs) a deployment signs in to, in the nearest `.treadlerc`, so later browser logins skip the
 * picker. Without --org it signs in once through the picker and saves the organization picked.
 */

import { signIn as savedSignIn } from "../auth/saved-sign-in.js";
import { DEPLOYMENTS, defaultDeployment, getDashboardUrl } from "../utils/deployment.js";
import { colors } from "../utils/output.js";
import { type DeploymentSettings, saveRcSettings } from "../utils/rc.js";
import { EXIT_ERROR, EXIT_OK } from "./manifest.js";

export interface UseOptions {
  deployment: string;
  /** Whether --deployment named it, which also makes it .treadlerc's default deployment. */
  explicitDeployment?: boolean;
  organization?: string;
  apiUrl?: string;
  dashboardUrl?: string;
}

export function parseUseArgs(args: string[]): UseOptions | { error: string } | { help: true } {
  const options: UseOptions = { deployment: "" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const value = () => {
      const next = args[i + 1];
      if (next === undefined || next.startsWith("-")) return undefined;
      i++;
      return next;
    };
    switch (arg) {
      case "--deployment": {
        const deployment = value();
        if (!deployment || !(DEPLOYMENTS as readonly string[]).includes(deployment)) {
          return { error: `--deployment must be one of ${DEPLOYMENTS.join(", ")}` };
        }
        options.deployment = deployment;
        options.explicitDeployment = true;
        break;
      }
      case "--org": {
        const organization = value();
        if (!organization) return { error: "--org requires an organization or environment id" };
        options.organization = organization;
        break;
      }
      case "--api-url": {
        const url = value();
        if (!url) return { error: "--api-url requires a URL" };
        options.apiUrl = url;
        break;
      }
      case "--dashboard-url": {
        const url = value();
        if (!url) return { error: "--dashboard-url requires a URL" };
        options.dashboardUrl = url;
        break;
      }
      case "-h":
      case "--help":
        return { help: true };
      default:
        return { error: `Unknown option: ${arg}` };
    }
  }
  if (!options.deployment) {
    try {
      options.deployment = defaultDeployment();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  return options;
}

/** The organization a WorkOS access token is for: its `org_id` claim. */
export function organizationOfToken(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf-8"));
    return typeof payload.org_id === "string" && payload.org_id ? payload.org_id : undefined;
  } catch {
    return undefined;
  }
}

type SignIn = (dashboardUrl: string) => Promise<{ token: string; organizationId?: string }>;

/** Runs `use` with `signIn` for the browser login; returns the exit code. */
export async function executeUse(
  options: UseOptions,
  // Always through the picker; the sign-in it makes is kept for the organization picked.
  signIn: SignIn = (dashboardUrl) => savedSignIn(dashboardUrl, undefined, { keepPicked: true }),
  log: (line: string) => void = console.log
): Promise<number> {
  const settings: DeploymentSettings = {
    apiUrl: options.apiUrl,
    dashboardUrl: options.dashboardUrl,
    organization: options.organization,
  };
  if (!settings.organization) {
    const dashboardUrl = options.dashboardUrl ?? getDashboardUrl(options.deployment);
    log(
      `${colors.cyan}Pick the organization environment to save for ${options.deployment}...${colors.reset}`
    );
    const signedIn = await signIn(dashboardUrl);
    settings.organization = signedIn.organizationId ?? organizationOfToken(signedIn.token);
    if (!settings.organization) {
      log(
        `${colors.red}The sign-in didn't say which organization it is for; pass --org instead.${colors.reset}`
      );
      return EXIT_ERROR;
    }
  }
  const path = saveRcSettings(
    options.deployment,
    settings,
    process.cwd(),
    options.explicitDeployment === true
  );
  log(
    `${colors.green}✓ Saved ${options.deployment}: organization ${settings.organization} in ${path}${colors.reset}`
  );
  log(`${colors.dim}Keep ${path} out of git; it's yours, not the repository's.${colors.reset}`);
  return EXIT_OK;
}

export async function runUseCommand(args: string[]): Promise<number> {
  const parsed = parseUseArgs(args);
  if ("help" in parsed) {
    printUseHelp();
    return EXIT_OK;
  }
  if ("error" in parsed) {
    console.error(`${colors.red}${parsed.error}${colors.reset}`);
    printUseHelp();
    return EXIT_ERROR;
  }
  try {
    return await executeUse(parsed);
  } catch (error) {
    console.error(
      `${colors.red}${error instanceof Error ? error.message : String(error)}${colors.reset}`
    );
    return EXIT_ERROR;
  }
}

function printUseHelp(): void {
  console.log(`
treadle use — Save the organization environment a deployment signs in to, in .treadlerc

Usage:
  treadle use [options]

Without --org, signs in once through the browser picker and saves what you pick. Later plan,
apply, status and pull commands then sign in to it without the picker, and reuse the sign-in
saved in your keychain; --org overrides it.

Options:
      --deployment <name>    ${DEPLOYMENTS.join(" | ")} (default: .treadlerc's, else production);
                             naming one also makes it .treadlerc's default deployment
      --org <id>             Save this organization or environment id instead of picking
      --api-url <url>        Also save the deployment's Platform API URL
      --dashboard-url <url>  Also save the deployment's dashboard URL
  -h, --help                 Show this help

.treadlerc is personal: the repository ignores it, and it never holds a token.
`);
}
