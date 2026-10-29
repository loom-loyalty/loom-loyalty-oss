/**
 * JsonPath Input
 *
 * Displays JSON paths in a friendly breadcrumb format by default.
 * Users can toggle to manual mode for raw path editing.
 * When rendered inside an ExpressionContextProvider with eventTypeCode and
 * fetchDataModel, shows a Browse button that opens a schema tree browser.
 *
 * `presentation="sentence"` (set only by the sentence-mode field pill, R6a)
 * swaps the breadcrumb/pencil/`JsonPathBrowser` trio for the redesigned
 * `PropertyPicker` (R7/R9), which folds the manual "Edit path" escape hatch
 * into its own footer. `presentation="card"` (the default) is unchanged so
 * every existing non-modal consumer keeps today's behavior.
 */

import { ChevronRight, Pencil } from "lucide-react";
import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "../../primitives/button.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { isRootPathMode, useExpressionContext } from "../expression-context.js";
import type { ExpressionPresentation } from "../types.js";
import { JsonPathBrowser } from "./json-path-browser.js";
import { ROOT_LABELS } from "./json-path-root-labels.js";
import { PropertyPicker } from "./property-picker.js";

export interface JsonPathInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** @default "card" */
  presentation?: ExpressionPresentation;
}

/** Root section labels for breadcrumb display */
/**
 * Convert a JSON path like "$.eventData.items[*].totalAmount" to breadcrumb segments.
 *
 * Returns an array of { label, isArray } objects:
 *   [ { label: "Event Data" }, { label: "Items", isArray: true }, { label: "Total Amount" } ]
 */
export function pathToBreadcrumbs(path: string): Array<{ label: string; isArray: boolean }> | null {
  if (!path || !path.startsWith("$.")) return null;

  // Strip leading "$."
  const rest = path.slice(2);
  if (!rest) return null;
  const rawSegments = rest.split(".");

  const breadcrumbs: Array<{ label: string; isArray: boolean }> = [];

  for (let i = 0; i < rawSegments.length; i++) {
    const segment = rawSegments[i]!;
    const isArray = /\[.*?\]$/.test(segment);
    const cleanSegment = segment.replace(/\[.*?\]$/, "");

    // First segment: use root label if available
    const rootLabel = ROOT_LABELS[cleanSegment as keyof typeof ROOT_LABELS];
    if (i === 0 && rootLabel) {
      breadcrumbs.push({ label: rootLabel, isArray });
      continue;
    }

    // Convert camelCase/snake_case to Title Case
    const label = cleanSegment
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    breadcrumbs.push({ label, isArray });
  }

  return breadcrumbs.length > 0 ? breadcrumbs : null;
}

export function JsonPathInput({
  value,
  onChange,
  label = "JsonPath",
  disabled,
  placeholder: placeholderProp,
  className,
  presentation = "card",
}: JsonPathInputProps): ReactNode {
  const [error, setError] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const { dataModelCode, eventTypeCode, fetchDataModel, mode } = useExpressionContext();
  const resolvedCode = dataModelCode ?? eventTypeCode;
  const hasBrowser = Boolean(resolvedCode && fetchDataModel);
  const placeholder =
    placeholderProp ?? (isRootPathMode(mode) ? "$.fieldName" : "$.eventData.fieldName");
  const inputId = useId();

  const breadcrumbs = useMemo(() => pathToBreadcrumbs(value), [value]);
  const showBreadcrumb = !isManualMode && breadcrumbs && !disabled;

  const handleBlur = useCallback(() => {
    if (value && !value.startsWith("$.")) {
      setError("Path must start with $.");
    } else {
      setError(null);
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      if (error) setError(null);
    },
    [onChange, error]
  );

  const handleBrowserSelect = useCallback(
    (path: string) => {
      onChange(path);
      setError(null);
      // Switch back to breadcrumb mode after selecting from browser
      setIsManualMode(false);
    },
    [onChange]
  );

  const toggleMode = useCallback(() => {
    setIsManualMode((prev) => !prev);
  }, []);

  if (presentation === "sentence") {
    if (!label) {
      // The common case (a sentence field pill has no visible label) — no
      // wrapper div, so `className` reaches PropertyPicker's own trigger
      // button rather than an inert block-level parent around it.
      return (
        <PropertyPicker
          value={value}
          onSelect={onChange}
          disabled={disabled}
          className={className}
        />
      );
    }
    return (
      <div>
        <Label htmlFor={inputId} className="mb-1.5 block text-xs">
          {label}
        </Label>
        <PropertyPicker
          value={value}
          onSelect={onChange}
          disabled={disabled}
          className={className}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {!!label && (
        <Label htmlFor={inputId} className="mb-1.5 block text-xs">
          {label}
        </Label>
      )}
      <div className="flex items-center gap-1.5">
        {showBreadcrumb ? (
          // Breadcrumb display mode
          <button
            id={inputId}
            type="button"
            onClick={toggleMode}
            className={cn(
              "border-input bg-background flex min-h-9 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-md border px-2.5 py-1.5 text-xs",
              "hover:bg-muted/50 transition-colors",
              "focus-visible:ring-primary focus-visible:ring-1 focus-visible:outline-none"
            )}
            aria-label={`JSON path: ${value}. Click to edit manually.`}
          >
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex shrink-0 items-center gap-0.5">
                {i > 0 && <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />}
                <span className="text-foreground whitespace-nowrap">
                  {crumb.label}
                  {crumb.isArray && (
                    <span className="text-muted-foreground ml-0.5 font-mono text-[10px]">[]</span>
                  )}
                </span>
              </span>
            ))}
          </button>
        ) : (
          // Manual input mode
          <Input
            id={inputId}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className="font-mono text-xs"
          />
        )}
        {/* Toggle between breadcrumb and manual mode */}
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            onClick={toggleMode}
            aria-label={isManualMode ? "Show as breadcrumb" : "Edit path manually"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {hasBrowser && <JsonPathBrowser onSelect={handleBrowserSelect} disabled={disabled} />}
      </div>
      {!!error && <p className="text-destructive mt-1 text-xs">{error}</p>}
      <p className="text-muted-foreground mt-1 text-[11px]">
        {!value || isManualMode
          ? mode === "feed"
            ? "e.g. $.row.status, $.fields.amount"
            : mode === "customer"
              ? "e.g. $.totalSpend, $.currentTier"
              : "e.g. $.eventData.status, $.eventTarget.tierId"
          : null}
      </p>
    </div>
  );
}
