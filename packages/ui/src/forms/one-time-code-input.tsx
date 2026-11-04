import * as React from "react";

import { cn } from "../lib/utils";

export interface OneTimeCodeInputProps {
  /** The digits entered so far, at most `length` of them. */
  value: string;
  onChange: (value: string) => void;
  /** How many digits the code has. */
  length?: number;
  /** Prefix for each box's id; the first box gets `${id}` itself. */
  id?: string;
  /** Names the group for screen readers, for example "Code"; or use `aria-labelledby`. */
  label?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * A one-time code entered as one box per digit. Typing moves to the next box, Backspace moves
 * back, and a pasted or autofilled code fills every box from the first, whichever box had focus.
 */
export function OneTimeCodeInput({
  value,
  onChange,
  length = 6,
  id,
  label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  invalid,
  disabled,
  autoFocus,
  className,
}: OneTimeCodeInputProps) {
  const reactId = React.useId();
  const baseId = id ?? `otp-${reactId}`;
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  function focus(index: number) {
    const input = inputs.current[Math.max(0, Math.min(index, length - 1))];
    input?.focus();
    input?.select();
  }

  function setDigits(next: string[]) {
    // Keep the code contiguous: a box cleared mid-code drops the digits after it.
    const firstEmpty = next.findIndex((digit) => !digit);
    onChange((firstEmpty === -1 ? next : next.slice(0, firstEmpty)).join(""));
  }

  function fill(from: number, entered: string) {
    const next = [...digits];
    const chars = entered.slice(0, length - from).split("");
    chars.forEach((digit, offset) => {
      next[from + offset] = digit;
    });
    setDigits(next);
    focus(from + chars.length);
  }

  function handleChange(index: number, raw: string) {
    const entered = raw.replace(/\D/g, "");
    if (!entered) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    // A whole code (paste or autofill) fills from the first box; a keystroke replaces this box.
    if (entered.length >= length) {
      fill(0, entered);
      return;
    }
    // Typing into a filled box arrives as old digit + new digit; keep the new one.
    const typed = entered.length === 2 && entered[0] === digits[index] ? entered.slice(1) : entered;
    // A box after the code's end can't hold a digit, or the code would have a gap.
    fill(Math.min(index, value.length), typed);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) {
      event.preventDefault();
      return;
    }
    if (pasted.length < 2) return;
    event.preventDefault();
    fill(0, pasted);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      focus(index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focus(index + 1);
    }
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-slot="one-time-code-input"
      className={cn("flex gap-1.5 sm:gap-2", className)}
      // On a phone six boxes can be narrower than a 44px touch target, so a tap anywhere on the
      // row (gaps included) lands on the next box to fill.
      onPointerDown={(event) => {
        if (disabled || event.target !== event.currentTarget) return;
        event.preventDefault();
        focus(Math.min(value.length, length - 1));
      }}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          id={index === 0 ? baseId : `${baseId}-${index + 1}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          className={cn(
            "border-input-border bg-input h-12 w-full min-w-0 rounded-md border text-center text-xl font-semibold tabular-nums shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 aria-invalid:border-destructive"
          )}
        />
      ))}
    </div>
  );
}
