import type { ReactNode } from "react";

import { cn } from "../../../lib/utils";
import { Card, CardContent, CardFooter } from "../../../primitives/card";
import { PatternConfidence, type PatternConfidenceLevel } from "./pattern-confidence";

export interface PatternSignal {
  /** What was measured, in plain words */
  label: string;
  /** The group's value now */
  current: string;
  /** The same group's value at the comparison point */
  previous: string;
  /** All members, for scale */
  baseline: string;
}

export interface PatternInsightCardProps {
  /** Short context line, e.g. "Found overnight" */
  eyebrow: string;
  /** The finding as one sentence */
  title: string;
  description?: string;
  /** Column headings for the three value columns */
  columnLabels?: { current: string; previous: string; baseline: string };
  /** The computed signals that explain the finding */
  signals: PatternSignal[];
  confidence: { level: PatternConfidenceLevel; detail?: string };
  /** Buttons, e.g. Review and Create audience */
  actions?: ReactNode;
  className?: string;
}

const DEFAULT_COLUMNS = { current: "Now", previous: "Before", baseline: "All members" };

/**
 * A segment Patterns discovered on its own, explained by the computed signals
 * behind it. The text only puts those numbers into words.
 */
export function PatternInsightCard({
  eyebrow,
  title,
  description,
  columnLabels = DEFAULT_COLUMNS,
  signals,
  confidence,
  actions,
  className,
}: PatternInsightCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1.5">
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">{eyebrow}</p>
            <h2 className="text-foreground text-xl leading-snug font-semibold">{title}</h2>
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
          <PatternConfidence level={confidence.level} detail={confidence.detail} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-chrome-border bg-chrome border-b">
              <th
                scope="col"
                className="text-chrome-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                Signal
              </th>
              {[columnLabels.current, columnLabels.previous, columnLabels.baseline].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="text-chrome-foreground px-3 py-2 text-right text-xs font-semibold tracking-wide uppercase"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.label} className="border-border border-b last:border-b-0">
                <th scope="row" className="text-foreground px-3 py-2.5 text-left font-normal">
                  {signal.label}
                </th>
                <td className="text-accent-darker px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                  {signal.current}
                </td>
                <td className="text-foreground px-3 py-2.5 text-right font-mono tabular-nums">
                  {signal.previous}
                </td>
                <td className="text-muted-foreground px-3 py-2.5 text-right font-mono tabular-nums">
                  {signal.baseline}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
      {actions && <CardFooter className="justify-end gap-2 pt-0">{actions}</CardFooter>}
    </Card>
  );
}
