"use client";

import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface ScopeListProps {
  /** Permission scopes in "resource:action" format */
  scopes: string[];
  /** Whether to group scopes by domain (defaults to true) */
  grouped?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Parses a scope string into resource and action parts.
 * Expects format "resource:action" — handles edge cases gracefully.
 */
function parseScope(scope: string): { domain: string; detail: string } {
  const colonIndex = scope.indexOf(":");
  if (colonIndex === -1) {
    return { domain: "other", detail: scope };
  }
  return {
    domain: scope.substring(0, colonIndex),
    detail: scope.substring(colonIndex + 1),
  };
}

/**
 * Groups scopes by their domain prefix.
 */
function groupByDomain(scopes: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const scope of scopes) {
    const { domain, detail } = parseScope(scope);
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(detail);
  }

  return groups;
}

/**
 * Formats a domain key for display (e.g., "event-engine" -> "Event Engine").
 */
function formatDomain(domain: string): string {
  return domain
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Grouped display of permission scopes organized by resource.
 * Parses scope strings in "resource:action" format and groups them
 * under resource headers for readable display.
 *
 * Includes proper semantic HTML and ARIA attributes (WCAG 2.1 AA).
 *
 * @example
 * ```tsx
 * <ScopeList
 *   scopes={[
 *     "program:read",
 *     "partner:read",
 *     "customer:read",
 *   ]}
 * />
 * ```
 */
export function ScopeList({ scopes, grouped = true, className }: ScopeListProps): ReactNode {
  if (scopes.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>No permissions assigned.</p>
    );
  }

  if (!grouped) {
    return (
      <ul className={cn("space-y-1", className)} aria-label="Permission scopes">
        {scopes.map((scope) => (
          <li key={scope}>
            <code className="bg-muted text-foreground rounded px-1.5 py-0.5 text-xs">{scope}</code>
          </li>
        ))}
      </ul>
    );
  }

  const groups = groupByDomain(scopes);
  const sortedDomains = Object.keys(groups).sort();

  return (
    <section className={cn("space-y-4", className)} aria-label="Permission scopes by domain">
      {sortedDomains.map((domain) => (
        <div key={domain}>
          <h3 className="text-foreground mb-2 text-sm font-medium">{formatDomain(domain)}</h3>
          <ul className="space-y-1" aria-label={`${formatDomain(domain)} permissions`}>
            {(groups[domain] ?? []).map((detail) => (
              <li key={`${domain}:${detail}`}>
                <code className="bg-muted text-foreground rounded px-1.5 py-0.5 text-xs">
                  {detail}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
