/**
 * Which lifecycle actions an event rule version offers, from its own
 * `versionStatus` .
 * Mirrors the API's rules in `EventRuleServiceImpl`: publish needs DRAFT,
 * pause needs PUBLISHED, resume needs PAUSED, and an old version (one a newer
 * non-draft version replaced) is never made live again. There is no "New
 * Version" action: Edit on a live or paused version saves into a new draft.
 * An unknown or missing status offers no lifecycle action.
 */

export type EventRuleVersionStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";

export interface EventRuleLifecycleActions {
  publish: boolean;
  pause: boolean;
  resume: boolean;
}

const NONE: EventRuleLifecycleActions = { publish: false, pause: false, resume: false };

export function toEventRuleVersionStatus(value: unknown): EventRuleVersionStatus | undefined {
  return value === "DRAFT" || value === "PUBLISHED" || value === "PAUSED" || value === "ARCHIVED"
    ? value
    : undefined;
}

export function getEventRuleLifecycleActions(
  versionStatus: unknown,
  options: { isReplaced?: boolean } = {}
): EventRuleLifecycleActions {
  const status = toEventRuleVersionStatus(versionStatus);
  if (!status || options.isReplaced) return NONE;
  return {
    publish: status === "DRAFT",
    pause: status === "PUBLISHED",
    resume: status === "PAUSED",
  };
}

/**
 * Whether a newer non-draft version of the same code replaced this one, so it
 * is old (the API refuses to publish or resume it). A newer DRAFT doesn't
 * count: pausing the live version and starting an edit leaves it current.
 */
export function isEventRuleVersionReplaced(
  version: { eventRuleId?: unknown; version?: unknown },
  siblings: ReadonlyArray<{ eventRuleId?: unknown; version?: unknown; versionStatus?: unknown }>
): boolean {
  const own = typeof version.version === "number" ? version.version : undefined;
  if (own === undefined) return false;
  return siblings.some(
    (sibling) =>
      sibling.eventRuleId !== version.eventRuleId &&
      sibling.versionStatus !== "DRAFT" &&
      typeof sibling.version === "number" &&
      sibling.version > own
  );
}
