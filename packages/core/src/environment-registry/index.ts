export type Environment = "local" | "stage" | "prod";

export interface EnvironmentUrls {
  platformApi: string;
  chat: string;
  dashboard: string;
  hub: string;
}

/**
 * `@loom-loyalty/core` is a published, open-source package (packages/core/AGENTS.md:
 * "must expose generic interfaces and types only, never sensitive Loom Loyalty
 * platform internals"). Real stage/prod hostnames are exactly that, so — unlike
 * `local`'s plain localhost defaults, which are generic and not sensitive — stage
 * and prod have NO literal fallback: the calling environment must set these
 * explicitly, or resolution fails loudly instead of silently shipping a real
 * hostname as this package's own default.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. @loom-loyalty/core is a published open-source package and never ` +
        `ships real stage/prod hostnames as literal defaults (see packages/core/AGENTS.md) — ` +
        `set ${name} in the calling environment.`
    );
  }
  return value;
}

/**
 * Resolve target URLs (platform API, chat/AI, dashboard, Hub) for an environment.
 *
 * Re-evaluated on every call rather than cached, so a value read from
 * `process.env` reflects whatever the current invocation set — needed so a
 * per-namespace script invocation resolves to the correct worktree's backend.
 *
 * Only evaluates the requested `env`'s branch — deliberately not an eagerly-built
 * `Record<Environment, EnvironmentUrls>` literal, since that would call
 * `requireEnv` for stage/prod's vars even when a caller only wants `local`.
 */
export function resolveEnvironmentUrls(env: Environment): EnvironmentUrls {
  if (env === "local") {
    return {
      platformApi: process.env.LOOM_API_URL ?? "http://localhost:8080",
      // ai-server's local dev port; see apps/dashboard/.dev.vars.example and apps/hub/.dev.vars.example.
      chat: "http://localhost:8787",
      dashboard: "http://localhost:3000",
      hub: "http://localhost:3001",
    };
  }
  if (env === "stage") {
    return {
      platformApi: requireEnv("STAGE_API_URL"),
      // Mirrors apps/dashboard/wrangler.jsonc's env.staging AI_URL — update both together.
      chat: requireEnv("STAGE_CHAT_URL"),
      dashboard: requireEnv("STAGE_DASHBOARD_URL"),
      hub: requireEnv("STAGE_HUB_URL"),
    };
  }
  return {
    platformApi: requireEnv("PROD_API_URL"),
    // Mirrors apps/dashboard/wrangler.jsonc's top-level (production) AI_URL — update both together.
    chat: requireEnv("PROD_CHAT_URL"),
    dashboard: requireEnv("PROD_DASHBOARD_URL"),
    hub: requireEnv("PROD_HUB_URL"),
  };
}
