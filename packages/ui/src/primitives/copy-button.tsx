"use client";

/**
 * CopyButton - copies a value to the clipboard and announces success politely.
 *
 * Used wherever a credential or URL needs a one-click copy (webhook secrets,
 * ingest URLs, verification snippets).
 */

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./button.js";

export interface CopyButtonProps {
  /** Text written to the clipboard. */
  value: string;
  /** Accessible label describing what is copied, e.g. "Copy signing secret". */
  label: string;
  size?: "sm" | "icon-sm";
  variant?: "ghost" | "outline";
  /** Show a "Copy" / "Copied" text label next to the icon. */
  withText?: boolean;
  className?: string;
}

/** Icon button that copies `value` and announces success to assistive tech. */
export function CopyButton({
  value,
  label,
  size = "icon-sm",
  variant = "ghost",
  withText = false,
  className,
}: CopyButtonProps): ReactNode {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setMessage("Copied to clipboard");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        setMessage("");
      }, 2000);
    } catch {
      setMessage("Copy failed — copy manually");
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleCopy}
        aria-label={copied ? "Copied" : label}
        className={className}
      >
        <Icon className={copied ? "text-success-dark h-4 w-4" : "h-4 w-4"} aria-hidden="true" />
        {withText && <span>{copied ? "Copied" : "Copy"}</span>}
      </Button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </span>
    </>
  );
}
