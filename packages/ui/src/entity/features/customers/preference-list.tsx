/**
 * PreferenceList — Displays customer preferences grouped by category
 *
 * Groups preferences by category and shows key/value pairs under each group.
 * Supports add/edit/delete actions when editing is enabled.
 */

"use client";

import { Globe, Lock, Mail, Pencil, Plus, Settings, Shield, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { formatShortDate } from "@loom-loyalty/core";
import { EmptyState } from "../../../data-display/empty-state.js";
import { StatusBadge } from "../../../data-display/status-badge.js";
import { Button } from "../../../primitives/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../../primitives/card.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { CustomerPreference } from "./types.js";

export interface PreferenceListProps {
  /** List of customer preferences */
  preferences: CustomerPreference[];
  /** Handler for adding a new preference */
  onAdd?: () => void;
  /** Handler for editing a preference */
  onEdit?: (preference: CustomerPreference) => void;
  /** Handler for deleting a preference */
  onDelete?: (preferenceId: string) => void;
  /** Whether editing actions are enabled */
  canEdit?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
}

/** Map of well-known category names to icons */
const CATEGORY_ICONS: Record<string, typeof Shield> = {
  communication: Mail,
  privacy: Lock,
  marketing: Globe,
};

/**
 * Renders customer preferences grouped by category with actions.
 */
export function PreferenceList({
  preferences,
  onAdd,
  onEdit,
  onDelete,
  canEdit = false,
  isLoading = false,
}: PreferenceListProps): ReactNode {
  const grouped = useMemo(() => {
    const map = new Map<string, CustomerPreference[]>();
    for (const pref of preferences) {
      const existing = map.get(pref.category) ?? [];
      existing.push(pref);
      map.set(pref.category, existing);
    }
    return map;
  }, [preferences]);

  if (isLoading) {
    return (
      <section aria-label="Preferences" className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">Preferences</h4>
        </div>
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Preferences" className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-foreground text-sm font-medium">Preferences</h4>
        {canEdit && onAdd && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdd}
            aria-label="Add preference"
            className="h-7 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </Button>
        )}
      </div>

      {preferences.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="No preferences set"
          description="Customer preference data will appear here once configured."
          className="py-6"
        />
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([category, prefs]) => {
            const CategoryIcon = CATEGORY_ICONS[category.toLowerCase()] ?? Shield;

            return (
              <Card key={category} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm capitalize">
                    <CategoryIcon className="text-primary h-4 w-4" aria-hidden="true" />
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2" role="list">
                    {prefs.map((pref) => (
                      <li
                        key={pref.preferenceId}
                        className="bg-background border-border flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground text-sm">{pref.typeName}</p>
                          <time
                            dateTime={pref.updatedDateTime}
                            className="text-muted-foreground text-xs"
                          >
                            Updated {formatShortDate(pref.updatedDateTime)}
                          </time>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-foreground text-sm font-medium">
                            {pref.valueName}
                          </span>
                          <StatusBadge status={pref.status} />
                          {canEdit && (
                            <div className="ml-1 flex items-center gap-0.5">
                              {onEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEdit(pref)}
                                  aria-label={`Edit ${pref.typeName} preference`}
                                  className="h-7 min-h-11 w-7 min-w-11 p-0"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDelete(pref.preferenceId)}
                                  aria-label={`Delete ${pref.typeName} preference`}
                                  className="text-destructive hover:text-destructive h-7 min-h-11 w-7 min-w-11 p-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
