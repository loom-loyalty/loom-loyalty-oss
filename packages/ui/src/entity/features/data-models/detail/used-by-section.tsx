import { GitBranch } from "lucide-react";
import type { ReactNode } from "react";
import type { CrossEntityImpactEntry } from "../types.js";
import { Section } from "./section.js";

export function UsedBySection({ impact }: { impact: CrossEntityImpactEntry[] }): ReactNode {
  return (
    <Section title={`Used By (${impact.length})`}>
      <div className="space-y-2">
        {impact.map((entry) => (
          <div
            key={entry.dataModel.dataModelId}
            className="border-border bg-muted/30 flex items-start gap-3 rounded-md border p-3"
          >
            <GitBranch className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="text-foreground text-sm font-medium">
                {entry.dataModel.type?.name ?? entry.dataModel.type?.code ?? "Unknown"}
              </p>
              <p className="text-muted-foreground font-mono text-xs">
                References: {entry.referencingElements.join(", ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
