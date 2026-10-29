import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../primitives/button";
import { Card, CardContent } from "../primitives/card";

interface AnalyticsErrorBannerProps {
  onRetry: () => void;
  title?: string;
  description?: string;
}

/**
 * Compact inline banner for transient analytics-service failures. Use only for
 * retryable errors (SERVICE_UNAVAILABLE, NETWORK_ERROR). Plan-tier errors get
 * `AnalyticsUpgradeBanner`; auth failures should route to the sign-in flow.
 */
export function AnalyticsErrorBanner({
  onRetry,
  title = "Analytics unavailable",
  description = "The analytics service did not respond. Visit /analytics for details.",
}: AnalyticsErrorBannerProps): ReactNode {
  return (
    <Card
      className="border-destructive/30 border-dashed"
      role="status"
      aria-live="polite"
      aria-label="Analytics service unavailable"
    >
      <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="bg-destructive/10 text-destructive mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            aria-hidden="true"
          >
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-foreground text-sm font-medium">{title}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
