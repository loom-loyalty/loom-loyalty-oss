import { Activity, Award, Users } from "lucide-react";
import type { ReactNode } from "react";

import { PremiumLockedCard } from "./premium-locked-card";

interface LockedPremiumSectionProps {
  /** App-passed upgrade CTA, threaded down from AnalyticsOverview via AnalyticsPremiumSection. */
  upgradeAction: ReactNode;
}

/**
 * Locked variant of the AnalyticsPremiumSection. Renders three PremiumLockedCards
 * (mirroring the three premium charts: Top Offers, Event Volume, Customer Activity)
 * so base-tier users see what they would unlock with a premium plan, but without
 * any fake data muddying the signal next to their real free-tier charts.
 *
 * Layout mirrors the real premium section: Top Offers + Event Volume in a 2-column
 * grid on lg+, with Customer Activity as a full-width row below. This preserves
 * the visual rhythm operators see when they upgrade — no orphan-row surprise.
 *
 * Gated upstream by `!sampleMode && !hasPremium` in AnalyticsPremiumSection.
 */
export function LockedPremiumSection({ upgradeAction }: LockedPremiumSectionProps): ReactNode {
  return (
    <div className="space-y-4">
      <h2 className="text-foreground text-lg font-semibold">Premium Insights</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PremiumLockedCard
          title="Top Offers"
          description="Ranking of offers by redemption rate and unique recipients."
          icon={Award}
          upgradeAction={upgradeAction}
        />
        <PremiumLockedCard
          title="Event Volume"
          description="Time-series breakdown of event counts by type."
          icon={Activity}
          upgradeAction={upgradeAction}
        />
      </div>
      <PremiumLockedCard
        title="Customer Activity"
        description="Recent activity feed across your customer base."
        icon={Users}
        upgradeAction={upgradeAction}
      />
    </div>
  );
}
