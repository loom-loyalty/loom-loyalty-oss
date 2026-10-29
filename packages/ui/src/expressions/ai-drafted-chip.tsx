import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const LABEL = "AI-drafted — review before saving";

/**
 * The "AI-drafted" affordance shown on a tree the AI proposed — reinforces
 * AI-proposes / human-approves. Consumers render it only while a tree is present
 * AND it's AI-drafted; it clears on the first manual edit.
 *
 * `role="img"` (a labeled graphic), NOT `role="status"`: the surfaces that mount
 * this already announce the proposal through the builder's always-mounted
 * LiveRegion ("Reward built" / the clarifying question), so a live-region chip
 * would double-announce. Gold is the AI signal (Sparkles + accent), not a wash.
 */
export function AiDraftedChip(): ReactNode {
  return (
    <div
      role="img"
      aria-label={LABEL}
      className="bg-accent/10 text-accent-darker inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" /> {LABEL}
    </div>
  );
}
