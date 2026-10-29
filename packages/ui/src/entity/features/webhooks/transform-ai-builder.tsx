"use client";

import type { AiLimit } from "@loom-loyalty/core";
import { AlertCircle, Sparkles, Wand2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { LiveRegion } from "../../../a11y/live-region.js";
import { useReducedMotion } from "../../../a11y/use-reduced-motion.js";
import { AiLimitNotice } from "../../../ai/ai-limit-notice.js";
import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import { Label } from "../../../primitives/label.js";
import { Textarea } from "../../../primitives/textarea.js";

export interface TransformAiBuilderProps {
  /** Event types the endpoint subscribes to — seed the (optional) grounding selector. */
  eventTypes: string[];
  /** Currently selected event type for grounding (controlled), or "" for none. */
  selectedEventType: string;
  onSelectedEventTypeChange: (eventType: string) => void;
  /** Generate a fresh handler from the natural-language intent (+ selected event). */
  onGenerate: (prompt: string) => void;
  /** Revise the current handler with the AI; gated on `canFix`. */
  onFix: (prompt: string) => void;
  /** Whether there's current handler code to revise (enables "Fix with AI"). */
  canFix?: boolean;
  /** True while a generate/fix request is in flight. */
  isLoading?: boolean;
  /** True while the selected event's schema is resolving (grounding). */
  schemaLoading?: boolean;
  /** Whether grounding resolved a payload schema for the selected event. */
  hasSchema?: boolean;
  /** Inline error from the last request (no toast). */
  error?: string | null;
  /** Set when the daily AI allowance refused the last request; replaces `error`. */
  limit?: AiLimit | null;
  /** Assumptions the model surfaced for the last proposal. */
  assumptions?: string[];
  /** Plain-English explanation of the proposed handler. */
  explanation?: string | null;
  /** Clarifying question shown when the model abstains. */
  clarifyingQuestion?: string | null;
  /** aria-live message announced when a proposal lands. */
  generatedAnnouncement?: string | null;
}

/**
 * AI builder for webhook transformations: a natural-language intent that proposes
 * a `handler(webhook)` into the editor for human review. Modeled on Spindle's
 * Ask-AI bar — GOLD is the AI *signal* (Sparkles, the Generate button, output
 * callouts), not a background wash; the zone sits above and is subordinate to the
 * code editor. Presentational only: it never calls the network or executes code.
 */
export function TransformAiBuilder({
  eventTypes,
  selectedEventType,
  onSelectedEventTypeChange,
  onGenerate,
  onFix,
  canFix = false,
  isLoading = false,
  schemaLoading = false,
  hasSchema = false,
  error,
  limit,
  assumptions,
  explanation,
  clarifyingQuestion,
  generatedAnnouncement,
}: TransformAiBuilderProps): ReactNode {
  const [input, setInput] = useState("");
  const prefersReducedMotion = useReducedMotion();
  const motion = prefersReducedMotion
    ? ""
    : "animate-in fade-in-0 slide-in-from-top-1 duration-200";

  const trimmed = input.trim();
  // Block submit while the event schema is still resolving — otherwise a fast
  // click sends an undefined schema and silently loses field grounding.
  const canSubmit = trimmed.length > 0 && !isLoading && !schemaLoading;

  return (
    <section
      aria-label="AI transformation builder"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onGenerate(trimmed);
        }}
        className="flex flex-col gap-2"
      >
        <Label
          htmlFor="transform-ai-input"
          className="text-foreground flex items-center gap-1.5 text-sm font-medium"
        >
          <Sparkles className="text-accent h-4 w-4" aria-hidden="true" />
          Describe the transformation
        </Label>
        <Textarea
          id="transform-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. drop the customer's email and phone, and add a source field set to 'loom'"
          rows={2}
          disabled={isLoading}
          aria-busy={isLoading}
          className="focus-visible:border-accent focus-visible:ring-accent/40"
        />

        {eventTypes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transform-ai-event" className="text-muted-foreground text-xs">
              Ground on event (optional)
            </Label>
            <select
              id="transform-ai-event"
              value={selectedEventType}
              onChange={(e) => onSelectedEventTypeChange(e.target.value)}
              disabled={isLoading}
              className="border-input-border bg-input focus:border-ring focus:ring-ring/50 h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus:ring-[3px] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">No event — generic handler</option>
              {eventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
            {selectedEventType && (
              <p className="text-muted-foreground text-xs" role="status">
                {schemaLoading
                  ? "Loading event schema…"
                  : hasSchema
                    ? "Grounded on this event's payload schema."
                    : "No schema found for this event — generating without field grounding."}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            variant="outline"
            disabled={!canSubmit}
            aria-busy={isLoading}
            className="border-accent/40 text-accent-darker hover:bg-accent/10 hover:text-accent-darker min-h-11 sm:min-h-9"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {isLoading ? "Generating…" : "Generate"}
          </Button>
          {canFix && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (canSubmit) onFix(trimmed);
              }}
              disabled={!canSubmit}
              className="text-muted-foreground hover:text-accent-darker min-h-11 sm:min-h-9"
            >
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              Fix with AI
            </Button>
          )}
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

      {/* Abstain — clarifying-question card. No code was injected. */}
      {clarifyingQuestion && !isLoading && (
        <div
          className={cn(
            "border-accent/30 bg-accent/5 flex flex-col gap-1 rounded-lg border px-3 py-2",
            motion
          )}
        >
          <p className="text-accent-darker flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> A quick question
          </p>
          <p className="text-foreground text-sm">{clarifyingQuestion}</p>
          {explanation && <p className="text-muted-foreground text-xs">{explanation}</p>}
        </div>
      )}

      {/* Assumptions — calm gold callout (the AI signal, not a background wash). */}
      {!clarifyingQuestion && !isLoading && (assumptions?.length ?? 0) > 0 && (
        <div
          role="note"
          aria-label="Assumptions the assistant made"
          className={cn(
            "border-accent/30 bg-accent/5 flex flex-col gap-1 rounded-lg border px-3 py-2",
            motion
          )}
        >
          <p className="text-accent-darker text-xs font-semibold">Assumptions</p>
          <ul className="text-foreground list-inside list-disc space-y-0.5 text-xs">
            {assumptions!.map((assumption, i) => (
              <li key={`${String(i)}-${assumption}`}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Explanation — plain-English summary of the proposed handler. */}
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

      <p className="text-muted-foreground text-xs">
        Review the generated code before saving — you&rsquo;re always in control of what runs.
      </p>

      <LiveRegion message={generatedAnnouncement ?? ""} politeness="polite" />
    </section>
  );
}
