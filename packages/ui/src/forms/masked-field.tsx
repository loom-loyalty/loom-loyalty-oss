"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";

const HIDDEN_VALUE = "•".repeat(12);

export interface MaskedFieldProps {
  children: ReactNode;
  /** Context for the reveal control's accessible label. */
  reason?: string;
  /** Opaque future audit-log integration key. */
  auditKey?: string;
  /** Runs once for each hidden-to-revealed transition. */
  onReveal?: (auditKey?: string) => void;
  className?: string;
}

/**
 * Displays a sensitive value behind a fixed-length mask until the user reveals it.
 */
export function MaskedField({
  children,
  reason,
  auditKey,
  onReveal,
  className,
}: MaskedFieldProps): ReactNode {
  const [revealed, setRevealed] = useState(false);
  const label = reason ?? "value";

  const handleToggle = () => {
    if (!revealed) {
      onReveal?.(auditKey);
    }
    setRevealed((current) => !current);
  };

  return (
    <span
      data-widget="masked-field"
      data-sensitive="true"
      className={cn("inline-flex max-w-full min-w-0 items-start", className)}
    >
      {revealed ? (
        <span className="min-w-0 flex-1 truncate">{children}</span>
      ) : (
        <span
          className="text-foreground min-w-0 flex-1 truncate font-mono text-sm select-none"
          aria-label={`${label} (hidden)`}
        >
          {HIDDEN_VALUE}
        </span>
      )}
      <span className="ml-2 flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleToggle}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </span>
    </span>
  );
}
