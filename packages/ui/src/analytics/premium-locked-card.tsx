import { Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "../primitives/card";

export interface PremiumLockedCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** App-passed upgrade CTA (Link/anchor with target+rel; see DESIGN.md cross-app nav). */
  upgradeAction: ReactNode;
}

/**
 * Locked-state card used on the AnalyticsOverview premium section for base-tier
 * users (when `!hasPremium && !sampleMode`). Honest framing: card shell visible
 * with title/description/icon, data area replaced with a Lock + upgrade CTA.
 *
 * Single muted Card (no skeleton-axes overlay or blur). The lock icon is the
 * primary visual; the upgrade CTA is the primary affordance. See plan §
 * PremiumLockedCard visual.
 */
export function PremiumLockedCard({
  title,
  description,
  icon: Icon,
  upgradeAction,
}: PremiumLockedCardProps): ReactNode {
  return (
    <Card className="bg-muted/40 border-border/60" role="region" aria-label={`${title} (locked)`}>
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <div className="flex items-center gap-2">
          <span
            className="bg-muted text-muted-foreground inline-flex h-7 w-7 items-center justify-center rounded-md"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-foreground text-sm font-medium">{title}</h3>
        </div>
        <div
          className="bg-background/60 border-border/40 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-md border"
          aria-hidden="true"
        >
          <Lock className="text-muted-foreground/70 h-5 w-5" aria-hidden="true" />
          <p className="text-muted-foreground text-xs">Premium feature</p>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
        <div className="mt-auto self-stretch">{upgradeAction}</div>
      </CardContent>
    </Card>
  );
}
