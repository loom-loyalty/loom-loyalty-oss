/**
 * Entity Link Button
 *
 * Displays a truncated entity ID as a link to another entity's detail view
 * (e.g. linking a customer event to its ledger entry, or a ledger entry back
 * to its originating event). Degrades to plain, non-interactive text when no
 * `onClick` handler is provided.
 */

"use client";

import { ExternalLink } from "lucide-react";

/** Entity-type nouns this button knows how to describe in its accessible name. */
export type EntityLinkLabel = "event" | "ledger entry" | "customer";

export interface EntityLinkButtonProps {
  /** Full (untruncated) ID of the linked entity. */
  id: string;
  /** Noun used in the `title` and `aria-label` copy, e.g. "View {entityLabel} {id}". */
  entityLabel: EntityLinkLabel;
  /** Callback invoked with the full entity ID when the link is clicked. */
  onClick?: (id: string) => void;
}

/** Truncate a UUID to first 8 chars for display. */
export function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function EntityLinkButton({ id, entityLabel, onClick }: EntityLinkButtonProps) {
  if (!onClick) {
    return <span className="text-foreground font-mono text-xs">{truncateId(id)}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className="text-primary hover:text-primary/80 inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 font-mono text-xs transition-colors"
      title={id}
      aria-label={`View ${entityLabel} ${id}`}
    >
      <span>{truncateId(id)}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </button>
  );
}
