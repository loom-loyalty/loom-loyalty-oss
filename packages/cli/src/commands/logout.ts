/**
 * `treadle logout`: ends the sign-in saved in the keychain for a deployment's organization
 * environment (`--org`, else `.treadlerc`'s): the dashboard revokes its WorkOS session, and the
 * keychain forgets it.
 */

import { forgetSignIn } from "../auth/saved-sign-in.js";
import { defaultDeployment, getDashboardUrl, resolveOrganization } from "../utils/deployment.js";
import { colors } from "../utils/output.js";
import { EXIT_ERROR, EXIT_OK } from "./manifest.js";
import { parseUseArgs } from "./use.js";

export async function runLogoutCommand(
  args: string[],
  forget: typeof forgetSignIn = forgetSignIn,
  log: (line: string) => void = console.log
): Promise<number> {
  const parsed = parseUseArgs(args);
  if ("help" in parsed) {
    printLogoutHelp();
    return EXIT_OK;
  }
  if ("error" in parsed || parsed.apiUrl) {
    log(
      `${colors.red}${"error" in parsed ? parsed.error : "Unknown option: --api-url"}${colors.reset}`
    );
    printLogoutHelp();
    return EXIT_ERROR;
  }
  try {
    const deployment = parsed.deployment || defaultDeployment();
    const dashboardUrl = parsed.dashboardUrl ?? getDashboardUrl(deployment);
    const organization = resolveOrganization(deployment, parsed.organization)?.organization;
    if (!organization) {
      log(
        `${colors.red}Pass --org, or pin one with treadle use: sign-ins are saved per organization environment.${colors.reset}`
      );
      return EXIT_ERROR;
    }
    const forgotten = await forget(dashboardUrl, organization);
    if (forgotten === undefined) {
      log(`${colors.dim}No keychain here, so nothing was saved.${colors.reset}`);
    } else if (!forgotten.saved) {
      log(`${colors.dim}No saved sign-in to ${organization} on ${dashboardUrl}.${colors.reset}`);
    } else {
      log(`${colors.green}✓ Signed out of ${organization} on ${dashboardUrl}${colors.reset}`);
      if (forgotten.ended !== undefined && forgotten.ended !== true) {
        log(
          `${colors.yellow}The keychain forgot it, but its session couldn't be ended (${forgotten.ended}). It ends when its refresh token expires.${colors.reset}`
        );
      }
    }
    return EXIT_OK;
  } catch (error) {
    log(`${colors.red}${error instanceof Error ? error.message : String(error)}${colors.reset}`);
    return EXIT_ERROR;
  }
}

function printLogoutHelp(): void {
  console.log(`
treadle logout — End the sign-in saved in your keychain

Usage:
  treadle logout [options]

Options:
      --deployment <name>    production | staging | development (default: .treadlerc's, else production)
      --org <id>             The organization environment to sign out of (default: .treadlerc's)
      --dashboard-url <url>  The deployment's dashboard URL
  -h, --help                 Show this help
`);
}
