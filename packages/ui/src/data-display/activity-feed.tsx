"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";

export interface ActivityItem {
  /** Unique identifier */
  id: string;
  /** Activity title/description */
  title: string;
  /** Timestamp to display */
  timestamp: string;
  /** Optional icon for the activity */
  icon?: LucideIcon;
  /** Optional avatar */
  avatar?: {
    src?: string;
    fallback: string;
  };
  /** Activity type for color coding */
  type?: "default" | "success" | "warning" | "destructive";
  /** Additional metadata text */
  metadata?: string;
}

export interface ActivityFeedProps {
  /** List of activity items */
  items: ActivityItem[];
  /** Maximum number of items to show */
  maxItems?: number;
  /** Show the timeline connector line */
  showTimeline?: boolean;
  /** Accessible label for the feed */
  ariaLabel?: string;
  /** Additional className */
  className?: string;
}

const typeColors = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success-dark",
  warning: "bg-accent/10 text-accent-dark",
  destructive: "bg-destructive/10 text-destructive",
};

const dotColors = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-accent",
  destructive: "bg-destructive",
};

/**
 * Activity feed component for displaying a timeline of events.
 * Used for audit logs, recent activity, and event history.
 * Includes ARIA feed role for accessibility (WCAG 2.1 AA).
 */
export function ActivityFeed({
  items,
  maxItems,
  showTimeline = true,
  ariaLabel = "Activity feed",
  className,
}: ActivityFeedProps) {
  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  const totalItems = displayItems.length;

  return (
    <div role="feed" aria-label={ariaLabel} className={cn("space-y-4", className)}>
      {displayItems.map((item, index) => {
        const isLast = index === displayItems.length - 1;
        const Icon = item.icon;

        return (
          <article
            key={item.id}
            aria-posinset={index + 1}
            aria-setsize={totalItems}
            className="flex gap-3"
          >
            {/* Timeline indicator */}
            <div className="flex flex-col items-center" aria-hidden="true">
              {item.avatar ? (
                <Avatar className="h-8 w-8">
                  {item.avatar.src && <AvatarImage src={item.avatar.src} />}
                  <AvatarFallback className="text-xs">{item.avatar.fallback}</AvatarFallback>
                </Avatar>
              ) : Icon ? (
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    typeColors[item.type || "default"]
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
              ) : (
                <div
                  className={cn("mt-2 h-2.5 w-2.5 rounded-full", dotColors[item.type || "default"])}
                />
              )}
              {showTimeline && !isLast && <div className="bg-border mt-2 h-full w-px" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <p className="text-foreground text-sm font-medium">{item.title}</p>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                <time>{item.timestamp}</time>
                {item.metadata && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.metadata}</span>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
