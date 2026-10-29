/**
 * Shared utility functions for promotion components.
 */

/** Format a raw status enum (e.g. "IN_PROGRESS") to a display label ("In progress"). */
export function formatTargetStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
