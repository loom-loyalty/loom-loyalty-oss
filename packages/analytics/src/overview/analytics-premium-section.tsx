/**
 * Analytics Premium Section
 *
 * Offer rankings, event volume, customer activity.
 *
 * Tier × mode matrix:
 *   - hasPremium=true                       → full premium charts
 *   - !hasPremium, sampleMode=false (base)  → LockedPremiumSection (locked-card teaser)
 *   - !hasPremium, sampleMode=true          → null (the caller already gates this branch)
 *
 * The locked-card variant is rendered when the caller passes `upgradeAction` AND
 * the user lacks premium — the prop also serves as an opt-in: callers that don't
 * pass it preserve the original "hide section entirely" behavior.
 */
import {
  ActivityTable,
  BarRanking,
  LockedPremiumSection,
  TimeSeriesChart,
} from "@loom-loyalty/ui/analytics";
import type { LinkComponentProps } from "@loom-loyalty/ui/shell";
import type { ReactNode } from "react";
import { useState } from "react";

import type { DrilldownHrefBuilder } from "../drilldown";
import { useDrilldownLinks } from "../drilldown";
import {
  useComparison,
  useCsvExport,
  useCustomerActivity,
  useEventVolume,
  useOfferSummary,
} from "../hooks";
import { PIPES } from "../pipes";
import { useTinybird } from "../provider";
import type { DateRange, EventVolumeRow, Granularity } from "../types";

interface AnalyticsPremiumSectionProps {
  dateRange: DateRange;
  granularity: Granularity;
  compareEnabled: boolean;
  /**
   * Optional app-passed billing CTA. When provided, base-tier users see a
   * LockedPremiumSection teaser instead of an empty space. When omitted, the
   * original "hide section entirely on base-tier" behavior is preserved
   * (R1 regression-safe).
   */
  upgradeAction?: ReactNode;
  /** Builds a drill-down href. Omitted by apps without a SQL workbench. */
  buildDrilldownHref?: DrilldownHrefBuilder;
  /** Optional app-level router adapter for drill-down links. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
}

export function AnalyticsPremiumSection({
  dateRange,
  granularity,
  compareEnabled,
  upgradeAction,
  buildDrilldownHref,
  LinkComponent,
}: AnalyticsPremiumSectionProps): ReactNode {
  const { hasPremium } = useTinybird();
  const { chartHref, itemHref } = useDrilldownLinks(buildDrilldownHref, {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    granularity,
  });
  const [activityPage, setActivityPage] = useState(0);

  const offerSummary = useOfferSummary(dateRange, { enabled: hasPremium, limit: 10 });
  const eventVolume = useEventVolume(dateRange, { enabled: hasPremium, granularity });
  const customerActivity = useCustomerActivity(dateRange, {
    enabled: hasPremium,
    limit: 20,
    offset: activityPage * 20,
  });

  const eventVolumeComparison = useComparison<typeof PIPES.EVENT_VOLUME, EventVolumeRow>(
    PIPES.EVENT_VOLUME,
    { start_date: dateRange.startDate, end_date: dateRange.endDate, granularity },
    compareEnabled && hasPremium
  );

  const { exportCsv, isExporting, pipeName } = useCsvExport();

  if (!hasPremium) {
    // Locked-card teaser when the app supplied an upgradeAction; otherwise preserve
    // the original "section hidden entirely" behavior so existing callers that don't
    // pass upgradeAction are byte-equivalent.
    return upgradeAction ? <LockedPremiumSection upgradeAction={upgradeAction} /> : null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-foreground text-lg font-semibold">Premium Insights</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarRanking
          title="Top Offers"
          data={
            offerSummary.data?.data.map((d) => ({
              label: d.offer_name,
              value: d.total_used,
              subtitle: `$${String(d.total_discount_value.toLocaleString())} value`,
              code: d.offer_code,
            })) ?? []
          }
          isLoading={offerSummary.isLoading}
          error={offerSummary.error as Error | null}
          onRetry={() => void offerSummary.refetch()}
          onExport={() =>
            void exportCsv(
              PIPES.OFFER_SUMMARY,
              { start_date: dateRange.startDate, end_date: dateRange.endDate, limit: 10 },
              "top-offers.csv"
            )
          }
          isExporting={isExporting && pipeName === PIPES.OFFER_SUMMARY}
          exploreHref={chartHref(PIPES.OFFER_SUMMARY)}
          LinkComponent={LinkComponent}
          getItemHref={(item) =>
            itemHref(PIPES.OFFER_SUMMARY, { value: item.code ?? item.label, label: item.label })
          }
        />

        <TimeSeriesChart
          title="Event Volume"
          data={eventVolume.data?.data ?? []}
          xKey="period"
          series={[{ key: "event_count", label: "Events", color: "var(--chart-1)" }]}
          comparisonData={compareEnabled ? eventVolumeComparison.previous?.data : undefined}
          isLoading={eventVolume.isLoading || (compareEnabled && eventVolumeComparison.isLoading)}
          error={eventVolume.error as Error | null}
          onRetry={() => void eventVolume.refetch()}
          onExport={() =>
            void exportCsv(
              PIPES.EVENT_VOLUME,
              { start_date: dateRange.startDate, end_date: dateRange.endDate, granularity },
              "event-volume.csv"
            )
          }
          isExporting={isExporting && pipeName === PIPES.EVENT_VOLUME}
          exploreHref={chartHref(PIPES.EVENT_VOLUME)}
          LinkComponent={LinkComponent}
        />
      </div>

      <ActivityTable
        title="Recent Activity"
        data={customerActivity.data?.data ?? []}
        isLoading={customerActivity.isLoading}
        error={customerActivity.error as Error | null}
        onRetry={() => void customerActivity.refetch()}
        onExport={() =>
          void exportCsv(
            PIPES.CUSTOMER_ACTIVITY,
            { start_date: dateRange.startDate, end_date: dateRange.endDate, limit: 1000 },
            "customer-activity.csv"
          )
        }
        isExporting={isExporting && pipeName === PIPES.CUSTOMER_ACTIVITY}
        page={activityPage}
        pageSize={20}
        total={customerActivity.data?.rows_before_limit_at_least}
        onPageChange={setActivityPage}
      />
    </div>
  );
}
