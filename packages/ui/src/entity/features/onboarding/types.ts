import type { ComponentType } from "react";

import type { LinkComponentProps } from "../../../shell/sidebar.js";

/**
 * Onboarding quest status, as the Hub worker's `/api/onboarding/*` endpoints return it.
 * Step and habit codes are plain strings here; Hub narrows them to its catalogue codes.
 */

export interface OnboardingStepStatus<Code extends string = string> {
  code: Code;
  title: string;
  description?: string;
  /** Display points from the tenant catalogue; the earn rule awards the real amount. */
  points?: number;
  route: string;
  /** The chapter the step belongs to; later chapters appear once the first is settled. */
  chapter: number;
  done: boolean;
  /** The org skipped this step; doing it later still completes and pays it. */
  skipped?: boolean;
  /** Display name of the admin who skipped the step. */
  skippedBy?: string;
  /** Whether admins may skip this step (staff can forbid it per step). */
  skippable?: boolean;
  /** Display name of the admin credited with the step. */
  completedBy?: string;
  /** ISO time the step happened in the admin's org. */
  completedAt?: string;
}

/** A weekly habit and whether the org did it this week. */
export interface OnboardingHabitStatus<Code extends string = string> {
  code: Code;
  title: string;
  description?: string;
  /** Display points per week from the tenant catalogue. */
  points?: number;
  route: string;
  doneThisWeek: boolean;
  /** Display name of the admin credited this week. */
  completedBy?: string;
}

export interface OnboardingStanding {
  points: number;
  /** The tenant loyalty program the points are in; absent until the person has an account. */
  program?: { code: string; name: string };
  tier?: { code: string; name: string };
  badges: { code: string; name: string }[];
}

export type OnboardingStatus =
  | { enabled: false }
  | {
      enabled: true;
      /** The Loom organization this status is for; a query report names it. */
      organizationId?: string;
      steps: OnboardingStepStatus[];
      /** Weekly habits; present once the first chapter is settled. */
      habits?: OnboardingHabitStatus[];
      /** ISO time the habit week resets (Monday 12:00 AM Central); present with `habits`. */
      weekResetsAt?: string;
      /** Whether the caller may earn (admin role); others see status only. */
      canEarn: boolean;
      standing: OnboardingStanding;
    };

/** Onboarding status once the worker says onboarding is enabled for this org. */
export type EnabledOnboardingStatus = Extract<OnboardingStatus, { enabled: true }>;

/** Lets an admin skip a step; the app owns the request. */
export interface SkipOnboardingStep {
  /** Skips one step; never rejects. Failures land in `error`. */
  skip(code: string): Promise<void>;
  /** The step being skipped right now, if any. */
  pendingCode: string | null;
  /** User-facing copy for the last failed skip, cleared on the next attempt. */
  error: string | null;
}

/** The link the panel renders for step routes (the app passes its router link). */
export type QuestLinkComponent = ComponentType<LinkComponentProps>;

export interface QuestPanelProps {
  status: EnabledOnboardingStatus;
  /** Viewer's id; scopes the remembered collapse state. */
  viewerId: string | null;
  /** The product name in "Set up {platformName}". */
  platformName: string;
  /** Router link for step routes. Defaults to a plain anchor. */
  LinkComponent?: QuestLinkComponent;
  /** Present only when the viewer may skip (admins). */
  skipping?: SkipOnboardingStep;
  /**
   * `home` (default) is the collapsible home card. `popover` is the nav
   * status view: always expanded, one column, no collapse toggle.
   */
  variant?: "home" | "popover";
}

export interface QuestPanelErrorProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
  /** The product name in "Set up {platformName}". */
  platformName: string;
}

export interface OnboardingNavCardProps {
  status: EnabledOnboardingStatus;
  /** Viewer's id; scopes the panel's remembered collapse state. */
  viewerId: string | null;
  platformName: string;
  LinkComponent?: QuestLinkComponent;
  skipping?: SkipOnboardingStep;
  /** Called when the popover opens or closes (Hub syncs on open). */
  onOpenChange?: (open: boolean) => void;
  /** Phone-width layout (popover above the card). Defaults to the viewport check. */
  isMobile?: boolean;
}
