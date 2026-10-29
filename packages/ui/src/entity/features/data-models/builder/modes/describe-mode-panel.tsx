/**
 * DescribeModePanel
 *
 * Plain-language description plus the generate action. The button and its info
 * line are `flex-shrink-0` on purpose: the rail scrolls rather than squashing
 * its own CTA.
 */

import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../../../../primitives/button.js";
import { Label } from "../../../../../primitives/label.js";
import { Textarea } from "../../../../../primitives/textarea.js";
import type { DescribeModePanelProps } from "../types.js";

export function DescribeModePanel({
  value,
  onValueChange,
  onGenerate,
  isGenerating = false,
  disabled = false,
}: DescribeModePanelProps): ReactNode {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label
          htmlFor="builder-describe"
          className="text-foreground flex items-center gap-1.5 text-sm font-medium"
        >
          <Sparkles className="text-accent h-4 w-4" aria-hidden="true" />
          What does this event contain?
        </Label>
        <Textarea
          id="builder-describe"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          disabled={disabled || isGenerating}
          aria-busy={isGenerating}
          placeholder="A completed order with a total, a currency, the customer email, and the line items."
          className="focus-visible:border-accent focus-visible:ring-accent/40 min-h-[112px]"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onGenerate}
        disabled={disabled || isGenerating || value.trim().length === 0}
        aria-busy={isGenerating}
        className="border-accent/40 text-accent-dark hover:bg-accent/10 hover:text-accent-dark w-full flex-shrink-0"
      >
        <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
        {isGenerating ? "Drafting fields..." : "Regenerate fields"}
      </Button>
      <p className="text-muted-foreground flex-shrink-0 text-xs">
        Drafts fields for you to confirm. Nothing is saved until you do.
      </p>
    </div>
  );
}
