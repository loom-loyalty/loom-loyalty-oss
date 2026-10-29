import type { CommandPaletteScope } from "./types";

export interface ParsedQuery {
  scope: string | null;
  rest: string;
}

type ScopePrefixMap = ReadonlyMap<string, string>;

/** Creates a case-insensitive prefix lookup from consumer-provided scopes. */
export function createScopePrefixMap(scopes: CommandPaletteScope[]): ScopePrefixMap {
  return new Map(
    scopes.filter((scope) => scope.prefix).map((scope) => [scope.prefix!.toLowerCase(), scope.key])
  );
}

/** Parses a scope prefix without coupling Core to a consumer's entity taxonomy. */
export function parseScope(query: string, scopes: CommandPaletteScope[]): ParsedQuery {
  return parseScopeWithPrefixes(query, createScopePrefixMap(scopes));
}

/** Parses a scope prefix using a precomputed consumer-provided prefix lookup. */
export function parseScopeWithPrefixes(query: string, prefixes: ScopePrefixMap): ParsedQuery {
  const trimmed = query.trimStart();
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex <= 0) return { scope: null, rest: query };

  const scope = prefixes.get(trimmed.slice(0, colonIndex).toLowerCase());
  if (!scope) return { scope: null, rest: query };

  return { scope, rest: trimmed.slice(colonIndex + 1) };
}

/** Paths owned by the Dashboard according to the Platform search contract. */
export const DASHBOARD_PATH_PREFIXES = [
  "/analytics",
  "/audit-log",
  "/billing",
  "/developers",
  "/onboarding",
  "/organization",
  "/settings",
];

export function isDashboardPath(path: string): boolean {
  if (path === "/") return true;
  return DASHBOARD_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
