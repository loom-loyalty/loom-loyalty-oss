import { useTriggerAction } from "@openuidev/react-lang";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { z } from "zod";

import { cn } from "../../../lib/utils";
import { Button } from "../../../primitives/button";
import {
  CardContent,
  CardFooter,
  CardHeader,
  Card as CardPrimitive,
  CardTitle,
} from "../../../primitives/card";
import { defineOpenUIComponent } from "../../types";

const scenarioResultSchema = z.object({
  name: z.string(),
  result: z.enum(["PASSED", "FAILED", "INCONCLUSIVE"]),
  message: z.string().optional(),
});

const resultConfig = {
  PASSED: {
    icon: CheckCircle2,
    iconClass: "text-success-dark",
    textClass: "text-success-dark",
    bgClass: "bg-success/5",
    label: "Passed",
  },
  FAILED: {
    icon: XCircle,
    iconClass: "text-destructive",
    textClass: "text-destructive",
    bgClass: "bg-destructive/5",
    label: "Failed",
  },
  INCONCLUSIVE: {
    icon: MinusCircle,
    iconClass: "text-muted-foreground",
    textClass: "text-muted-foreground",
    bgClass: "bg-muted/50",
    label: "Inconclusive",
  },
};

export const ValidationReport = defineOpenUIComponent({
  name: "ValidationReport",
  props: z.object({
    title: z.string().optional(),
    scenarios: z.array(scenarioResultSchema),
    overallResult: z.enum(["PASSED", "FAILED", "INCONCLUSIVE"]),
    fixAction: z.string().optional(),
    proceedAction: z.string().optional(),
    durationMs: z.number().optional(),
  }),
  description:
    "A validation report card showing pass/fail results for program validation scenarios. Displays each scenario with its result, expandable failure details, and optional Fix Issues / Proceed Anyway actions.",
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const title = props.title ?? "Validation Report";
    const passed = props.scenarios.filter((s) => s.result === "PASSED").length;
    const total = props.scenarios.length;
    const overallConfig = resultConfig[props.overallResult];
    const OverallIcon = overallConfig.icon;

    return (
      <CardPrimitive>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <OverallIcon className={cn("h-5 w-5", overallConfig.iconClass)} aria-hidden="true" />
              {title}
            </CardTitle>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                overallConfig.bgClass,
                overallConfig.textClass
              )}
              role="status"
              aria-label={`${overallConfig.label}: ${passed} of ${total} passed`}
            >
              {overallConfig.label} ({passed}/{total})
            </span>
          </div>
          {props.durationMs != null && (
            <p className="text-muted-foreground text-xs">
              Completed in {(props.durationMs / 1000).toFixed(1)}s
            </p>
          )}
        </CardHeader>
        <CardContent>
          <ul className="divide-border divide-y" role="list" aria-label="Validation scenarios">
            {props.scenarios.map((scenario, i) => {
              const config = resultConfig[scenario.result];
              const Icon = config.icon;

              return (
                <li key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Icon
                      className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClass)}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground text-sm font-medium">{scenario.name}</span>
                        <span
                          className={cn("text-xs font-medium", config.textClass)}
                          role="status"
                          aria-label={`${scenario.name}: ${config.label}`}
                        >
                          {config.label}
                        </span>
                      </div>
                      {scenario.message && (
                        <p className="text-muted-foreground mt-1 text-xs">{scenario.message}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
        {(props.fixAction || props.proceedAction) && props.overallResult !== "PASSED" && (
          <CardFooter className="justify-end gap-2">
            {props.proceedAction && (
              <Button variant="outline" onClick={() => triggerAction(props.proceedAction!)}>
                Proceed Anyway
              </Button>
            )}
            {props.fixAction && (
              <Button onClick={() => triggerAction(props.fixAction!)}>Fix Issues</Button>
            )}
          </CardFooter>
        )}
      </CardPrimitive>
    );
  },
});
