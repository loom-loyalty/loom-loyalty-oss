import { useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";

import { Button } from "../../../primitives/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Card as CardPrimitive,
  CardTitle,
} from "../../../primitives/card";
import { defineOpenUIComponent } from "../../types";

/** Custom action type the host app handles to open the matching create editor. */
export const OPEN_DRAFT_IN_EDITOR_ACTION = "open-draft-in-editor";

const expression = z.record(z.string(), z.unknown());

/** A counter target the draft counts toward that doesn't exist yet. The Hub creates it on save. */
export const draftTargetSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.literal("COUNTER"),
  targetValue: z.number(),
  reregisterOnAchievement: z.boolean().optional(),
});

export type DraftTargetData = z.infer<typeof draftTargetSchema>;

/** A drafted event rule or flow. Nothing in it is saved until the user saves in the editor. */
export const ruleOrFlowDraftSchema = z.object({
  kind: z.enum(["event-rule", "flow"]),
  name: z.string(),
  code: z.string(),
  /** One line on why it's this kind. */
  reason: z.string(),
  /** Plain-language lines describing the trigger and steps or actions. */
  summary: z.array(z.string()),
  /** Things the request refers to that don't exist yet; the user fills them in. */
  needs: z.array(z.string()).optional(),
  /** Counter targets created along with the draft. */
  targets: z.array(draftTargetSchema).optional(),
  rule: z
    .object({
      eventTypeCode: z.string(),
      eventSubTypeIdentifier: z.string().optional(),
      eventExpression: expression.optional(),
      eventActionsExpression: expression.optional(),
      programIds: z.array(z.string()).optional(),
    })
    .optional(),
  flow: z
    .object({
      triggerEventTypeCode: z.string(),
      triggerEventSubTypeIdentifier: z.string().optional(),
      triggerCondition: expression.optional(),
      reEnrollment: z
        .object({
          mode: z.enum(["NEVER", "AFTER_COMPLETION", "AFTER_COOLDOWN"]),
          cooldown: z.string().optional(),
        })
        .optional(),
      entryStepKey: z.string().optional(),
      steps: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    .optional(),
});

export type RuleOrFlowDraftData = z.infer<typeof ruleOrFlowDraftSchema>;

const KIND_LABEL = { "event-rule": "Event rule", flow: "Flow" } as const;

export const RuleOrFlowDraft = defineOpenUIComponent({
  name: "RuleOrFlowDraft",
  props: z.object({ draft: ruleOrFlowDraftSchema }),
  description:
    "A drafted event rule or flow with an Open in editor button. Pass the draft object from draft_rule_or_flow verbatim. Opening the editor saves nothing.",
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const draft = props.draft;
    if (!draft) return null;
    const kindLabel = KIND_LABEL[draft.kind];
    const otherKind = draft.kind === "flow" ? "an event rule" : "a flow";
    const needs = draft.needs ?? [];
    const targets = draft.targets ?? [];
    const firstTarget = targets[0];

    return (
      <CardPrimitive>
        <CardHeader className="flex-col items-start gap-1">
          <p className="text-primary-dark text-xs font-semibold tracking-wide uppercase">
            {kindLabel} draft
          </p>
          <CardTitle>{draft.name}</CardTitle>
          <p className="text-muted-foreground font-mono text-xs">{draft.code}</p>
          <CardDescription className="mt-1">{draft.reason}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.summary.length > 0 && (
            <ol className="text-foreground list-decimal space-y-1 pl-5 text-sm">
              {draft.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          )}
          {targets.length > 0 && (
            <div className="text-sm">
              <p className="text-foreground font-medium">Creates these targets when you save:</p>
              <ul className="text-muted-foreground list-disc pl-5">
                {targets.map((target) => (
                  <li key={target.code}>
                    {target.name} <span className="font-mono text-xs">({target.code})</span>, goal{" "}
                    {target.targetValue}
                    {target.reregisterOnAchievement === false ? "" : ", starts again when reached"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {needs.length > 0 && (
            <div className="text-muted-foreground text-sm">
              <p className="font-medium">You&apos;ll need to fill in:</p>
              <ul className="list-disc pl-5">
                {needs.map((need) => (
                  <li key={need}>{need}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-wrap justify-end gap-2">
          {firstTarget && draft.kind === "event-rule" && (
            <Button
              variant="outline"
              onClick={() =>
                triggerAction(
                  `Draft the reward rule for reaching ${firstTarget.name} (${firstTarget.code})`
                )
              }
            >
              Draft the reward rule
            </Button>
          )}
          <Button variant="outline" onClick={() => triggerAction(`Make it ${otherKind} instead`)}>
            Make it {otherKind}
          </Button>
          <Button
            onClick={() =>
              triggerAction(`Open in ${kindLabel.toLowerCase()} editor`, undefined, {
                type: OPEN_DRAFT_IN_EDITOR_ACTION,
                params: { draft },
              })
            }
          >
            Open in {kindLabel.toLowerCase()} editor
          </Button>
        </CardFooter>
      </CardPrimitive>
    );
  },
});
