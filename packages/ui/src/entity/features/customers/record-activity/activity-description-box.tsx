/**
 * The plain-language box where a care agent describes what happened.
 *
 * Routing and pre-filling only: the suggestion appears first in the picker and
 * the extracted values seed the form, but nothing is selected or applied on the
 * agent's behalf. When the assistant is unavailable the box says so and the rest
 * of the surface stays fully usable. No part of recording depends on it.
 *
 * ## Styling
 *
 * Matches the platform's other AI surfaces. `AskAiAssistant` (Spindle),
 * `TransformAiBuilder`, and `DescribeModePanel` all share the same shell: a
 * `bg-card` section on the page ground, a Sparkles-marked label, an outline
 * accent submit, and gold callouts for the model's own output. Gold is the AI
 * *signal*, not a background wash.
 *
 * Gold is held to the 3:1 non-text minimum (WCAG 1.4.11) wherever it carries
 * meaning. `--accent` itself is only ~2.15:1 on the card and `border-accent/30`
 * about 1.3:1, so translucent accent appears solely on the callout containers
 * below, as decoration around already-readable text. Anything that delineates or
 * focuses a CONTROL uses `--accent-darker` (~5.0:1) or the primitive's own ring.
 *
 * The Textarea keeps the default teal focus ring for exactly that reason: an
 * accent-tinted focus indicator would be the one thing marking focus, at well
 * under 3:1, on a control whose primitive also sets `outline-none`.
 */

import type { AiLimit } from "@loom-loyalty/core";
import { AlertCircle, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { LiveRegion } from "../../../../a11y/live-region.js";
import { useReducedMotion } from "../../../../a11y/use-reduced-motion.js";
import { AiLimitNotice } from "../../../../ai/ai-limit-notice.js";
import { cn } from "../../../../lib/utils.js";
import { Button } from "../../../../primitives/button.js";
import { Label } from "../../../../primitives/label.js";
import { Textarea } from "../../../../primitives/textarea.js";

export interface ActivityDescriptionBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSuggest: () => void;
  loading?: boolean;
  /** The assistant itself is down, as opposed to rejecting this request. */
  unavailable?: boolean;
  /** Message from the last failed attempt. */
  error?: string | null;
  /** Set when the daily AI allowance refused the last request; replaces `error`. */
  limit?: AiLimit | null;
  /** Assumptions the assistant made, for the agent to check. */
  assumptions?: string[];
  /** True once a suggestion came back with no match. */
  noMatch?: boolean;
  /**
   * Announced politely when a suggestion lands. A suggestion silently reorders
   * the picker below, so without this a screen-reader user gets no signal that
   * anything happened.
   */
  resultAnnouncement?: string | null;
}

export function ActivityDescriptionBox({
  value,
  onChange,
  onSuggest,
  loading = false,
  unavailable = false,
  error,
  limit,
  assumptions,
  noMatch = false,
  resultAnnouncement,
}: ActivityDescriptionBoxProps): ReactNode {
  const prefersReducedMotion = useReducedMotion();
  const motion = prefersReducedMotion
    ? ""
    : "animate-in fade-in-0 slide-in-from-top-1 duration-200";

  // The same card shell in every state, so the surface does not change shape
  // when the assistant goes away.
  if (unavailable) {
    return (
      <section
        aria-label="Activity suggestion assistant"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      >
        <p className="text-muted-foreground flex items-start gap-1.5 text-sm" role="status">
          <Sparkles className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            The assistant that reads a description is unavailable right now. Choose the activity
            from the list below and fill in the details.
          </span>
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Activity suggestion assistant"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="record-activity-description"
          className="text-foreground flex items-center gap-1.5 text-sm font-medium"
        >
          <Sparkles className="text-accent h-4 w-4" aria-hidden="true" />
          Describe what happened
        </Label>
        <Textarea
          id="record-activity-description"
          rows={3}
          value={value}
          placeholder="e.g. Two-night stay at the Riverside starting 1 August that never showed up"
          onChange={(e) => onChange(e.target.value)}
          // readOnly, not disabled: a disabled control cannot hold focus, so
          // disabling the field an agent has just typed into throws their focus
          // to <body> with nothing to restore it when the answer lands.
          // readOnly refuses edits while keeping the element focusable.
          readOnly={loading}
          aria-busy={loading}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Optional. This suggests a match; you still choose and confirm.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            // Not `disabled` while loading: the agent has just clicked this, so
            // focus is ON it, and disabling a focused control drops focus to
            // <body>. `aria-disabled` announces the state while keeping it
            // focusable, so the click is refused here instead.
            onClick={() => {
              if (!loading) onSuggest();
            }}
            disabled={value.trim() === ""}
            aria-disabled={loading || undefined}
            aria-busy={loading}
            className={cn(
              // border-accent-darker (~5.0:1 on the card), not border-accent/40
              // (~1.4:1): this border is the outline button's own boundary, so
              // 1.4.11's 3:1 applies to it.
              // min-h-11 at every breakpoint, with no sm: override. The repo
              // mandates a 44px minimum for interactive controls without a
              // viewport qualifier, and `sm:` is a width proxy, not a
              // pointer-capability one: a landscape phone or small tablet is
              // past that breakpoint and still touch-driven. Every other button
              // on this surface is a bare min-h-11.
              "border-accent-darker text-accent-darker hover:bg-accent/10 hover:text-accent-darker min-h-11 shrink-0",
              loading && "cursor-progress opacity-80"
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {loading ? "Thinking…" : "Suggest a match"}
          </Button>
        </div>
      </div>

      {/* Error: inline, no toast. Nothing on the form is touched. */}
      {limit && !loading && <AiLimitNotice limit={limit} />}
      {error && !limit && !loading && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Abstain: nothing matched well enough to propose. Same callout the other
          AI surfaces use for a clarifying question: the model declining to guess
          is a real answer, not an error. */}
      {noMatch && !error && !loading && (
        <div
          // role="status" as well as the caller's announcement: an abstain is an
          // outcome that appears without the agent doing anything further, and
          // it must reach a screen-reader user even when a caller supplies no
          // `resultAnnouncement`. This component cannot rely on every consumer
          // wiring one.
          role="status"
          className={cn(
            "border-accent/30 bg-accent/5 flex flex-col gap-1 rounded-lg border px-3 py-2",
            motion
          )}
        >
          <p className="text-accent-darker flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> No clear match
          </p>
          <p className="text-foreground text-sm">
            Nothing in the list clearly matches that. Search for it below.
          </p>
        </div>
      )}

      {/* Assumptions: calm gold callout (the AI signal, not a background wash). */}
      {!noMatch && !loading && (assumptions?.length ?? 0) > 0 && (
        <div
          role="note"
          aria-label="Assumptions the assistant made"
          className={cn(
            "border-accent/30 bg-accent/5 flex flex-col gap-1 rounded-lg border px-3 py-2",
            motion
          )}
        >
          <p className="text-accent-darker text-xs font-semibold">Check these assumptions</p>
          <ul className="text-foreground list-inside list-disc space-y-0.5 text-xs">
            {assumptions!.map((assumption, index) => (
              <li key={`${String(index)}-${assumption}`}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      <LiveRegion message={resultAnnouncement ?? ""} politeness="polite" />
    </section>
  );
}
