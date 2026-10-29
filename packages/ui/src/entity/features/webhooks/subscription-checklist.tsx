"use client";

/**
 * SubscriptionChecklist - Event type toggle list for webhook subscriptions
 *
 * Displays a grouped checklist of event types with category headers.
 * Used in the webhook form to select which events to subscribe to.
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { cn } from "../../../lib/utils.js";
import { Checkbox } from "../../../primitives/checkbox.js";
import type { SubscriptionChecklistProps } from "./types.js";

/**
 * Group event types by category prefix, sorted alphabetically by category then by
 * event within each category. e.g., "member.created" -> category "member".
 */
function groupByCategory(eventTypes: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const eventType of eventTypes) {
    const dotIndex = eventType.indexOf(".");
    const category = dotIndex > -1 ? eventType.slice(0, dotIndex) : "other";
    const existing = groups.get(category) ?? [];
    existing.push(eventType);
    groups.set(category, existing);
  }

  const sorted = new Map<string, string[]>();
  for (const category of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
    sorted.set(
      category,
      [...(groups.get(category) ?? [])].sort((a, b) => a.localeCompare(b))
    );
  }

  return sorted;
}

/**
 * Format a category key into a display label.
 * e.g., "member" -> "Member"
 */
function formatCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Checklist component for subscribing to event types.
 * Grouped by category with checkbox toggles.
 */
export function SubscriptionChecklist({
  eventTypes,
  subscribedTypes,
  onToggle,
  disabled = false,
}: SubscriptionChecklistProps): ReactNode {
  const groups = useMemo(() => groupByCategory(eventTypes), [eventTypes]);

  if (eventTypes.length === 0) {
    return (
      <div className="border-border rounded-lg border p-4 text-center">
        <p className="text-muted-foreground text-sm">No event types available.</p>
      </div>
    );
  }

  return (
    <div
      className="border-border focus-visible:ring-ring max-h-[280px] overflow-y-auto rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
      role="group"
      aria-label="Event type subscriptions"
      tabIndex={0}
    >
      {Array.from(groups.entries()).map(([category, types], groupIndex) => (
        <div key={category}>
          {/* Category header */}
          <div
            className={
              groupIndex > 0
                ? "border-border bg-muted/50 border-t px-3 py-2"
                : "bg-muted/50 px-3 py-2"
            }
          >
            <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              {formatCategoryLabel(category)}
            </h4>
          </div>

          {/* Event type items */}
          {types.map((eventType) => {
            const isSubscribed = subscribedTypes.includes(eventType);
            const checkboxId = `event-${eventType.replace(/\./g, "-")}`;

            return (
              <label
                key={eventType}
                htmlFor={checkboxId}
                className={cn(
                  "border-border flex items-center gap-3 border-t px-3 py-2.5 last:border-b-0",
                  disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50 cursor-pointer"
                )}
              >
                <Checkbox
                  id={checkboxId}
                  checked={isSubscribed}
                  onCheckedChange={(checked) => onToggle(eventType, checked === true)}
                  disabled={disabled}
                  aria-label={`Subscribe to ${eventType}`}
                />
                <span className="text-foreground font-mono text-sm">{eventType}</span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
