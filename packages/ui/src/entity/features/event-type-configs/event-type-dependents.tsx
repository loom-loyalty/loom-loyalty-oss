/**
 * Event Type Dependents — "Referenced by" section (R4, R5)
 *
 * The detail page's main content, not a badge (R4): every event rule that
 * triggers on this event type, from the existing rules-by-type endpoint.
 * Flows have no equivalent endpoint yet, so that part always shows an
 * explicit "not yet available" state (R5) — never a silently empty list.
 */

import type { EventRule } from "@loom-loyalty/sdk";
import { AlertTriangle, GitBranch, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";

export interface EventTypeDependentsProps {
  /** Dependent event rules from the rules-by-type endpoint (R4). */
  rules: EventRule[];
  /** True when the rules endpoint returned more results than this list contains. */
  rulesCapped?: boolean;
  rulesLoading?: boolean;
  /** True when the rules-by-type query itself failed at runtime. */
  rulesError?: boolean;
  onRetryRules?: () => void;
}

/**
 * "Referenced by" — rules (live) plus flows (always "not yet available", R5).
 */
export function EventTypeDependents({
  rules,
  rulesCapped = false,
  rulesLoading = false,
  rulesError = false,
  onRetryRules,
}: EventTypeDependentsProps): ReactNode {
  return (
    <section className="space-y-4" aria-label="Referenced by">
      <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
        Referenced by
      </h3>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Event Rules
        </p>
        {rulesError ? (
          <div
            className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-md border p-3"
            role="alert"
          >
            <AlertTriangle
              className="text-destructive mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 space-y-2">
              <p className="text-destructive text-sm">
                Couldn&apos;t load rules that reference this event type.
              </p>
              {onRetryRules && (
                <Button variant="outline" size="sm" onClick={onRetryRules}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        ) : rulesLoading ? (
          <p className="text-muted-foreground text-sm">Loading rules…</p>
        ) : rules.length === 0 ? (
          <p className="text-muted-foreground text-sm">No rules reference this event type yet.</p>
        ) : (
          <>
            <ul className="divide-border divide-y rounded-lg border">
              {rules.map((rule) => (
                <li
                  key={rule.eventRuleId}
                  className="flex items-center gap-3 px-3 py-2"
                  data-testid="event-type-dependent-rule"
                >
                  <Zap className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">{rule.name}</p>
                    <p className="text-muted-foreground truncate font-mono text-xs">{rule.code}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {rule.category}
                  </Badge>
                </li>
              ))}
            </ul>
            {rulesCapped ? (
              <p className="text-muted-foreground text-sm">
                There may be more — only the first 100 rules were checked.
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Flows</p>
        {/* R5: no flows-by-event-type endpoint exists yet —
            always the explicit not-available state, distinct from "0 rules" or a
            silent empty list. */}
        <div className="border-border bg-muted/20 flex items-start gap-3 rounded-md border border-dashed p-3">
          <GitBranch className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">
            Not available yet — flow references aren&apos;t surfaced here until a backend endpoint
            for them ships.
          </p>
        </div>
      </div>
    </section>
  );
}
