/**
 * ActivityPicker: searchable, grouped command list of activities a care agent
 * may record.
 *
 * Composes the existing command and popover primitives rather than adding a
 * dependency. Entries are grouped by the activity's domain so the list reads the
 * way operators think, and sorted by name within each group.
 *
 * A suggestion, when present, is shown in its own group above the rest and is
 * never pre-applied. Selection stays an explicit act, so nothing is ever
 * recorded that the agent did not see selected.
 */

"use client";

import { isCareOfferableActivity } from "@loom-loyalty/core";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "../../../../lib/utils.js";
import { Button } from "../../../../primitives/button.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../primitives/command.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../primitives/popover.js";
import type { CareActivityOption } from "./types.js";

export interface ActivityPickerProps {
  /** Activities offered on this surface, before eligibility filtering. */
  activities: CareActivityOption[];
  /** The currently selected activity's code, or null when nothing is selected. */
  selectedCode: string | null;
  /** Called with the chosen activity's code. */
  onSelect: (code: string) => void;
  /**
   * A proposed activity's code. Presented first, in its own group, and never
   * applied without selection.
   */
  suggestedCode?: string | null;
  /**
   * Hard-disables the trigger. Reserve this for a genuine "must not interact"
   * state: do NOT pass a loading flag. A disabled trigger cannot be opened,
   * cannot explain itself, and if the query behind the flag stalls the surface
   * is bricked with no feedback. Use `loading` instead, which keeps the list
   * openable and says what is happening inside it.
   */
  disabled?: boolean;
  /** The offered list is still being fetched. The trigger stays operable. */
  loading?: boolean;
  /** Accessible label for the trigger. */
  label?: string;
  id?: string;
}

const UNGROUPED_HEADING = "Other activities";
const SUGGESTED_HEADING = "Best match for what you described";

/**
 * Heading an activity sits under. Falls back to the activity's domain, the
 * segment before the first dot in its code, which is a grouping key, not
 * operator-facing copy: it is title-cased into a plain word before display.
 */
function headingFor(activity: CareActivityOption): string {
  if (activity.group) return activity.group;
  const [domain] = activity.code.split(".");
  if (!domain) return UNGROUPED_HEADING;
  const spaced = domain.replace(/[-_]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function ActivityPicker({
  activities,
  selectedCode,
  onSelect,
  suggestedCode,
  disabled = false,
  loading = false,
  label = "Activity",
  id,
}: ActivityPickerProps): ReactNode {
  const [open, setOpen] = useState(false);

  // The eligibility policy is applied here rather than upstream so a registry
  // row for an activity the engine announces about itself cannot reach the
  // list, however it got registered.
  const offerable = useMemo(
    () => activities.filter((activity) => isCareOfferableActivity(activity.code)),
    [activities]
  );

  const suggested = useMemo(
    () => (suggestedCode ? offerable.find((a) => a.code === suggestedCode) : undefined),
    [offerable, suggestedCode]
  );

  const groups = useMemo(() => {
    const rest = offerable.filter((activity) => activity.code !== suggested?.code);
    const byHeading = new Map<string, CareActivityOption[]>();
    for (const activity of rest) {
      const heading = headingFor(activity);
      const bucket = byHeading.get(heading);
      if (bucket) bucket.push(activity);
      else byHeading.set(heading, [activity]);
    }
    return [...byHeading.entries()]
      .map(([heading, items]) => ({
        heading,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.heading.localeCompare(b.heading));
  }, [offerable, suggested]);

  const selected = offerable.find((activity) => activity.code === selectedCode);

  const handleSelect = (code: string) => {
    onSelect(code);
    setOpen(false);
  };

  const renderItem = (activity: CareActivityOption) => (
    <CommandItem
      key={activity.code}
      // cmdk matches on `value`; the name is what an agent searches by.
      value={activity.name}
      onSelect={() => handleSelect(activity.code)}
      className="min-h-11 items-start gap-2"
    >
      <Check
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          activity.code === selectedCode ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm">{activity.name}</span>
        {activity.description && (
          <span className="text-muted-foreground text-xs">{activity.description}</span>
        )}
      </span>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
          className="min-h-11 w-full justify-between font-normal"
        >
          {/* Once chosen, the trigger collapses to the activity's plain name. */}
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.name : loading ? "Loading activities…" : "Choose what happened…"}
          </span>
          <ChevronsUpDown aria-hidden="true" className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search activities…" />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading activities…" : "No activity matches that search."}
            </CommandEmpty>
            {suggested && (
              <CommandGroup heading={SUGGESTED_HEADING}>{renderItem(suggested)}</CommandGroup>
            )}
            {groups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map(renderItem)}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
