"use client";

import type { AiLimit } from "@loom-loyalty/core";
import { AlertCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { LiveRegion } from "../a11y/live-region";
import { useReducedMotion } from "../a11y/use-reduced-motion";
import { AiLimitNotice } from "../ai/ai-limit-notice";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";

export interface AskAiAssistantProps {
  /** Fired when the user submits a natural-language ask. */
  onGenerate: (prompt: string) => void;
  /** Fired when the user asks to explain the current editor SQL (SQL → English). */
  onExplain?: () => void;
  /** True while a translate request is in flight ("Thinking…" on the button). */
  isLoading?: boolean;
  /** Inline error from the last request (rendered below the bar; no toast). */
  error?: string | null;
  /** Set when the daily AI allowance refused the last request; replaces `error`. */
  limit?: AiLimit | null;
  /** Assumptions the model surfaced for the last generation. */
  assumptions?: string[];
  /** Plain-English explanation of the generated/explained SQL. */
  explanation?: string | null;
  /** Clarifying question shown when the model abstains (no SQL was generated). */
  clarifyingQuestion?: string | null;
  /** aria-live message announced when a result lands (e.g. "Query generated — review and run"). */
  generatedAnnouncement?: string | null;
  /** Whether there is editor SQL available to explain (gates the Explain button). */
  canExplain?: boolean;
  /**
   * The NL prompt from the immediately preceding turn, when the next ask will
   * be treated as a refinement of it. Quoting the user's own question — rather
   * than labeling the state ("turn 2") — is what signals continuation; showing
   * only the single prior step keeps this to one line regardless of how deep
   * the conversation goes.
   */
  previousQuestion?: string | null;
  /** Starts a fresh conversational question without changing the editor. */
  onNewConversation?: () => void;
  /**
   * Seeds the input with a question the user has not yet sent — used when a
   * chart drill-down has no SQL to offer and hands over the question instead.
   * Deliberately not auto-submitted: the ask costs a model call, and the user
   * should see and be able to edit the question first.
   */
  prefillPrompt?: string | null;
  /** Called once a `prefillPrompt` has been placed in the input. */
  onPrefillConsumed?: () => void;
}

/**
 * Spindle's Ask-AI bar: a natural-language input that proposes SQL into the
 * editor for human review. The bar itself sits on the standard card surface;
 * GOLD is reserved as the AI *signal* — the Sparkles icon, the Ask button, and
 * the output callouts (assumptions / clarifying question) — not a background
 * wash. The bar is visually subordinate to the SQL editor; reading order is
 * Ask → SQL → Results.
 *
 * Presentational only: it never calls the network or touches the editor. The
 * page wires `onGenerate`/`onExplain` to the transport hook and pushes the
 * generated SQL into the editor. Schema-grounded example prompts live in the
 * editor's "Examples" dropdown, not here.
 */
export function AskAiAssistant({
  onGenerate,
  onExplain,
  isLoading = false,
  error,
  limit,
  assumptions,
  explanation,
  clarifyingQuestion,
  generatedAnnouncement,
  canExplain = false,
  previousQuestion,
  onNewConversation,
  prefillPrompt,
  onPrefillConsumed,
}: AskAiAssistantProps): ReactNode {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Mirrors SqlEditor's externalValue contract: the parent pushes a value in,
  // this consumes it once and hands control back to the user's own typing.
  // The input must stay editable afterwards, so the value cannot be derived —
  // it is genuinely external state being synced in, and focus moves with it.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot sync of an
     externally supplied prompt into editable local state, consumed immediately */
  useEffect(() => {
    if (prefillPrompt == null) return;
    setInput(prefillPrompt);
    inputRef.current?.focus();
    onPrefillConsumed?.();
  }, [prefillPrompt, onPrefillConsumed]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Entrance animation honored only when the user hasn't asked for reduced motion.
  const motion = prefersReducedMotion
    ? ""
    : "animate-in fade-in-0 slide-in-from-top-1 duration-200";

  return (
    <section
      aria-label="Ask AI assistant"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = input.trim();
          if (!trimmed || isLoading) return;
          onGenerate(trimmed);
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="ask-ai-input"
            className="text-foreground flex items-center gap-1.5 text-sm font-medium"
          >
            <Sparkles className="text-accent h-4 w-4" aria-hidden="true" />
            Ask your data a question
          </label>
          {previousQuestion && onNewConversation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onNewConversation();
                // The click target unmounts once the conversation resets (this
                // button only renders while previousQuestion is set) — refocus
                // the input so keyboard/screen-reader users don't lose their
                // place to <body>.
                inputRef.current?.focus();
              }}
              disabled={isLoading}
              className="text-accent-darker hover:bg-accent/10 hover:text-accent-darker min-h-11 text-xs sm:min-h-9"
            >
              Start new question
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div
            className={cn(
              "focus-within:ring-[3px]",
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border shadow-xs",
              // Full-opacity border-accent-dark (~3.2:1 on the card) is used
              // rather than the diluted border-accent/30 (~1.3:1) — a border
              // this faint fails the WCAG 1.4.11/2.4.11 3:1 non-text-contrast
              // minimum. The ring stays a soft supplementary highlight since
              // the solid border already carries the contrast requirement.
              previousQuestion
                ? "border-accent-dark focus-within:ring-accent-dark/40"
                : "border-input-border focus-within:border-ring focus-within:ring-ring/50"
            )}
          >
            <Input
              ref={inputRef}
              id="ask-ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. top spenders this quarter"
              disabled={isLoading}
              aria-busy={isLoading}
              aria-describedby={previousQuestion ? "ask-ai-continuing-from" : undefined}
              className="min-h-11 border-0 shadow-none focus-visible:ring-0 sm:min-h-9"
            />
            {previousQuestion && (
              <p
                id="ask-ai-continuing-from"
                className="border-accent-dark/20 bg-accent/5 text-accent-darker min-w-0 truncate border-t px-3 py-1.5 text-xs"
              >
                Continuing from{" "}
                <q className="text-foreground" title={previousQuestion}>
                  {previousQuestion}
                </q>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={isLoading || input.trim().length === 0}
              aria-busy={isLoading}
              className="border-accent/40 text-accent-dark hover:bg-accent/10 hover:text-accent-dark min-h-11 sm:min-h-9"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {isLoading ? "Thinking…" : "Ask"}
            </Button>
            {onExplain && (
              <Button
                type="button"
                variant="ghost"
                onClick={onExplain}
                disabled={isLoading || !canExplain}
                className="text-muted-foreground hover:text-accent-dark min-h-11 sm:min-h-9"
              >
                Explain SQL
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Error — inline, no toast. The editor is left untouched. */}
      {limit && !isLoading && <AiLimitNotice limit={limit} />}
      {error && !limit && !isLoading && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Abstain — clarifying-question card. No SQL was injected. */}
      {clarifyingQuestion && !isLoading && (
        <div
          className={cn(
            "border-accent/30 bg-accent/5 flex flex-col gap-1 rounded-lg border px-3 py-2",
            motion
          )}
        >
          <p className="text-accent-dark flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> A quick question
          </p>
          <p className="text-foreground text-sm">{clarifyingQuestion}</p>
          {explanation && <p className="text-muted-foreground text-xs">{explanation}</p>}
        </div>
      )}

      {/* Assumptions — calm gold callout (the AI signal, not a background wash).
          Gated on !isLoading like every sibling section, so a prior query's
          assumptions don't linger while a new one is in flight. */}
      {!clarifyingQuestion && !isLoading && (assumptions?.length ?? 0) > 0 && (
        <div
          role="note"
          aria-label="Assumptions the assistant made"
          className={cn(
            "border-accent/30 bg-accent/5 flex flex-col gap-1 rounded-lg border px-3 py-2",
            motion
          )}
        >
          <p className="text-accent-dark text-xs font-semibold">Assumptions</p>
          <ul className="text-foreground list-inside list-disc space-y-0.5 text-xs">
            {assumptions!.map((a, i) => (
              <li key={`${String(i)}-${a}`}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Explanation panel — plain-English summary of the SQL. */}
      {!clarifyingQuestion && explanation && !isLoading && (
        <div
          className={cn(
            "border-border bg-card text-foreground rounded-lg border px-3 py-2 text-sm leading-relaxed",
            motion
          )}
        >
          {explanation}
        </div>
      )}

      <LiveRegion message={generatedAnnouncement ?? ""} politeness="polite" />
    </section>
  );
}
