/**
 * Names the loyalty program the onboarding quests earn in, so admins see the
 * quests are a loyalty and engagement program and not just a checklist.
 */
import { Award, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../primitives/dialog.js";
import type { OnboardingStanding } from "./types.js";

/** Shown until the person has an account in the tenant program. */
export const DEFAULT_PROGRAM_NAME = "Warp Up";

export function ProgramLabel({
  standing,
  tone,
}: {
  standing: OnboardingStanding;
  /** `sidebar` sits on the dark sidebar; `panel` on a card. */
  tone: "sidebar" | "panel";
}): ReactNode {
  const name = standing.program?.name ?? DEFAULT_PROGRAM_NAME;
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 text-xs font-semibold tracking-[0.06em] uppercase",
        // 90% white keeps 12px text above 4.5:1 on the teal sidebar card.
        tone === "sidebar" ? "text-white/90" : "text-muted-foreground"
      )}
    >
      <Award
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          tone === "sidebar" ? "text-accent" : "text-accent-dark"
        )}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** A 44px info button beside the program label that explains the program. */
export function ProgramInfoButton({
  standing,
  tone,
}: {
  standing: OnboardingStanding;
  tone: "sidebar" | "panel";
}): ReactNode {
  const name = standing.program?.name ?? DEFAULT_PROGRAM_NAME;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`About ${name}`}
          className={cn(
            // z-10 keeps the full 44px target above the card's trigger it overlaps.
            "relative z-10 -my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            tone === "sidebar"
              ? "text-white/90 hover:bg-white/10 hover:text-white focus-visible:outline-white"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:outline-ring"
          )}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>About {name}</DialogTitle>
          <DialogDescription>
            {name} is Loom Loyalty&apos;s own loyalty and engagement program for admins.
          </DialogDescription>
        </DialogHeader>
        <div className="text-foreground grid gap-3 text-sm">
          <p>You earn Threads for each step you finish setting up your loyalty program.</p>
          <p>Threads move you up the tiers: Apprentice, Weaver, Artisan, then Master Weaver.</p>
          <p>
            Milestones earn badges: First Cloth for your first live event, and Full Loom when every
            step is done.
          </p>
          <p className="text-muted-foreground">
            Why &ldquo;warp&rdquo;? In weaving, warping means threading the loom&apos;s lengthwise
            threads before any weaving can start. These setup steps do the same for your program.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
