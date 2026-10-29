import { ArrowRight } from "lucide-react";

import { cn } from "../../../lib/utils";
import { PatternConfidence, type PatternConfidenceLevel } from "./pattern-confidence";

export interface LookalikeReason {
  /** A behavior the result shares with the seed */
  label: string;
  /** Share of the result with it, 0–100 */
  resultPercent: number;
  /** Share of all members with it, 0–100 */
  baselinePercent: number;
}

export interface LookalikeResultProps {
  seed: { name: string; count: number };
  resultCount: number;
  confidence: { level: PatternConfidenceLevel; detail?: string };
  reasons: LookalikeReason[];
  /** Items the result and seed share most */
  sharedItems?: string[];
  className?: string;
}

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * A lookalike audience: members who behave like a seed audience, with the
 * confidence and the computed reasons they were chosen.
 */
export function LookalikeResult({
  seed,
  resultCount,
  confidence,
  reasons,
  sharedItems = [],
  className,
}: LookalikeResultProps) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex items-stretch gap-3">
        <div className="border-border bg-card flex-1 rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Start from
          </p>
          <p className="text-foreground mt-1 font-semibold">{seed.name}</p>
          <p className="text-muted-foreground font-mono text-sm tabular-nums">
            {fmt(seed.count)} members
          </p>
        </div>
        <ArrowRight className="text-primary size-6 self-center" aria-hidden="true" />
        <div className="border-primary bg-card flex flex-[1.4] items-center justify-between gap-4 rounded-xl border-2 p-4">
          <div>
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">
              Members like them
            </p>
            <p className="text-foreground font-mono text-3xl font-semibold tabular-nums">
              {fmt(resultCount)}
            </p>
          </div>
          <PatternConfidence level={confidence.level} detail={confidence.detail} />
        </div>
      </div>

      <section aria-labelledby="lookalike-why" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 id="lookalike-why" className="text-foreground text-sm font-semibold">
            Why these members
          </h3>
          <span className="text-muted-foreground text-xs">These members vs. all members</span>
        </div>
        <ul className="@container space-y-3">
          {reasons.map((reason) => (
            <li
              key={reason.label}
              className="grid grid-cols-1 gap-1 @sm:grid-cols-[11rem_1fr_6rem] @sm:items-center @sm:gap-3"
            >
              <span className="text-foreground text-sm">{reason.label}</span>
              <div className="space-y-1" aria-hidden="true">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${reason.resultPercent}%` }}
                />
                <div
                  className="bg-muted-foreground/40 h-2 rounded-full"
                  style={{ width: `${reason.baselinePercent}%` }}
                />
              </div>
              <span className="text-foreground font-mono text-sm tabular-nums @sm:text-right">
                {reason.resultPercent}% · {reason.baselinePercent}%
              </span>
            </li>
          ))}
        </ul>
        {sharedItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Most shared:</span>
            {sharedItems.map((item) => (
              <span
                key={item}
                className="bg-primary/10 text-primary-dark rounded-md px-2 py-1 text-xs font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
