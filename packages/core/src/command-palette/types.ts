import type { ComponentType } from "react";

export type CommandPaletteErrorState = "rate-limited" | "error";

/** A user-facing scope filter for narrowing Platform search results. */
export interface CommandPaletteScope {
  /** Matches `SearchResultResponse.entityType` (for example, `EVENT_RULE`). */
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Optional Platform search prefix without its trailing colon. */
  prefix?: string;
  /** Whether the Platform only returns this entity type when explicitly scoped. */
  requiresPrefix?: boolean;
}
