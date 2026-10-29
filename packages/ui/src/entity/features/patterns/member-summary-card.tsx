import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../primitives/card";

export interface MemberSummaryCardProps {
  /** Plain-language summary, written from the member's computed profile */
  summary: string;
  /** Why and when it was last rewritten, e.g. "Rewritten Oct 27 · stay pattern changed" */
  updatedLabel: string;
  /** Short behavior traits behind the summary */
  traits?: string[];
  className?: string;
}

/** A member's Patterns summary, rewritten only when their behavior meaningfully changes. */
export function MemberSummaryCard({
  summary,
  updatedLabel,
  traits = [],
  className,
}: MemberSummaryCardProps) {
  return (
    <Card className={className}>
      <CardHeader variant="brand">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="text-primary size-4" aria-hidden="true" />
          Summary
        </CardTitle>
        <span className="text-chrome-muted-foreground text-xs">{updatedLabel}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-foreground text-base leading-relaxed">{summary}</p>
        {traits.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Traits">
            {traits.map((trait) => (
              <li
                key={trait}
                className="bg-primary/10 text-primary-dark rounded-md px-2 py-1 text-xs font-medium"
              >
                {trait}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
