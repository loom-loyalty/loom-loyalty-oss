/**
 * StartFromModeGrid
 *
 * The builder's START FROM control: four equally-sized, equally-weighted
 * single-line options in a 2x2 grid, with the active mode's explanation as one
 * caption below the grid rather than per-option copy.
 *
 * Radix RadioGroup semantics: one tab stop for the group, arrow keys move
 * between options. Each tile is a `Label` whose `htmlFor` targets the
 * `RadioGroupItem` button, so clicking anywhere in the tile selects it.
 */

import { FileJson, Rows3, Sparkles, Upload, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../../lib/utils.js";
import { Label } from "../../../../primitives/label.js";
import { RadioGroup, RadioGroupItem } from "../../../../primitives/radio-group.js";
import type { BuilderMode, StartFromModeGridProps } from "./types.js";

interface ModeDefinition {
  value: BuilderMode;
  label: string;
  caption: string;
  icon: LucideIcon;
}

export const BUILDER_MODES: readonly ModeDefinition[] = [
  {
    value: "describe",
    label: "Describe it",
    caption: "Say what the event contains in plain language and we'll draft the fields.",
    // Sparkles is the app-wide AI signal (see AskAiAssistant, TransformAiBuilder).
    icon: Sparkles,
  },
  {
    value: "paste-schema",
    label: "Paste schema",
    caption: "Paste a JSON Schema or a sample payload body and we'll read the fields from it.",
    icon: FileJson,
  },
  {
    value: "field-by-field",
    label: "Field by field",
    caption: "Declare each field yourself in the table on the right.",
    icon: Rows3,
  },
  {
    value: "sample",
    label: "Sample",
    caption: "Load a CSV of your data, or start from the Stripe sample.",
    icon: Upload,
  },
] as const;

export function StartFromModeGrid({
  value,
  onValueChange,
  disabled = false,
  className,
}: StartFromModeGridProps): ReactNode {
  const activeCaption = BUILDER_MODES.find((mode) => mode.value === value)?.caption;

  return (
    <div className={cn("space-y-2", className)}>
      <RadioGroup
        value={value}
        onValueChange={(next) => onValueChange(next as BuilderMode)}
        aria-label="Start from"
        className="grid-cols-2"
      >
        {BUILDER_MODES.map((mode) => {
          const selected = mode.value === value;
          const Icon = mode.icon;
          return (
            <Label
              key={mode.value}
              htmlFor={`builder-mode-${mode.value}`}
              className={cn(
                "flex h-[34px] items-center gap-1.5 rounded-md border px-2 text-sm transition-colors",
                selected
                  ? "border-primary bg-primary/10 text-foreground border-[1.5px] font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              )}
            >
              <RadioGroupItem
                id={`builder-mode-${mode.value}`}
                value={mode.value}
                disabled={disabled}
                className="h-3.5 w-3.5 shrink-0"
              />
              <Icon
                className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "text-current")}
                aria-hidden="true"
              />
              <span className="truncate">{mode.label}</span>
            </Label>
          );
        })}
      </RadioGroup>
      {activeCaption ? <p className="text-muted-foreground text-xs">{activeCaption}</p> : null}
    </div>
  );
}
