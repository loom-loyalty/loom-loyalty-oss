"use client";

import { Paperclip, X } from "lucide-react";

import { cn } from "../lib/utils";

export interface AttachmentChipProps {
  /** Display label — typically a filename. Truncated visually at 20 chars; full value lives in the title attribute. */
  filename: string;
  /** When provided, renders a 44x44 remove button; when omitted, the chip is read-only. */
  onRemove?: () => void;
  /** Extra class names for layout overrides (e.g. composer adds `mx-3 mt-2` margins). */
  className?: string;
}

// Shared chip — composer preview (with onRemove) and user-message bubble (read-only). Single attachment-chip testid; tests render each surface in isolation.
export function AttachmentChip({ filename, onRemove, className }: AttachmentChipProps) {
  return (
    <div
      data-testid="attachment-chip"
      className={cn(
        "border-border bg-muted text-foreground inline-flex w-fit",
        "items-center gap-2 rounded-md border py-1 pr-1 pl-2 text-xs",
        className
      )}
    >
      <Paperclip size="0.85em" aria-hidden="true" />
      <span className="max-w-[20ch] truncate" title={filename}>
        {filename}
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove attachment ${filename}`}
          onClick={onRemove}
          className={cn(
            "hover:text-destructive ml-1 inline-flex h-11 w-11",
            "items-center justify-center rounded-md",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          )}
        >
          <X size="0.85em" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
