/**
 * Customer Audiences Utilities
 * Formatting helpers and display constants
 */

import { formatRelativeTime } from "@loom-loyalty/core";

import type {
  BanditStatus,
  CustomerAudience,
  CustomerAudienceType,
  SegmentEngine,
} from "./types.js";

// ============================================================================
// Display Labels
// ============================================================================

/**
 * Human-readable labels for audience types
 */
export const audienceTypeLabels: Record<CustomerAudienceType, string> = {
  CUSTOMER_LIST: "Customer List",
  CUSTOMER_SEGMENT: "Customer Segment",
};

/**
 * Human-readable labels for segment engines
 */
export const engineLabels: Record<SegmentEngine, string> = {
  CLICKHOUSE: "Rule-Based",
  THREADS: "AI-Generated",
};

/**
 * Descriptions for segment engines
 */
export const engineDescriptions: Record<SegmentEngine, string> = {
  CLICKHOUSE: "Define membership rules using SQL queries",
  THREADS: "AI discovers customer patterns automatically",
};

/**
 * Human-readable labels for bandit status
 */
export const banditStatusLabels: Record<BanditStatus, string> = {
  exploring: "Exploring",
  optimized: "Optimized",
};

// ============================================================================
// Badge Classes (Semantic Color Tokens)
// ============================================================================

/**
 * Tailwind badge classes for audience types using semantic tokens
 */
export const audienceTypeBadgeClasses: Record<CustomerAudienceType, string> = {
  CUSTOMER_LIST: "bg-primary/10 text-primary border-primary/20",
  CUSTOMER_SEGMENT: "bg-primary/10 text-primary border-primary/20",
};

/**
 * Tailwind badge classes for segment engines using semantic tokens
 */
export const engineBadgeClasses: Record<SegmentEngine, string> = {
  CLICKHOUSE: "bg-success/10 text-success-dark border-success/20",
  THREADS: "bg-accent/10 text-accent border-accent/30",
};

/**
 * Tailwind badge classes for bandit status using semantic tokens
 */
export const banditStatusBadgeClasses: Record<BanditStatus, string> = {
  exploring: "bg-accent/10 text-accent border-accent/20",
  optimized: "bg-success/10 text-success-dark border-success/20",
};

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format a confidence score as a percentage
 * @param score Number between 0 and 1
 */
export function formatConfidenceScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Format a member count with K/M suffixes for large numbers
 */
export function formatMemberCount(count: number | null | undefined): string {
  if (count == null) {
    return "\u2014"; // Em dash for not available
  }
  if (count === 0) {
    return "0";
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

/**
 * Format a behavior weight as a percentage
 * @param weight Number between 0 and 1
 */
export function formatBehaviorWeight(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

/**
 * Format an ISO datetime string as relative time
 * @param isoString ISO 8601 datetime string
 */
export function formatLastUpdate(isoString: string): string {
  return formatRelativeTime(isoString);
}

/**
 * Format a cron expression as human-readable text
 */
export function formatCronExpression(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  // Common patterns
  if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every hour";
  }
  if (minute === "0" && hour === "0" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Daily at midnight";
  }
  if (minute === "0" && hour.includes("/")) {
    const interval = hour.split("/")[1]?.trim();
    return interval ? `Every ${interval} hours` : cron;
  }
  if (hour.includes("/")) {
    const interval = hour.split("/")[1]?.trim();
    return interval ? `Every ${interval} hours` : cron;
  }

  return cron;
}

/**
 * Format query duration in milliseconds to human-readable
 */
export function formatQueryDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms / 60_000)}m`;
}

/**
 * Format member count change with +/- prefix
 */
export function formatMemberCountChange(change: number): string {
  const formatted = formatMemberCount(Math.abs(change));
  if (change > 0) return `+${formatted}`;
  if (change < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Format conversion rate as percentage
 */
export function formatConversionRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format overlap percentage
 */
export function formatOverlapPercentage(percentage: number): string {
  return `${Math.round(percentage)}%`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the member count from any audience type.
 *
 * A Platform API segment carries its count as `lastCardinality`, written by
 * each completed computation run. Returns null for a segment that has not
 * finished a run yet, so it renders as "not available" instead of a
 * misleading 0.
 */
export function getAudienceMemberCount(
  audience: CustomerAudience | null | undefined
): number | null {
  if (!audience) return 0;

  if (audience.type === "CUSTOMER_LIST") {
    return audience.memberCount ?? 0;
  }
  if (audience.type === "CUSTOMER_SEGMENT") {
    if (typeof audience.lastCardinality === "number") {
      return audience.lastCardinality;
    }
    if (audience.engine === "CLICKHOUSE" || audience.engine === "THREADS") {
      return (audience.engineConfig as { memberCount?: number } | undefined)?.memberCount ?? 0;
    }
    return null;
  }
  return 0;
}

/**
 * Short note explaining a segment's member count: when it was last computed,
 * or why there is no count yet. Returns null for lists, and for segments that
 * carry no computation data (local mock segments).
 */
export function getSegmentComputationNote(audience: CustomerAudience): string | null {
  if (audience.type !== "CUSTOMER_SEGMENT") return null;
  if (audience.versionStatus === "DRAFT") return "Publish to compute";

  switch (audience.computationStatus) {
    case "COMPUTING":
      return "Computing now";
    case "FAILED":
      return "Last run failed";
    default:
      break;
  }
  if (audience.lastComputedDateTime) {
    return `Updated ${formatRelativeTime(audience.lastComputedDateTime)}`;
  }
  if (audience.computationStatus === "PENDING") return "Not computed yet";
  return null;
}

/**
 * Get display label for an audience
 */
export function getAudienceTypeLabel(audience: CustomerAudience): string {
  if (audience.type === "CUSTOMER_LIST") {
    return audienceTypeLabels.CUSTOMER_LIST;
  }
  return `${engineLabels[audience.engine] ?? audience.engine} Segment`;
}

/**
 * Check if audience is active (not archived, within duration period)
 */
export function isAudienceActive(audience: CustomerAudience): boolean {
  // Check if THREADS segment is archived
  if (audience.type === "CUSTOMER_SEGMENT" && audience.engine === "THREADS") {
    const config = audience.engineConfig as { archivedAt?: string };
    if (config.archivedAt) return false;
  }

  // Check duration period if set
  if (audience.durationPeriod?.fixedDurationDateTimePeriod) {
    const now = new Date();
    const start = new Date(audience.durationPeriod.fixedDurationDateTimePeriod.startDateTime);
    const end = audience.durationPeriod.fixedDurationDateTimePeriod.endDateTime
      ? new Date(audience.durationPeriod.fixedDurationDateTimePeriod.endDateTime)
      : null;

    if (now < start) return false;
    if (end && now > end) return false;
  }

  return true;
}

/**
 * Get audience status label
 */
export function getAudienceStatus(
  audience: CustomerAudience | null | undefined
): "active" | "inactive" | "archived" | "scheduled" {
  if (!audience) return "inactive";

  // Check archived first (THREADS only)
  if (audience.type === "CUSTOMER_SEGMENT" && audience.engine === "THREADS") {
    const config = audience.engineConfig as { archivedAt?: string };
    if (config.archivedAt) return "archived";
  }

  // Check duration period
  if (audience.durationPeriod?.fixedDurationDateTimePeriod) {
    const now = new Date();
    const start = new Date(audience.durationPeriod.fixedDurationDateTimePeriod.startDateTime);
    const end = audience.durationPeriod.fixedDurationDateTimePeriod.endDateTime
      ? new Date(audience.durationPeriod.fixedDurationDateTimePeriod.endDateTime)
      : null;

    if (now < start) return "scheduled";
    if (end && now > end) return "inactive";
  }

  return "active";
}

/**
 * Sort behaviors by contribution weight (descending)
 */
export function sortBehaviorsByWeight<T extends { contributionWeight: number }>(
  behaviors: T[]
): T[] {
  return [...behaviors].sort((a, b) => b.contributionWeight - a.contributionWeight);
}

/**
 * Get top N behaviors sorted by weight
 */
export function getTopBehaviors<T extends { contributionWeight: number }>(
  behaviors: T[],
  count: number = 5
): T[] {
  return sortBehaviorsByWeight(behaviors).slice(0, count);
}

/**
 * Calculate total weight of behaviors (should be ~1.0)
 */
export function calculateTotalWeight<T extends { contributionWeight: number }>(
  behaviors: T[]
): number {
  return behaviors.reduce((sum, b) => sum + b.contributionWeight, 0);
}
