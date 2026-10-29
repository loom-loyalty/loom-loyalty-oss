import { useFormName, useGetFieldValue, useSetFieldValue } from "@openuidev/react-lang";
import { useId, useRef } from "react";
import { z } from "zod";

import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import { Label } from "../../../primitives/label";
import { defineOpenUIComponent, resolveIcon } from "../../types";

export const IndustrySelect = defineOpenUIComponent({
  name: "IndustrySelect",
  props: z.object({
    label: z.string().optional(),
    name: z.string(),
    options: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
        recommended: z.boolean().optional(),
      })
    ),
    required: z.boolean().optional(),
    helpText: z.string().optional(),
  }),
  description:
    "A labeled single-select radiogroup of large option cards with an icon, title, description, and optional 'Recommended' badge per option. Use for industry, template-family, or category selection where one choice is required. Contributes to the enclosing FormGroup's state via `name`; the selection is included when the FormGroup Submit fires. Supported icon names: shopping, store, building, utensils, sparkles, plane, dumbbell, cart, star, users, gift, target, tag, award, trending, settings, layers, zap, crown, heart.",
  component: ({ props }) => {
    const baseId = useId();
    const labelId = `${baseId}-label`;
    const helpId = `${baseId}-help`;
    const formName = useFormName();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const selectedId = getFieldValue(formName, props.name ?? "") as string | undefined;
    const options = props.options ?? [];
    const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const handleSelect = (optionId: string) => {
      setFieldValue(formName, "IndustrySelect", props.name ?? "", optionId, true);
    };

    // WAI-ARIA radiogroup pattern: roving tabIndex + arrow-key navigation.
    // The active (tabbable) radio is the selected one; if nothing is selected yet,
    // the first option is tabbable so keyboard users can enter the group.
    const selectedIndex = selectedId ? options.findIndex((o) => o.id === selectedId) : -1;
    const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      if (options.length === 0) return;
      let nextIndex: number | null = null;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          nextIndex = (currentIndex + 1) % options.length;
          break;
        case "ArrowUp":
        case "ArrowLeft":
          nextIndex = (currentIndex - 1 + options.length) % options.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = options.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      const next = options[nextIndex];
      if (!next) return;
      handleSelect(next.id);
      buttonRefs.current[nextIndex]?.focus();
    };

    return (
      <div className="space-y-1.5">
        {props.label && (
          <Label id={labelId}>
            {props.label}
            {props.required && (
              <span className="text-destructive ml-1" aria-hidden="true">
                *
              </span>
            )}
          </Label>
        )}
        <div
          role="radiogroup"
          aria-labelledby={props.label ? labelId : undefined}
          aria-label={props.label ? undefined : "Selection"}
          aria-describedby={props.helpText ? helpId : undefined}
          aria-required={props.required}
          className="space-y-2"
        >
          {options.map((option, index) => {
            const isSelected = selectedId === option.id;
            const isActive = index === activeIndex;
            const Icon = option.icon ? resolveIcon(option.icon) : null;
            return (
              <button
                key={option.id}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleSelect(option.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={cn(
                  "group flex w-full items-start gap-4 rounded-lg border px-5 py-4 text-left duration-150 ease-out",
                  "transition-[color,background-color,border-color,box-shadow] motion-reduce:transition-none",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  isSelected
                    ? "border-primary bg-primary/[0.04] shadow-hover"
                    : "border-border bg-card hover:border-primary/30 hover:shadow-hover shadow-sm"
                )}
              >
                {Icon && (
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors motion-reduce:transition-none",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary"
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-base font-semibold",
                        isSelected ? "text-primary-dark" : "text-foreground"
                      )}
                    >
                      {option.name}
                    </span>
                    {option.recommended && <Badge variant="success">Recommended</Badge>}
                  </div>
                  {option.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {option.description}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none",
                    isSelected ? "border-primary" : "border-muted-foreground/30"
                  )}
                  aria-hidden="true"
                >
                  {isSelected && <span className="bg-primary h-2.5 w-2.5 rounded-full" />}
                </span>
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">
              No options available
            </p>
          )}
        </div>
        {props.helpText && (
          <p id={helpId} className="text-muted-foreground text-xs">
            {props.helpText}
          </p>
        )}
      </div>
    );
  },
});
