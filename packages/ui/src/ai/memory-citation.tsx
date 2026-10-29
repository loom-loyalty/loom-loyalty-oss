import { BookMarked } from "lucide-react";

import { cn } from "../lib/utils";

export type MemoryScope = "org" | "private";

export interface CitedMemory {
  /** Memory id, as the chat's citation event carries it */
  id: string;
  /** The memory's text, shown as the operator saved it */
  text: string;
  /** Who the memory applies to */
  scope: MemoryScope;
}

export interface MemoryCitationProps {
  /** Memories the answer used; renders nothing when empty */
  memories: CitedMemory[];
  className?: string;
}

const SCOPE_LABEL: Record<MemoryScope, string> = {
  org: "Organization memory",
  private: "Your memory",
};

/**
 * Names the Weave memories an assistant answer relied on, under the answer, so
 * an operator can see which saved rule shaped it.
 */
export function MemoryCitation({ memories, className }: MemoryCitationProps) {
  if (memories.length === 0) return null;
  const label = memories.length === 1 ? "Used 1 memory" : `Used ${memories.length} memories`;
  return (
    <section
      aria-label={label}
      className={cn("border-primary/30 bg-primary/5 rounded-md border px-3 py-2", className)}
    >
      <p className="text-primary-dark flex items-center gap-2 text-xs font-semibold">
        <BookMarked className="size-4" aria-hidden="true" />
        {label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {memories.map((memory) => (
          <li key={memory.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="text-foreground">{memory.text}</span>
            <span className="text-muted-foreground text-xs">{SCOPE_LABEL[memory.scope]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
