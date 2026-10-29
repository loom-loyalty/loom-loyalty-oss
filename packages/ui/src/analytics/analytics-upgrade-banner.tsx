import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "../primitives/card";

interface AnalyticsUpgradeBannerProps {
  /** Render the CTA control — supplied by the caller so it can choose Link/anchor/target/etc. */
  action: ReactNode;
  title?: string;
  description?: string;
}

/**
 * Free-tier teaser shown when the Tinybird token request returns PLAN_REQUIRED.
 * Visual shell only; the caller wires up the billing link (in-app vs cross-app).
 */
export function AnalyticsUpgradeBanner({
  action,
  title = "Live analytics on a paid plan",
  description = "Upgrade to see real-time customer, currency, and coupon metrics.",
}: AnalyticsUpgradeBannerProps): ReactNode {
  return (
    <Card className="border-dashed" role="status" aria-label="Analytics plan upgrade required">
      <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            aria-hidden="true"
          >
            <Lock className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-foreground text-sm font-medium">{title}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
