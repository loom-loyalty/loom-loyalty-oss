import { Lightbulb } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import type { MemoryScope } from "./memory-citation";

export interface MemoryProposalCardProps {
  /** The memory Weave proposes to save */
  text: string;
  /** Private memories are saved by the user; organization memories wait for an admin */
  scope: MemoryScope;
  onSave?: () => void;
  onEdit?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const SCOPE_NOTE: Record<MemoryScope, string> = {
  private: "Only you will see this.",
  org: "An org admin approves it before Weave uses it.",
};

/**
 * Weave's "remember this?" proposal. Nothing is saved until a person approves
 * or edits it.
 */
export function MemoryProposalCard({
  text,
  scope,
  onSave,
  onEdit,
  onDismiss,
  className,
}: MemoryProposalCardProps) {
  return (
    <section
      aria-label="Memory proposal"
      className={cn("border-accent/40 bg-accent/5 rounded-xl border p-4", className)}
    >
      <p className="text-accent-darker flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <Lightbulb className="size-4" aria-hidden="true" />
        Remember this?
      </p>
      <p className="text-foreground mt-2 text-sm">{text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground mr-auto text-xs">{SCOPE_NOTE[scope]}</span>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={onDismiss}>
          Not now
        </Button>
        <Button variant="outline" size="sm" className="min-h-11" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" className="min-h-11" onClick={onSave}>
          Save memory
        </Button>
      </div>
    </section>
  );
}
