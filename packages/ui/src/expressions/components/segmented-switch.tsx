import { useRef, type KeyboardEvent } from "react";
import { cn } from "../../lib/utils.js";

export interface SegmentedSwitchOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedSwitchProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedSwitchOption<T>[];
  disabled?: boolean;
  ariaLabel: string;
}

export function SegmentedSwitch<T extends string>({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
}: SegmentedSwitchProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  // WAI-ARIA radiogroup pattern: roving tabIndex + arrow-key navigation —
  // mirrors the existing `industry-select.tsx` implementation of the same
  // pattern (adversarial review finding: this control previously left every
  // segment independently tabbable with no arrow-key support).
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    if (disabled || options.length === 0) return;
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % options.length;
        break;
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
    event.preventDefault();
    const next = options[nextIndex];
    if (!next) return;
    onChange(next.value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="border-input-border bg-card inline-flex overflow-hidden rounded-md border"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === activeIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-h-11 px-2.5 text-xs font-medium transition-colors sm:min-h-8",
              index > 0 && "border-input-border border-l",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
              "focus-visible:ring-primary focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
