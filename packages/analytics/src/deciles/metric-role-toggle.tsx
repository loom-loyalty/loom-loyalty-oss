import { cn } from "@loom-loyalty/ui";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

interface MetricRoleToggleProps {
  value: "REVENUE" | "COST" | "MARGIN";
  onChange: (next: "REVENUE" | "COST" | "MARGIN") => void;
}

const OPTIONS = ["REVENUE", "COST", "MARGIN"] as const;
type Option = (typeof OPTIONS)[number];

/**
 * WAI-ARIA radiogroup with arrow-key navigation per APG. Selection follows
 * focus: ArrowRight/Down advances, ArrowLeft/Up regresses, Home/End jump
 * to ends. Roving tabindex keeps the listbox a single tab stop.
 */
export function MetricRoleToggle({ value, onChange }: MetricRoleToggleProps): ReactNode {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIdx = OPTIONS.indexOf(value);

  // Move DOM focus to the active option when selection changes via keyboard.
  useEffect(() => {
    const el = buttonRefs.current[activeIdx];
    if (el && el !== document.activeElement) {
      const movedFromPeer = buttonRefs.current.some((peer) => peer === document.activeElement);
      if (movedFromPeer) el.focus();
    }
  }, [activeIdx]);

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number): void {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIdx = (idx + 1) % OPTIONS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIdx = (idx - 1 + OPTIONS.length) % OPTIONS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = OPTIONS.length - 1;
    }
    if (nextIdx === null) return;
    e.preventDefault();
    onChange(OPTIONS[nextIdx] as Option);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Metric type"
      className="border-border bg-background inline-flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {OPTIONS.map((opt, i) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium",
              "focus-visible:ring-primary focus:outline-none focus-visible:ring-2",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {opt.charAt(0) + opt.slice(1).toLowerCase()}
          </button>
        );
      })}
    </div>
  );
}
