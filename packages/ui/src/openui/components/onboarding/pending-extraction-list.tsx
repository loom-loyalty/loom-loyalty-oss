import { FREEFORM_LOW_CONFIDENCE_THRESHOLD } from "@loom-loyalty/program-builder";
import { useTriggerAction } from "@openuidev/react-lang";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import { Button } from "../../../primitives/button";
import { defineOpenUIComponent } from "../../types";

const extractionSchema = z.object({
  expectedField: z.string(),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  sourceLocation: z.object({ line: z.number(), col: z.number() }).optional(),
});

const pendingExtractionListProps = z.object({
  extractions: z
    .array(extractionSchema)
    // Mirrors PENDING_EXTRACTIONS_MAX in apps/ai-server/src/routes/chat.ts; both sides reject the same edge case.
    .max(20)
    .describe(
      "FreeformExtractionResult[] from /api/ai/templates/extract. The component filters to the LOW-confidence subset internally; high-confidence values are silently applied by the agent."
    ),
  acknowledgeLabel: z
    .string()
    .optional()
    .describe("Submit-button label after the user acknowledges each row. Default: 'Continue'."),
  acknowledgeAction: z
    .string()
    .optional()
    .describe(
      "User-message string sent when the user clicks the submit button after acknowledging each low-confidence row. Defaults to 'I've reviewed the low-confidence values.'"
    ),
});

export const PendingExtractionList = defineOpenUIComponent({
  name: "PendingExtractionList",
  props: pendingExtractionListProps,
  description:
    "Render the LOW-confidence subset of FreeformExtractionResult[] as a list of acknowledgement rows. Each row shows expectedField (monospaced) + value + confidence badge + 'Use anyway' (44×44 WCAG). Submit triggers an action carrying the acknowledged-field set so the agent can proceed with apply.",
  component: ({ props }) => {
    const extractions = useMemo(() => props.extractions ?? [], [props.extractions]);
    const acknowledgeLabel = props.acknowledgeLabel ?? "Continue";
    const acknowledgeAction = props.acknowledgeAction ?? "I've reviewed the low-confidence values.";

    const triggerAction = useTriggerAction();

    const lowConfidence = useMemo(
      () => extractions.filter((e) => e.confidence < FREEFORM_LOW_CONFIDENCE_THRESHOLD),
      [extractions]
    );

    const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
    useEffect(() => {
      setAcknowledged(new Set());
    }, [extractions]);

    const allAcknowledged =
      lowConfidence.length > 0 && lowConfidence.every((e) => acknowledged.has(e.expectedField));

    const handleSubmit = () => {
      triggerAction(acknowledgeAction, undefined, {
        type: "pending_extractions_acknowledged",
        params: {
          acknowledged: [...acknowledged],
        },
      });
    };

    if (lowConfidence.length === 0) {
      return (
        <section className="border-border bg-muted/40 space-y-2 rounded-md border p-3">
          <p className="text-muted-foreground text-sm">
            All extracted values are high confidence. Nothing to acknowledge.
          </p>
        </section>
      );
    }

    return (
      <section
        className="border-accent/30 bg-accent/5 space-y-2 rounded-md border p-3"
        aria-label="Low-confidence extractions"
      >
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-foreground text-sm font-semibold">
            {lowConfidence.length === 1
              ? "1 field needs your review"
              : `${lowConfidence.length} fields need your review`}
          </h3>
          <Badge
            variant="secondary"
            aria-label={`${acknowledged.size} of ${lowConfidence.length} acknowledged`}
          >
            {acknowledged.size}/{lowConfidence.length}
          </Badge>
        </header>
        <p className="text-accent-dark text-xs">
          The LLM extracted these values but isn&apos;t confident. Acknowledge each before
          continuing.
        </p>
        <ul className="space-y-1.5">
          {lowConfidence.map((extraction) => {
            const isAcknowledged = acknowledged.has(extraction.expectedField);
            return (
              <li key={extraction.expectedField} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-mono text-xs">
                    {extraction.expectedField}{" "}
                    <span className="text-muted-foreground">
                      ({Math.round(extraction.confidence * 100)}%)
                    </span>
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {renderValue(extraction.value)}
                  </p>
                </div>
                <Button
                  variant={isAcknowledged ? "secondary" : "outline"}
                  // Button's built-in sizes top out at h-10; explicit min enforces the WCAG 44×44 touch target.
                  className={cn(
                    "min-h-[44px] min-w-[44px]",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  )}
                  onClick={() =>
                    setAcknowledged((prev) => {
                      const next = new Set(prev);
                      if (next.has(extraction.expectedField)) {
                        next.delete(extraction.expectedField);
                      } else {
                        next.add(extraction.expectedField);
                      }
                      return next;
                    })
                  }
                  aria-label={
                    isAcknowledged
                      ? `Unacknowledge ${extraction.expectedField}`
                      : `Use ${extraction.expectedField} anyway despite low confidence`
                  }
                  aria-pressed={isAcknowledged}
                >
                  {isAcknowledged ? "Acknowledged" : "Use anyway"}
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-end">
          <Button type="button" disabled={!allAcknowledged} onClick={handleSubmit}>
            {acknowledgeLabel}
          </Button>
        </div>
      </section>
    );
  },
});

function renderValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "(empty)";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
