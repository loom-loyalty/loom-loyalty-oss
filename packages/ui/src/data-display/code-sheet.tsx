"use client";

import { Check, Copy, Play, X } from "lucide-react";
import * as React from "react";

import { LiveRegion } from "../a11y";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "../primitives/sheet";

/** Duration in ms to show "Copied" feedback before reverting */
const COPY_FEEDBACK_DURATION = 2000;

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface CodeExample {
  /** Language identifier (e.g., "curl", "javascript", "python") */
  language: string;
  /** Display label for the tab */
  label: string;
  /** The code content */
  code: string;
}

export interface CodeSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** HTTP method for the endpoint */
  method: HttpMethod;
  /** Title/operation name */
  title: string;
  /** API endpoint path */
  endpoint: string;
  /** Code examples for different languages */
  examples: CodeExample[];
  /** Currently selected language */
  activeLanguage: string;
  /** Callback when language changes */
  onLanguageChange: (language: string) => void;
  /** Optional response preview (JSON string or object) */
  responsePreview?: string | object;
  /** Callback when copy button is clicked */
  onCopy?: () => void;
  /** Callback when clipboard copy fails (e.g., insecure context, browser restriction) */
  onCopyError?: (error: Error) => void;
  /** Callback when try button is clicked */
  onTry?: () => void;
  /** Whether to show the try button */
  showTryButton?: boolean;
  /** Additional className for the content */
  className?: string;
}

const methodStyles: Record<HttpMethod, string> = {
  GET: "bg-success text-white",
  POST: "bg-primary text-white",
  PUT: "bg-accent text-white",
  DELETE: "bg-destructive text-white",
  PATCH: "bg-secondary text-white",
};

/**
 * CodeSheet component for displaying API code examples in an expandable right-side sheet.
 * Features:
 * - Sticky header with method badge, title, and language tabs
 * - Scrollable body with request code and response preview
 * - Sticky footer with copy and try buttons
 * - Full ARIA support for accessibility
 *
 * @example
 * <CodeSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   method="GET"
 *   title="List Members"
 *   endpoint="/api/v1/members"
 *   examples={[
 *     { language: "curl", label: "cURL", code: "curl -X GET ..." },
 *     { language: "javascript", label: "JavaScript", code: "fetch('/api/v1/members')..." },
 *   ]}
 *   activeLanguage={activeLanguage}
 *   onLanguageChange={setActiveLanguage}
 *   responsePreview={{ members: [] }}
 * />
 */
export function CodeSheet({
  open,
  onOpenChange,
  method,
  title,
  endpoint,
  examples,
  activeLanguage,
  onLanguageChange,
  responsePreview,
  onCopy,
  onCopyError,
  onTry,
  showTryButton = true,
  className,
}: CodeSheetProps) {
  const [copied, setCopied] = React.useState(false);

  const activeExample = React.useMemo(
    () => examples.find((ex) => ex.language === activeLanguage),
    [examples, activeLanguage]
  );

  const handleCopy = async () => {
    if (!activeExample?.code) return;
    try {
      await navigator.clipboard.writeText(activeExample.code);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
      onCopy?.();
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      onCopyError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const tabCount = examples.length;
    let newIndex = currentIndex;

    switch (e.key) {
      case "ArrowRight":
        newIndex = (currentIndex + 1) % tabCount;
        break;
      case "ArrowLeft":
        newIndex = (currentIndex - 1 + tabCount) % tabCount;
        break;
      case "Home":
        newIndex = 0;
        break;
      case "End":
        newIndex = tabCount - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const targetTab = examples[newIndex];
    if (targetTab) {
      onLanguageChange(targetTab.language);
    }
  };

  const formattedResponse =
    typeof responsePreview === "object"
      ? JSON.stringify(responsePreview, null, 2)
      : responsePreview;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton
        className={cn(
          "from-primary-dark to-primary-darker w-full border-l-0 bg-gradient-to-b sm:max-w-lg lg:max-w-xl",
          className
        )}
      >
        {/* Sticky Header */}
        <SheetHeader className="border-b border-white/10 px-6 py-4">
          {/* Close Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Method Badge */}
              <span
                className={cn(
                  "rounded px-2 py-1 text-xs font-bold tracking-wider uppercase",
                  methodStyles[method]
                )}
                role="img"
                aria-label={`${method} request`}
              >
                {method}
              </span>
              {/* Title */}
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close code panel"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Endpoint */}
          <p className="font-mono text-sm text-white/60">{endpoint}</p>

          {/* Language Tabs */}
          {examples.length > 1 && (
            <div
              role="tablist"
              aria-label="Code language selection"
              className="mt-4 flex gap-1 overflow-x-auto"
            >
              {examples.map((example, index) => {
                const isActive = example.language === activeLanguage;
                return (
                  <button
                    key={example.language}
                    id={`code-tab-${example.language}`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`code-panel-${example.language}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => onLanguageChange(example.language)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-white/50 hover:bg-white/10 hover:text-white/80"
                    )}
                  >
                    {example.label}
                  </button>
                );
              })}
            </div>
          )}
        </SheetHeader>

        {/* Scrollable Body */}
        <SheetBody className="p-6">
          {/* Request Code Block */}
          <div className="mb-6">
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">
              Request
            </h3>
            <div
              id={`code-panel-${activeLanguage}`}
              role="tabpanel"
              aria-labelledby={`code-tab-${activeLanguage}`}
              className="overflow-x-auto rounded-lg bg-black/30 p-4"
            >
              <pre className="font-mono text-sm text-white/90">
                <code>{activeExample?.code || "// No code example available"}</code>
              </pre>
            </div>
          </div>

          {/* Response Preview */}
          {formattedResponse && (
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">
                Response
              </h3>
              <div className="overflow-x-auto rounded-lg bg-black/30 p-4">
                <pre className="text-success/90 font-mono text-sm">
                  <code>{formattedResponse}</code>
                </pre>
              </div>
            </div>
          )}
        </SheetBody>

        {/* Sticky Footer */}
        <SheetFooter className="flex-row justify-end gap-2 border-t border-white/10 px-6 py-4">
          {/* Announce copy state changes to screen readers */}
          <LiveRegion message={copied ? "Code copied to clipboard" : ""} politeness="polite" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy
              </>
            )}
          </Button>
          {showTryButton && (
            <Button
              variant="default"
              size="sm"
              onClick={onTry}
              className="bg-accent hover:bg-accent-dark text-white"
            >
              <Play className="mr-2 h-4 w-4" aria-hidden="true" />
              Try it
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
