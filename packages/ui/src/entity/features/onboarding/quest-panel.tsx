/**
 * Onboarding quest panel (gamified onboarding, plan U7): the setup steps grouped by
 * chapter, the weekly habits, the viewer's rewards, and the one-time unlock banner
 * when a later chapter arrives.
 *
 * Presentational: the app passes the status, the product name, its router link and
 * (for admins) the skip handler. The collapse and unlock-seen choices are remembered
 * per viewer in localStorage. Moved from `apps/hub` so the Hub and the brand videos
 * render the same component.
 */
import { formatShortDate } from "@loom-loyalty/core";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  MinusCircle,
  Repeat,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { TierBadge } from "../../../data-display/tier-badge.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Card, CardContent, CardHeader } from "../../../primitives/card.js";
import { Progress } from "../../../primitives/progress.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { LinkComponentProps } from "../../../shell/sidebar.js";
import {
  chapterTitle,
  currentChapter,
  groupByChapter,
  isStepSettled,
  type ChapterGroup,
} from "./chapters.js";
import { ProgramInfoButton, ProgramLabel } from "./program-label.js";
import type {
  OnboardingHabitStatus,
  OnboardingStanding,
  OnboardingStepStatus,
  QuestLinkComponent,
  QuestPanelErrorProps,
  QuestPanelProps,
  SkipOnboardingStep,
} from "./types.js";

/** Plain anchor, for renders with no router (Storybook, videos). */
function AnchorLink({ href, children, ...rest }: LinkComponentProps): ReactNode {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const QuestLink = createContext<QuestLinkComponent>(AnchorLink);

/** Renders the app's router link (from `QuestPanel`'s `LinkComponent`). */
function StepLink(props: LinkComponentProps): ReactNode {
  return createElement(useContext(QuestLink), props);
}

const COLLAPSE_STORAGE_PREFIX = "loom.hub.onboarding.collapsed";
const UNLOCK_SEEN_STORAGE_PREFIX = "loom.hub.onboarding.unlock-seen";

function collapseStorageKey(viewerId: string | null): string | null {
  return viewerId ? `${COLLAPSE_STORAGE_PREFIX}.${viewerId}` : null;
}

function unlockSeenStorageKey(viewerId: string | null, chapter: number): string | null {
  return viewerId ? `${UNLOCK_SEEN_STORAGE_PREFIX}.${String(chapter)}.${viewerId}` : null;
}

function readFlag(key: string | null): boolean {
  if (!key) return false;
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string | null, value: boolean): void {
  if (!key) return;
  try {
    if (value) window.localStorage.setItem(key, "true");
    else window.localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode, quota): the choice lasts for this view only.
  }
}

function stepsDoneLabel(done: number, total: number, skipped = 0): string {
  const label = `${String(done)} of ${String(total)} steps done`;
  return skipped > 0 ? `${label}, ${String(skipped)} skipped` : label;
}

// ---------------------------------------------------------------------------
// Loading and error
// ---------------------------------------------------------------------------

export function QuestPanelSkeleton(): ReactNode {
  return (
    <section aria-label="Setup quests" aria-busy="true">
      <Card className="overflow-hidden" data-testid="quest-panel-skeleton">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <span className="sr-only">Loading setup quests</span>
          <Skeleton className="h-2 w-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

export function QuestPanelError({
  message,
  onRetry,
  isRetrying,
  platformName,
}: QuestPanelErrorProps): ReactNode {
  return (
    <section aria-labelledby="quest-panel-error-heading">
      <Card className="overflow-hidden">
        <CardHeader>
          <h2
            id="quest-panel-error-heading"
            className="text-card-foreground text-xl leading-none font-semibold"
          >
            Set up {platformName}
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3" role="alert" aria-live="assertive">
            <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-foreground text-sm">{message}</p>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={isRetrying ? undefined : onRetry}
                aria-disabled={isRetrying}
              >
                {isRetrying ? "Retrying…" : "Retry"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/** Announces steps that a sync (or any status update) newly completes. */
function useNewlyCompletedAnnouncement(steps: OnboardingStepStatus[]): string {
  const [announcement, setAnnouncement] = useState("");
  const previousDone = useRef<Set<string> | null>(null);

  useEffect(() => {
    const done = new Set(steps.filter((s) => s.done).map((s) => s.code));
    const previous = previousDone.current;
    previousDone.current = done;
    if (!previous) return;
    const newlyDone = steps.filter((s) => s.done && !previous.has(s.code));
    if (newlyDone.length === 0) return;
    const titles = newlyDone.map((s) => s.title).join(", ");
    setAnnouncement(`Step complete: ${titles}. ${stepsDoneLabel(done.size, steps.length)}.`);
  }, [steps]);

  return announcement;
}

export function QuestPanel({
  status,
  viewerId,
  platformName,
  LinkComponent = AnchorLink,
  skipping,
  variant = "home",
}: QuestPanelProps): ReactNode {
  const { steps, standing } = status;
  const habits = status.habits ?? [];
  const groups = groupByChapter(steps);
  const multiChapter = groups.length > 1;
  // The header counts the chapter in progress, so Chapter 2 starts at 0 of 7.
  const current = currentChapter(groups);
  const total = current?.steps.length ?? 0;
  const doneCount = current?.done ?? 0;
  const skippedCount = current?.skipped ?? 0;
  // Skipped steps count as settled: an org without tiers can still finish setup.
  const complete = groups.length > 0 && groups.every((group) => group.settled);
  const nextCode = steps.find((s) => !isStepSettled(s))?.code;
  const storageKey = collapseStorageKey(viewerId);
  const [collapsed, setCollapsed] = useState(() => readFlag(storageKey));
  const [completeExpanded, setCompleteExpanded] = useState(false);
  const latestChapter = groups[groups.length - 1]?.chapter ?? 1;
  const unlockKey = unlockSeenStorageKey(viewerId, latestChapter);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  // Read on every render: the chapter can change after mount, and the home
  // panel and the nav popover share the flag.
  const unlockSeen = dismissedKey === unlockKey || readFlag(unlockKey);
  const showUnlock = multiChapter && !unlockSeen;
  const announcement = useNewlyCompletedAnnouncement(steps);
  const headingId = useId();
  const bodyId = useId();

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeFlag(storageKey, next);
  };

  const dismissUnlock = () => {
    setDismissedKey(unlockKey);
    writeFlag(unlockKey, true);
  };

  const inPopover = variant === "popover";
  // The unlock banner opens a collapsed panel once, so the moment isn't missed.
  const expanded = inPopover || showUnlock || (complete ? completeExpanded : !collapsed);
  const onToggle = () => {
    // The banner holds the panel open, so a toggle while it shows means collapse.
    if (showUnlock) {
      dismissUnlock();
      if (complete) {
        setCompleteExpanded(false);
      } else {
        setCollapsed(true);
        writeFlag(storageKey, true);
      }
      return;
    }
    if (complete) setCompleteExpanded((v) => !v);
    else toggleCollapsed();
  };
  const toggleLabel = complete
    ? expanded
      ? "Hide steps"
      : "Show steps"
    : expanded
      ? "Collapse"
      : "Expand";

  return (
    <QuestLink.Provider value={LinkComponent}>
      <section aria-labelledby={headingId}>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <Card className="overflow-hidden">
          <CardHeader className="flex-wrap py-3">
            <div className="grid min-w-0 gap-1.5">
              <div className="flex min-w-0 items-center gap-1">
                <ProgramLabel standing={standing} tone="panel" />
                <ProgramInfoButton standing={standing} tone="panel" />
              </div>
              <div className="flex min-w-0 items-center gap-3">
                {complete && (
                  <Trophy className="text-accent-dark h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <h2
                  id={headingId}
                  className="text-card-foreground text-xl leading-none font-semibold"
                >
                  {complete ? "Setup complete" : `Set up ${platformName}`}
                </h2>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {multiChapter && !complete && current
                    ? `Chapter ${String(current.chapter)} · `
                    : ""}
                  {stepsDoneLabel(doneCount, total, skippedCount)}
                </span>
              </div>
            </div>
            {!inPopover && (
              <Button
                variant="ghost"
                className="text-foreground hover:bg-foreground/5 hover:text-foreground min-h-11"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={onToggle}
              >
                {toggleLabel}
                {expanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}
          </CardHeader>
          <div id={bodyId} hidden={!expanded}>
            {expanded && (
              <CardContent
                className={
                  inPopover ? "grid gap-6" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]"
                }
              >
                <div className="space-y-4">
                  {showUnlock && (
                    <UnlockBanner
                      chapter={latestChapter}
                      hasHabits={habits.length > 0}
                      onDismiss={dismissUnlock}
                    />
                  )}
                  <div className="space-y-1.5">
                    <Progress
                      value={doneCount + skippedCount}
                      max={Math.max(total, 1)}
                      variant={complete ? "success" : "default"}
                      aria-label="Setup progress"
                      getValueLabel={() => stepsDoneLabel(doneCount, total, skippedCount)}
                    />
                  </div>
                  {multiChapter ? (
                    groups.map((group) => (
                      <QuestChapter
                        key={group.chapter}
                        group={group}
                        nextCode={nextCode}
                        startOpen={group === current || !group.settled}
                        skipping={status.canEarn ? skipping : undefined}
                      />
                    ))
                  ) : (
                    <QuestStepList
                      steps={steps}
                      nextCode={nextCode}
                      skipping={status.canEarn ? skipping : undefined}
                    />
                  )}
                  {habits.length > 0 && (
                    <QuestHabits habits={habits} weekResetsAt={status.weekResetsAt} />
                  )}
                  {skipping?.error && (
                    <p role="alert" className="text-destructive text-sm">
                      {skipping.error}
                    </p>
                  )}
                </div>
                <QuestStanding standing={standing} />
              </CardContent>
            )}
          </div>
        </Card>
      </section>
    </QuestLink.Provider>
  );
}

function UnlockBanner({
  chapter,
  hasHabits,
  onDismiss,
}: {
  chapter: number;
  hasHabits: boolean;
  onDismiss: () => void;
}): ReactNode {
  return (
    <div
      className="border-accent/40 bg-accent/10 flex items-start gap-3 rounded-lg border p-4"
      data-testid="quest-unlock-banner"
    >
      <Sparkles className="text-accent-dark mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-foreground text-sm font-semibold">{chapterTitle(chapter)} is unlocked</p>
        <p className="text-muted-foreground text-sm">
          {hasHabits
            ? "New steps are ready, and weekly habits keep earning Threads after setup."
            : "New steps are ready when you are."}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground min-h-11 min-w-11"
        aria-label="Dismiss unlock message"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function QuestChapter({
  group,
  nextCode,
  startOpen,
  skipping,
}: {
  group: ChapterGroup;
  nextCode: string | undefined;
  /** Settled earlier chapters start folded so the open chapter leads. */
  startOpen: boolean;
  skipping?: SkipOnboardingStep;
}): ReactNode {
  const [open, setOpen] = useState(startOpen);
  // Only a settled chapter can fold; an open step always stays in view.
  const shown = open || !group.settled;
  const headingId = useId();
  const listId = useId();
  const title = chapterTitle(group.chapter);
  return (
    <section aria-labelledby={headingId} className="space-y-1" data-chapter={group.chapter}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="text-foreground text-sm font-semibold">
          {title}
          <span className="text-muted-foreground ml-2 font-mono text-xs font-normal tabular-nums">
            {stepsDoneLabel(group.done, group.steps.length, group.skipped)}
          </span>
        </h3>
        {group.settled && (
          <Button
            variant="ghost"
            className="text-foreground hover:bg-foreground/5 hover:text-foreground min-h-11"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`${open ? "Hide" : "Show"} ${title} steps`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "Show"}
            {open ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
      <div id={listId} hidden={!shown}>
        {shown && (
          <QuestStepList
            steps={group.steps}
            nextCode={nextCode}
            skipping={skipping}
            label={`${title} steps`}
            titleLevel="h4"
          />
        )}
      </div>
    </section>
  );
}

function QuestStepList({
  steps,
  nextCode,
  skipping,
  label = "Setup steps",
  titleLevel = "h3",
}: {
  steps: OnboardingStepStatus[];
  nextCode: string | undefined;
  /** Present only when the viewer may skip (admins). */
  skipping?: SkipOnboardingStep;
  label?: string;
  /** Step titles sit one level under the nearest heading. */
  titleLevel?: "h3" | "h4";
}): ReactNode {
  return (
    <ol className="divide-border divide-y" aria-label={label}>
      {steps.map((step) => (
        <QuestStepRow
          key={step.code}
          step={step}
          isNext={step.code === nextCode}
          skipping={skipping}
          titleLevel={titleLevel}
        />
      ))}
    </ol>
  );
}

function QuestStepRow({
  step,
  isNext,
  skipping,
  titleLevel,
}: {
  step: OnboardingStepStatus;
  isNext: boolean;
  skipping?: SkipOnboardingStep;
  titleLevel: "h3" | "h4";
}): ReactNode {
  const Title = titleLevel;
  const skipped = !step.done && !!step.skipped;
  const stateLabel = step.done ? "Done" : skipped ? "Skipped" : isNext ? "Up next" : "To do";
  const canSkip = !!skipping && !step.done && !skipped && step.skippable;
  const isSkipping = skipping?.pendingCode === step.code;
  const completedOn = formatShortDate(step.completedAt);

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center" data-step={step.code}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {step.done ? (
          <CheckCircle2 className="text-success-dark mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : skipped ? (
          <MinusCircle
            className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <Circle
            className={
              isNext
                ? "text-primary mt-0.5 h-5 w-5 shrink-0"
                : "text-muted-foreground mt-0.5 h-5 w-5 shrink-0"
            }
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Title className="text-foreground text-sm font-medium">{step.title}</Title>
            <Badge
              variant={step.done ? "success" : skipped ? "secondary" : isNext ? "info" : "outline"}
            >
              {stateLabel}
            </Badge>
          </div>
          {step.description && <p className="text-muted-foreground text-sm">{step.description}</p>}
          {step.done && (step.completedBy || completedOn) && (
            <p className="text-muted-foreground text-xs">
              {step.completedBy ? `Done by ${step.completedBy}` : "Done"}
              {completedOn && step.completedAt && (
                <>
                  {" · "}
                  <time dateTime={step.completedAt}>{completedOn}</time>
                </>
              )}
            </p>
          )}
          {skipped && (
            <p className="text-muted-foreground text-xs">
              {step.skippedBy ? `Skipped by ${step.skippedBy}` : "Skipped"}. Doing it later still
              counts.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-8 sm:pl-0">
        {typeof step.points === "number" && (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            +{step.points} Threads
          </span>
        )}
        {isNext ? (
          <Button asChild className="min-h-11">
            <StepLink href={step.route} aria-label={`Start: ${step.title}`}>
              Start
            </StepLink>
          </Button>
        ) : (
          <StepLink
            href={step.route}
            aria-label={`${step.done ? "View" : "Open"}: ${step.title}`}
            className="text-primary-dark focus-visible:outline-ring inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-medium hover:underline focus-visible:outline focus-visible:outline-2"
          >
            {step.done ? "View" : "Open"}
          </StepLink>
        )}
        {canSkip && (
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground min-h-11"
            aria-label={`Skip: ${step.title}`}
            aria-disabled={!!skipping.pendingCode}
            onClick={skipping.pendingCode ? undefined : () => void skipping.skip(step.code)}
          >
            {isSkipping ? "Skipping…" : "Skip"}
          </Button>
        )}
      </div>
    </li>
  );
}

function QuestHabits({
  habits,
  weekResetsAt,
}: {
  habits: OnboardingHabitStatus[];
  weekResetsAt: string | undefined;
}): ReactNode {
  const headingId = useId();
  const doneCount = habits.filter((h) => h.doneThisWeek).length;
  return (
    <section aria-labelledby={headingId} className="space-y-1" data-testid="quest-habits">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className="text-foreground text-sm font-semibold">
          This week
          <span className="text-muted-foreground ml-2 font-mono text-xs font-normal tabular-nums">
            {String(doneCount)} of {String(habits.length)} habits done
          </span>
        </h3>
        <p className="text-muted-foreground text-xs">
          {/* The week always resets Monday 12:00 AM Central (KTD8). */}
          Resets{" "}
          {weekResetsAt ? (
            <time dateTime={weekResetsAt}>Monday 12:00 AM CT</time>
          ) : (
            "Monday 12:00 AM CT"
          )}
        </p>
      </div>
      <ul className="divide-border divide-y" aria-label="Weekly habits">
        {habits.map((habit) => (
          <li
            key={habit.code}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
            data-habit={habit.code}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {habit.doneThisWeek ? (
                <CheckCircle2
                  className="text-success-dark mt-0.5 h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Repeat
                  className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-foreground text-sm font-medium">{habit.title}</h4>
                  <Badge variant={habit.doneThisWeek ? "success" : "outline"}>
                    {habit.doneThisWeek ? "Done this week" : "To do"}
                  </Badge>
                </div>
                {habit.description && (
                  <p className="text-muted-foreground text-sm">{habit.description}</p>
                )}
                {habit.doneThisWeek && habit.completedBy && (
                  <p className="text-muted-foreground text-xs">Done by {habit.completedBy}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 pl-8 sm:pl-0">
              {typeof habit.points === "number" && (
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  +{habit.points} Threads a week
                </span>
              )}
              <StepLink
                href={habit.route}
                aria-label={`${habit.doneThisWeek ? "View" : "Open"}: ${habit.title}`}
                className="text-primary-dark focus-visible:outline-ring inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-medium hover:underline focus-visible:outline focus-visible:outline-2"
              >
                {habit.doneThisWeek ? "View" : "Open"}
              </StepLink>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuestStanding({ standing }: { standing: OnboardingStanding }): ReactNode {
  const headingId = useId();
  const hasNothing = standing.points <= 0 && !standing.tier && standing.badges.length === 0;
  return (
    <aside aria-labelledby={headingId} className="bg-muted/40 space-y-3 rounded-lg p-4">
      <h3 id={headingId} className="text-foreground text-sm font-semibold">
        Your rewards
      </h3>
      {hasNothing ? (
        <p className="text-muted-foreground text-sm">
          Finish your first step to earn Threads toward your first tier.
        </p>
      ) : (
        <>
          <p className="text-foreground text-sm">
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {standing.points.toLocaleString()}
            </span>{" "}
            Threads
          </p>
          {standing.tier && <TierBadge tier={standing.tier.name} />}
          {standing.badges.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Your badges">
              {standing.badges.map((badge) => (
                <li key={badge.code}>
                  <Badge variant="outline">{badge.name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
