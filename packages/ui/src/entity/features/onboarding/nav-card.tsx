/**
 * The always-on onboarding status card for the foot of the sidebar: program label,
 * progress through the current chapter, the next step, and Threads and tier. It opens
 * the full quest panel in a popover (beside the sidebar, or above the card when the
 * sidebar is a phone-width drawer).
 *
 * Presentational: the app passes the status and decides what to do on open (Hub runs
 * one sync). Moved from `apps/hub` so the Hub and the brand videos render the same card.
 */
import { ChevronRight, Trophy } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";

import { useIsMobile } from "../../../hooks/use-mobile.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../primitives/popover.js";
import { SidebarFooterSection } from "../../../shell/sidebar.js";
import { currentChapter, groupByChapter, isStepSettled } from "./chapters.js";
import { DEFAULT_PROGRAM_NAME, ProgramInfoButton, ProgramLabel } from "./program-label.js";
import { QuestPanel } from "./quest-panel.js";
import type { OnboardingNavCardProps } from "./types.js";

export function OnboardingNavCard({
  status,
  viewerId,
  platformName,
  LinkComponent,
  skipping,
  onOpenChange: onOpenChangeProp,
  isMobile: isMobileProp,
}: OnboardingNavCardProps): ReactNode {
  const [open, setOpen] = useState(false);
  // Below lg the sidebar is a drawer with no room beside it, and Radix only shifts a
  // side="right" popover vertically, so it lands off-screen. Open above the card there.
  const detectedMobile = useIsMobile();
  const isMobile = isMobileProp ?? detectedMobile;
  const { steps, standing } = status;
  const groups = groupByChapter(steps);
  // Count the chapter in progress, as the quest panel does (fe#1398).
  const current = currentChapter(groups);
  const total = current?.steps.length ?? 0;
  // Skipped steps count as settled, as in the quest panel.
  const doneCount = current?.done ?? 0;
  const skippedCount = current?.skipped ?? 0;
  const settledCount = doneCount + skippedCount;
  const chapterPrefix = groups.length > 1 && current ? `Chapter ${String(current.chapter)}: ` : "";
  const progressLabel =
    `${chapterPrefix}${String(doneCount)} of ${String(total)} steps done` +
    (skippedCount > 0 ? `, ${String(skippedCount)} skipped` : "");
  const complete = groups.every((group) => group.settled);
  const percent = total > 0 ? Math.round((settledCount / total) * 100) : 100;
  const nextStep = steps.find((s) => !isStepSettled(s));

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChangeProp?.(next);
  };

  // Following a step link leaves the popover behind; close it on the way out.
  const closeOnLink = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };

  return (
    <SidebarFooterSection>
      {/* The info button and the popover trigger are siblings: no button nests in another. */}
      <div className="bg-primary/40 rounded-lg">
        <div className="flex items-center justify-between gap-1 pt-2 pr-1 pl-3">
          <ProgramLabel standing={standing} tone="sidebar" />
          <ProgramInfoButton standing={standing} tone="sidebar" />
        </div>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="hover:bg-primary/60 block min-h-11 w-full rounded-b-lg px-3 pt-1 pb-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label={`${standing.program?.name ?? DEFAULT_PROGRAM_NAME}. ${complete ? "Setup complete" : `Set up ${platformName}`}: ${progressLabel}. Open setup status`}
              data-testid="onboarding-nav-status"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-white/90">
                  {complete && (
                    <Trophy className="text-accent h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">
                    {complete ? "Setup complete" : `Set up ${platformName}`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-white/90 tabular-nums">
                  {settledCount}/{total}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </span>
              <span className="block truncate text-xs text-white/90">
                {nextStep
                  ? `Next: ${nextStep.title}`
                  : `${standing.points.toLocaleString()} Threads`}
              </span>
              <span
                className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/20"
                aria-hidden="true"
              >
                <span
                  className="bg-accent block h-full rounded-full transition-all"
                  style={{ width: `${String(percent)}%` }}
                />
              </span>
              {!complete && standing.points > 0 && (
                <span className="mt-1 block text-xs text-white/90">
                  {standing.points.toLocaleString()} Threads
                  {standing.tier ? ` · ${standing.tier.name}` : ""}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side={isMobile ? "top" : "right"}
            align={isMobile ? "center" : "end"}
            sideOffset={12}
            collisionPadding={16}
            aria-label="Setup quests"
            className="max-h-(--radix-popover-content-available-height) w-[min(32rem,calc(100vw-2rem))] overflow-y-auto border-0 bg-transparent p-0 shadow-lg"
            onClick={closeOnLink}
          >
            <QuestPanel
              status={status}
              viewerId={viewerId}
              platformName={platformName}
              LinkComponent={LinkComponent}
              skipping={skipping}
              variant="popover"
            />
          </PopoverContent>
        </Popover>
      </div>
    </SidebarFooterSection>
  );
}
