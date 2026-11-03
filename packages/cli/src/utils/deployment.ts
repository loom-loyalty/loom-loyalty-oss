/**
 * Which Loom deployment a command talks to, and how it authenticates there.
 */

import { ApiClient } from "../api/client.js";
import { signIn } from "../auth/saved-sign-in.js";
import { colors } from "./output.js";
import { loadRc, rcSettings } from "./rc.js";

export const DEPLOYMENTS = ["production", "staging", "development"] as const;

export const DEFAULT_DEPLOYMENT = "production";

/** The deployment a command uses without `--deployment`: `.treadlerc`'s, else production. */
export function defaultDeployment(): string {
  const configured = loadRc()?.rc.deployment;
  if (configured && !(DEPLOYMENTS as readonly string[]).includes(configured)) {
    throw new Error(
      `${loadRc()!.path}: deployment must be one of ${DEPLOYMENTS.join(", ")}, not "${configured}"`
    );
  }
  return configured ?? DEFAULT_DEPLOYMENT;
}

const API_URLS: Record<string, string> = {
  production: "https://api.loomloyalty.com",
};

/**
 * The Platform API URL of `deployment`: `LOOM_API_URL`, else `.treadlerc`'s `apiUrl`, else the
 * built-in one. Only production's URL is built in.
 */
export function getApiUrl(deployment: string): string {
  const override = process.env.LOOM_API_URL;
  if (override) return override;

  const url = rcSettings(deployment)?.settings.apiUrl ?? API_URLS[deployment];
  if (!url) {
    throw new Error(
      `Set LOOM_API_URL, or apiUrl under ${deployment}: in .treadlerc, to the Platform API URL of the "${deployment}" deployment.`
    );
  }
  return url;
}

const DASHBOARD_URLS: Record<string, string> = {
  production: "https://dashboard.loomloyalty.com",
};

/**
 * The dashboard that signs a browser login in to `deployment`: `LOOM_DASHBOARD_URL`, else
 * `.treadlerc`'s `dashboardUrl`, else the built-in one. Only production's dashboard is built in.
 */
export function getDashboardUrl(deployment: string = DEFAULT_DEPLOYMENT): string {
  const override = process.env.LOOM_DASHBOARD_URL;
  if (override) return override;

  const url = rcSettings(deployment)?.settings.dashboardUrl ?? DASHBOARD_URLS[deployment];
  if (!url) {
    throw new Error(
      `Set LOOM_DASHBOARD_URL, or dashboardUrl under ${deployment}: in .treadlerc, to the dashboard URL of the "${deployment}" deployment.`
    );
  }
  return url;
}

/** The token to use: `token` (from `--token`), else `LOOM_API_TOKEN`; undefined when both are blank. */
export function resolveToken(token?: string): string | undefined {
  return token?.trim() || process.env.LOOM_API_TOKEN?.trim() || undefined;
}

/**
 * The organization environment a browser login signs in to without the picker: `organization`
 * (from `--org`), else `.treadlerc`'s for `deployment`; undefined to pick in the browser.
 */
export function resolveOrganization(
  deployment: string,
  organization?: string
): { organization: string; source: string } | undefined {
  const flag = organization?.trim();
  if (flag) return { organization: flag, source: "--org" };
  const fromRc = rcSettings(deployment);
  const pinned = fromRc?.settings.organization?.trim();
  return pinned ? { organization: pinned, source: fromRc!.path } : undefined;
}

/** How a client signed in, for `treadle doctor`. */
export interface SignedInClient {
  client: ApiClient;
  /** token: --token or LOOM_API_TOKEN; saved: the keychain's sign-in; new or browser: a browser login */
  via: "token" | "saved" | "new" | "browser";
  /** The organization environment the sign-in is for, when the dashboard said */
  organizationId?: string;
  /** The bearer token, so a caller can tell an API key from a session token */
  token: string;
  /** Where the organization signed in to came from (--org or .treadlerc), when pinned */
  pinnedFrom?: string;
}

/**
 * An API client for `deployment`, authenticated with `token` or `LOOM_API_TOKEN` (a WorkOS session
 * token or an `llk_` M2M API key, for CI) or, without either, through the sign-in saved in the
 * keychain or a browser login into `organization` (`--org`) or `.treadlerc`'s organization, else
 * the one picked in the browser. Neither a token nor a key is ever saved.
 */
export async function createApiClient(
  deployment: string,
  token?: string,
  organization?: string
): Promise<ApiClient> {
  return (await signInClient(deployment, token, organization)).client;
}

/** {@link createApiClient}, also saying how it signed in. */
export async function signInClient(
  deployment: string,
  token?: string,
  organization?: string
): Promise<SignedInClient> {
  const resolved = resolveToken(token);
  if (resolved) {
    return {
      client: new ApiClient({ baseUrl: getApiUrl(deployment), token: resolved }),
      via: "token",
      token: resolved,
    };
  }
  const pinned = resolveOrganization(deployment, organization);
  console.log(`${colors.cyan}Authenticating with Loom Loyalty...${colors.reset}`);
  if (pinned) {
    console.log(
      `${colors.dim}Signing in to ${pinned.organization} (from ${pinned.source})${colors.reset}`
    );
  }
  let authResult;
  try {
    authResult = await signIn(getDashboardUrl(deployment), pinned?.organization, {
      log: (line) => console.log(`${colors.dim}${line}${colors.reset}`),
    });
  } catch (error) {
    if (pinned) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message}\nThe organization came from ${pinned.source}: fix it there, or pass --org to sign in to another one.`
      );
    }
    throw error;
  }
  console.log(
    authResult.via === "saved"
      ? `${colors.green}✓ Signed in to ${authResult.organizationId} with your saved sign-in${colors.reset}\n`
      : `${colors.green}✓ Authenticated successfully${colors.reset}\n`
  );
  return {
    client: new ApiClient({ baseUrl: getApiUrl(deployment), token: authResult.token }),
    via: authResult.via,
    organizationId: authResult.organizationId ?? pinned?.organization,
    token: authResult.token,
    pinnedFrom: pinned?.source,
  };
}
