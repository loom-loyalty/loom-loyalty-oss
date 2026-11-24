/**
 * Chapter grouping shared by the quest panel and the sidebar status (fe#1398).
 *
 * The worker only sends later chapters once the earlier ones are settled, so
 * the current chapter is the first one with an open step, or the last one when
 * every step is settled.
 */
import type { OnboardingStepStatus } from "./types.js";

const CHAPTER_TITLES: Record<number, string> = {
  1: "Chapter 1: Set up your program",
  2: "Chapter 2: Go further",
};

export function chapterTitle(chapter: number): string {
  return CHAPTER_TITLES[chapter] ?? `Chapter ${String(chapter)}`;
}

export interface ChapterGroup {
  chapter: number;
  steps: OnboardingStepStatus[];
  done: number;
  skipped: number;
  /** Every step is done or skipped. */
  settled: boolean;
}

export function isStepSettled(step: OnboardingStepStatus): boolean {
  return step.done || !!step.skipped;
}

function toGroup(chapter: number, steps: OnboardingStepStatus[]): ChapterGroup {
  const done = steps.filter((s) => s.done).length;
  const skipped = steps.filter((s) => !s.done && s.skipped).length;
  return { chapter, steps, done, skipped, settled: done + skipped === steps.length };
}

/** Steps grouped by chapter, in chapter order, keeping each chapter's step order. */
export function groupByChapter(steps: OnboardingStepStatus[]): ChapterGroup[] {
  const byChapter = new Map<number, OnboardingStepStatus[]>();
  for (const step of steps) {
    const list = byChapter.get(step.chapter) ?? [];
    list.push(step);
    byChapter.set(step.chapter, list);
  }
  return [...byChapter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([chapter, list]) => toGroup(chapter, list));
}

/** The chapter the admin is working on; undefined when there are no steps. */
export function currentChapter(groups: ChapterGroup[]): ChapterGroup | undefined {
  return groups.find((group) => !group.settled) ?? groups[groups.length - 1];
}
