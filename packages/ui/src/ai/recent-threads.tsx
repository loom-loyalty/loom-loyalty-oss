"use client";

import { formatRelativeTime } from "@loom-loyalty/core";
import { MessageSquare } from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/utils";
import { Skeleton } from "../primitives/skeleton";
import { useAiChat } from "./ai-chat-context";
import { useRecentThreads, type UseRecentThreadsOptions } from "./use-recent-threads";

export interface RecentThreadsProps extends Omit<UseRecentThreadsOptions, "refreshKey"> {
  className?: string;
}

/**
 * RecentThreads — the user's latest Weave conversations on an app's home
 * page. A click opens that conversation in the chat sheet through
 * `useAiChat().openThread`. The list fetches on mount and again each time the
 * chat sheet closes, so a conversation started from the prompt box shows up.
 * Renders nothing when there are none.
 */
export function RecentThreads({ className, ...options }: RecentThreadsProps) {
  const { openThread, aiPanelOpen } = useAiChat();
  // Adjusted during render (not in an effect) so the refetch starts on the
  // same pass the sheet closes.
  const [panelWasOpen, setPanelWasOpen] = useState(aiPanelOpen);
  const [closes, setCloses] = useState(0);
  if (panelWasOpen !== aiPanelOpen) {
    setPanelWasOpen(aiPanelOpen);
    if (!aiPanelOpen) setCloses((n) => n + 1);
  }
  const { threads, isLoading, error, retry } = useRecentThreads({ ...options, refreshKey: closes });

  if (isLoading && threads.length === 0) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading recent conversations"
        className={cn("space-y-2", className)}
      >
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    );
  }

  if (error && threads.length === 0) {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", className)}>
        <p className="text-muted-foreground">Couldn&apos;t load your recent conversations.</p>
        <button
          type="button"
          onClick={retry}
          className="text-primary-dark hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Retry
        </button>
      </div>
    );
  }

  if (threads.length === 0) return null;

  return (
    <nav aria-labelledby="recent-conversations-heading" className={className}>
      <h2
        id="recent-conversations-heading"
        className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase"
      >
        Recent conversations
      </h2>
      <ul
        aria-labelledby="recent-conversations-heading"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => openThread(thread.id)}
              className={cn(
                "border-border bg-card hover:border-primary hover:shadow-hover flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left shadow-sm transition-shadow",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
              )}
            >
              <MessageSquare className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-medium">
                  {thread.title}
                </span>
                <time dateTime={thread.activeAt} className="text-muted-foreground block text-xs">
                  {formatRelativeTime(thread.activeAt)}
                </time>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
