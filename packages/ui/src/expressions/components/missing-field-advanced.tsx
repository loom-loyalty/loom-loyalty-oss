/**
 * Missing-field Advanced Option
 *
 * The engine's `defaultResult` flag ("what this condition returns when the
 * path isn't present") is engine vocabulary, not a marketer's, so it sits
 * collapsed under an "Advanced" disclosure in plain language instead of as a
 * top-level switch.
 *
 * Audience segments (`mode === "customer"`) compile to ClickHouse SQL, which
 * never reads `defaultResult` — a missing field reads as an empty value
 * there — so the control renders nothing on that surface rather than offering
 * a setting with no effect.
 */

import { ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../primitives/collapsible.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";
import { useExpressionContext } from "../expression-context.js";

export interface MissingFieldAdvancedProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function MissingFieldAdvanced({
  checked,
  onCheckedChange,
  disabled,
  className,
}: MissingFieldAdvancedProps): ReactNode {
  const { mode } = useExpressionContext();
  const switchId = useId();

  if (mode === "customer") return null;

  return (
    // Opens on mount when the option is on, so a condition that matches missing
    // fields never hides that behind a closed disclosure.
    <Collapsible defaultOpen={checked} className={cn("w-full", className)}>
      <CollapsibleTrigger
        type="button"
        className={cn(
          "group text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-xs font-medium sm:min-h-8",
          "focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        )}
      >
        <ChevronRight
          className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        Advanced
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pl-4">
        <div className="flex items-center gap-2">
          <Switch
            id={switchId}
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
          />
          <Label htmlFor={switchId} className="text-xs">
            Match when this field is missing
          </Label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
