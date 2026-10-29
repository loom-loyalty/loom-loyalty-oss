/**
 * Which Loom deployment a command talks to, and how it authenticates there.
 */

import { ApiClient } from "../api/client.js";
import { authenticateViaBrowser } from "../auth/browser-auth.js";
import { colors } from "./output.js";

export const DEPLOYMENTS = ["production", "staging", "development"] as const;

export const DEFAULT_DEPLOYMENT = "production";

const API_URLS: Record<string, string> = {
  production: "https://api.loomloyalty.com",
};

/**
 * The Platform API URL of `deployment`; `LOOM_API_URL` overrides it. Only production's URL is built
 * in, so a non-production deployment needs `LOOM_API_URL`.
 */
export function getApiUrl(deployment: string): string {
  const override = process.env.LOOM_API_URL;
  if (override) return override;

  const url = API_URLS[deployment];
  if (!url) {
    throw new Error(`Set LOOM_API_URL to the Platform API URL of the "${deployment}" deployment.`);
  }
  return url;
}

const DASHBOARD_URLS: Record<string, string> = {
  production: "https://dashboard.loomloyalty.com",
};

/**
 * The dashboard that signs a browser login in to `deployment`; `LOOM_DASHBOARD_URL` overrides it.
 * Only production's dashboard is built in, so a non-production deployment needs `LOOM_DASHBOARD_URL`.
 */
export function getDashboardUrl(deployment: string = DEFAULT_DEPLOYMENT): string {
  const override = process.env.LOOM_DASHBOARD_URL;
  if (override) return override;

  const url = DASHBOARD_URLS[deployment];
  if (!url) {
    throw new Error(
      `Set LOOM_DASHBOARD_URL to the dashboard URL of the "${deployment}" deployment.`
    );
  }
  return url;
}

/** The token to use: `token` (from `--token`), else `LOOM_API_TOKEN`; undefined when both are blank. */
export function resolveToken(token?: string): string | undefined {
  return token?.trim() || process.env.LOOM_API_TOKEN?.trim() || undefined;
}

/**
 * An API client for `deployment`, authenticated with `token` or `LOOM_API_TOKEN` (a WorkOS session
 * token or an `llk_` M2M API key, for CI) or, without either, through a browser login.
 */
export async function createApiClient(deployment: string, token?: string): Promise<ApiClient> {
  const resolved = resolveToken(token);
  if (resolved) {
    return new ApiClient({ baseUrl: getApiUrl(deployment), token: resolved });
  }
  console.log(`${colors.cyan}Authenticating with Loom Loyalty...${colors.reset}`);
  const authResult = await authenticateViaBrowser({ dashboardUrl: getDashboardUrl(deployment) });
  console.log(`${colors.green}✓ Authenticated successfully${colors.reset}\n`);
  return new ApiClient({ baseUrl: getApiUrl(deployment), token: authResult.token });
}
