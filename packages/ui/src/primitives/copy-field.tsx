"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { useCallback, useState } from "react";

import { cn } from "../lib/utils";
import { Label } from "./label";

export interface CopyFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The value to display and copy */
  value: string;
  /** Label shown above the field */
  label?: string;
  /** Whether to show the copy button (default: true) */
  showCopy?: boolean;
  /** Callback when copy is successful */
  onCopy?: () => void;
  /** Callback when copy fails */
  onCopyError?: (error: Error) => void;
  /** Mask the value for sensitive data (shows first 8 and last 4 chars) */
  masked?: boolean;
  /** Show "Copied" confirmation text below the field */
  showCopiedText?: boolean;
}

function maskValue(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}••••${value.slice(-4)}`;
}

function CopyField({
  value,
  label,
  showCopy = true,
  onCopy,
  onCopyError,
  masked = false,
  showCopiedText = true,
  className,
  ...props
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to copy");
      onCopyError?.(error);
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to copy:", err);
      }
    }
  }, [value, onCopy, onCopyError]);

  const displayValue = masked ? maskValue(value) : value;

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {label && <Label>{label}</Label>}
      {/* Input's height, radius, border and shadow; long values wrap past one line. */}
      <div className="border-input-border bg-muted relative flex min-h-9 items-center rounded-md border shadow-xs">
        <div className="min-w-0 flex-1 px-3 py-1.5 pr-10 text-sm leading-5">
          <code className="text-foreground font-mono break-all">{displayValue}</code>
        </div>
        {showCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              // The drawn button fits the 36px field; the pseudo-element keeps a 44px hit area.
              "absolute top-1/2 right-1 -translate-y-1/2 rounded-sm p-1.5 transition-colors",
              "before:absolute before:-inset-2 before:content-['']",
              "hover:bg-background/50 focus:ring-ring focus:ring-2 focus:outline-none",
              copied ? "text-success-dark" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={copied ? "Copied" : "Copy to clipboard"}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </div>
      {showCopiedText && copied && (
        <p className="text-success-dark text-xs" role="status" aria-live="polite">
          Copied to clipboard
        </p>
      )}
    </div>
  );
}

export { CopyField };
