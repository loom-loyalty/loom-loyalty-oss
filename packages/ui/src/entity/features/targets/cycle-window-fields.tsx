/**
 * CycleWindowFields - the counter target's cycle window (`cycleDurationPeriod`): how long
 * each cycle lasts, and in which IANA time zone a calendar cycle starts at midnight.
 *
 * Built for the once-per-local-day check-in cap: every 1 day, calendar, in the
 * store's zone, inside an active window (the target's `durationPeriod`) that the engine
 * splits into cycles. The zone picker lists real IANA zones only; it never offers the
 * `ORGANIZATION` placeholder, which the API resolves to UTC today.
 *
 * Whether a cycle window exists is the "Set cycle window" checkbox, never whether the
 * surrounding section is expanded, so collapsing the section can't delete it.
 */

import type {
  DurationPeriodValueDurationPeriod,
  DurationPeriodValueDurationPeriodType,
} from "@loom-loyalty/sdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import { Checkbox } from "../../../primitives/checkbox.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../primitives/command.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../primitives/popover.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import type { DurationPeriodValue } from "../../format-duration-period.js";
import type { CycleWindow, CycleWindowFieldsProps } from "./types.js";

const UNIT_OPTIONS: { value: DurationPeriodValueDurationPeriod; label: string }[] = [
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "MONTHS", label: "Months" },
  { value: "YEARS", label: "Years" },
];

const ALIGNMENT_OPTIONS: {
  value: DurationPeriodValueDurationPeriodType;
  label: string;
  description: string;
}[] = [
  {
    value: "CALENDAR",
    label: "Calendar",
    description: "Each cycle starts at midnight in the time zone below.",
  },
  {
    value: "SLIDING",
    label: "Sliding",
    description: "Cycles run back to back from the member's first activity.",
  },
];

/** The placeholder zone the API resolves to UTC. Never offered, never defaulted to. */
const ORGANIZATION_ZONE = "ORGANIZATION";

function isValidZone(zone: string): boolean {
  if (zone === ORGANIZATION_ZONE) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every IANA zone this runtime knows, sorted, with UTC included and ORGANIZATION never
 * present. `extra` adds a valid zone the list may lack, such as a legacy alias like
 * `Asia/Calcutta` that a browser reports as its own zone.
 */
export function listTimeZones(...extra: (string | undefined)[]): string[] {
  const supportedValuesOf = (
    Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] }
  ).supportedValuesOf;
  const zones = new Set(supportedValuesOf ? supportedValuesOf("timeZone") : []);
  zones.add("UTC");
  for (const zone of extra) {
    if (zone && isValidZone(zone)) zones.add(zone);
  }
  zones.delete(ORGANIZATION_ZONE);
  return [...zones].sort((a, b) => a.localeCompare(b));
}

/** The viewer's own zone, or UTC when the browser doesn't report a usable one. */
export function browserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidZone(zone) ? zone : "UTC";
  } catch {
    return "UTC";
  }
}

/** A new cycle window: every 1 day, calendar-aligned, in the viewer's zone. */
export function defaultCycleWindow(): CycleWindow {
  return {
    durationPeriod: "DAYS",
    durationPeriodValue: 1,
    durationPeriodType: "CALENDAR",
    timeZone: browserTimeZone(),
  };
}

/**
 * Whether these controls can edit the cycle window. Others (FIXED, INFINITE, FULL_CALENDAR,
 * set through the API) are shown read-only and saved back exactly as loaded.
 */
export function isEditableCycleWindow(value: CycleWindow): boolean {
  const type = value.durationPeriodType ?? "SLIDING";
  return (
    UNIT_OPTIONS.some((opt) => opt.value === value.durationPeriod) &&
    ALIGNMENT_OPTIONS.some((opt) => opt.value === type)
  );
}

/** The inline error for an incomplete cycle window, or undefined when it can be saved. */
export function cycleWindowError(value: CycleWindow | undefined): string | undefined {
  if (!value || !isEditableCycleWindow(value)) return undefined;
  const every = value.durationPeriodValue;
  if (every == null || !Number.isInteger(every) || every < 1) {
    return "Cycle length must be at least 1 (a whole number).";
  }
  if ((value.durationPeriodType ?? "SLIDING") === "CALENDAR" && !value.timeZone) {
    return "Choose a time zone for the cycle window.";
  }
  return undefined;
}

/**
 * The inline error for an incomplete active window (the target's `durationPeriod`), or
 * undefined when it can be saved. Mirrors what `DurationPeriodBuilder` marks as missing.
 */
export function activeWindowError(value: DurationPeriodValue | undefined): string | undefined {
  if (!value) return undefined;
  if (value.durationPeriodType === "FIXED") {
    return value.fixedDurationDateTimePeriod?.startDateTime
      ? undefined
      : "Choose a start date for the active window.";
  }
  if (value.durationPeriod === "INFINITE") return undefined;
  const length = value.durationPeriodValue;
  if (!value.durationPeriod || length == null || !Number.isInteger(length) || length < 1) {
    return "Active window length must be at least 1 (a whole number).";
  }
  return undefined;
}

export function CycleWindowFields({
  value,
  onChange,
  hasActiveWindow = true,
  disabled = false,
}: CycleWindowFieldsProps): ReactNode {
  const enabled = !!value;
  const editable = !value || isEditableCycleWindow(value);

  return (
    <div className="space-y-4" data-section="cycle-window">
      {/* The whole row is the label, so the 44px hit area toggles the checkbox. */}
      <Label
        htmlFor="cycle-window-enabled"
        className="flex min-h-11 cursor-pointer items-start gap-3 py-1 font-normal"
      >
        <Checkbox
          id="cycle-window-enabled"
          className="mt-0.5"
          checked={enabled}
          onCheckedChange={(checked) =>
            onChange(checked === true ? (value ?? defaultCycleWindow()) : undefined)
          }
          disabled={disabled}
          aria-labelledby="cycle-window-enabled-label"
          aria-describedby="cycle-window-enabled-desc"
        />
        <span className="block">
          <span id="cycle-window-enabled-label" className="block text-sm">
            Set cycle window
          </span>
          <span
            id="cycle-window-enabled-desc"
            className="text-muted-foreground mt-0.5 block text-xs"
          >
            How long each cycle lasts. For a once-a-day limit, use a 1-day calendar cycle in the
            store&apos;s time zone.
          </span>
        </span>
      </Label>

      {value && !hasActiveWindow && (
        <p className="text-muted-foreground text-xs" role="note">
          Set an active window above too. Without one there is a single cycle, and it never ends.
        </p>
      )}
      {value && editable && (
        <EditableCycleWindow value={value} onChange={onChange} disabled={disabled} />
      )}
      {value && !editable && (
        <p className="text-muted-foreground text-sm" data-testid="cycle-window-readonly">
          This cycle window ({value.durationPeriodType ?? "SLIDING"} {value.durationPeriod}) was set
          outside Hub. It is kept as is when you save.
        </p>
      )}
    </div>
  );
}

function EditableCycleWindow({
  value,
  onChange,
  disabled,
}: {
  value: CycleWindow;
  onChange: (value: CycleWindow) => void;
  disabled: boolean;
}): ReactNode {
  const [zoneOpen, setZoneOpen] = useState(false);
  const zones = useMemo(() => listTimeZones(value.timeZone), [value.timeZone]);
  const alignmentType = value.durationPeriodType ?? "SLIDING";
  const alignment = ALIGNMENT_OPTIONS.find((opt) => opt.value === alignmentType);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cycle-window-every">Cycle length</Label>
          <Input
            id="cycle-window-every"
            type="number"
            inputMode="numeric"
            step={1}
            className="min-h-11"
            data-widget="text-input"
            // No `min`: native constraint validation would block the submit silently in some
            // browsers before the form's inline error can explain it.
            value={value.durationPeriodValue ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                durationPeriodValue: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cycle-window-unit">Unit</Label>
          <Select
            value={value.durationPeriod ?? ""}
            onValueChange={(unit) =>
              onChange({ ...value, durationPeriod: unit as DurationPeriodValueDurationPeriod })
            }
            disabled={disabled}
          >
            <SelectTrigger id="cycle-window-unit" className="min-h-11">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cycle-window-alignment">Alignment</Label>
        <Select
          value={alignmentType}
          onValueChange={(type) =>
            onChange({
              ...value,
              durationPeriodType: type as DurationPeriodValueDurationPeriodType,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger
            id="cycle-window-alignment"
            className="min-h-11"
            aria-describedby="cycle-window-alignment-desc"
          >
            <SelectValue placeholder="Select alignment" />
          </SelectTrigger>
          <SelectContent>
            {ALIGNMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id="cycle-window-alignment-desc" className="text-muted-foreground text-xs">
          {alignment?.description}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cycle-window-time-zone">Time zone</Label>
        <Popover open={zoneOpen} onOpenChange={setZoneOpen}>
          <PopoverTrigger asChild>
            <Button
              id="cycle-window-time-zone"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={zoneOpen}
              className="min-h-11 w-full justify-between font-normal"
              disabled={disabled}
            >
              <span className={cn(!value.timeZone && "text-muted-foreground")}>
                {value.timeZone || "Select time zone"}
              </span>
              <ChevronsUpDown className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search time zones..." />
              <CommandList>
                <CommandEmpty>No time zone found.</CommandEmpty>
                <CommandGroup>
                  {zones.map((zone) => (
                    <CommandItem
                      key={zone}
                      value={zone}
                      onSelect={() => {
                        onChange({ ...value, timeZone: zone });
                        setZoneOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value.timeZone === zone ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden
                      />
                      {zone}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value.timeZone === ORGANIZATION_ZONE && (
          <p className="text-muted-foreground text-xs">
            This cycle window uses the organization placeholder, which is UTC. Pick the store&apos;s
            zone so each cycle starts at its local midnight.
          </p>
        )}
      </div>
    </div>
  );
}
