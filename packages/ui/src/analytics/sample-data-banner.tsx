import { Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "../primitives/button";

interface SampleDataBannerProps {
  hasRealData: boolean;
  /**
   * Optional CTA rendered after the body copy (e.g., the app-specific Upgrade
   * link). When provided, the dismiss button is suppressed — the action becomes
   * the primary affordance.
   */
  action?: ReactNode;
  /** Override the headline. Defaults to the generic sample-data notice. */
  title?: string;
  /** Override the body copy. Defaults to the generic prompt. */
  description?: string;
}

const DEFAULT_DESCRIPTION =
  "You're viewing sample data. Connect your loyalty program to see real analytics.";

export function SampleDataBanner({
  hasRealData,
  action,
  title,
  description,
}: SampleDataBannerProps): ReactNode {
  const [dismissed, setDismissed] = useState(false);

  if (hasRealData || dismissed) return null;

  return (
    <div
      className="border-info/30 bg-info/5 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
      role="status"
    >
      <Info className="text-info h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        {title && <p className="text-foreground text-sm font-medium">{title}</p>}
        <p className="text-foreground text-sm">{description ?? DEFAULT_DESCRIPTION}</p>
      </div>
      {action ? (
        <div className="shrink-0">{action}</div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
