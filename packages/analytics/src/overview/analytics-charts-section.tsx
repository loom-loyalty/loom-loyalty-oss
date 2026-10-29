/**
 * Analytics Standard Charts Section
 *
 * Currency trend, customers by status, tiers distribution, program enrollment.
 * Available on all BASE+ tiers.
 */
import {
  BarRanking,
  DistributionChart,
  SAMPLE_CURRENCY_TREND,
  SAMPLE_CUSTOMERS_BY_STATUS,
  SAMPLE_PROGRAMS_ENROLLMENT,
  SAMPLE_TIERS_TOTAL,
  TimeSeriesChart,
} from "@loom-loyalty/ui/analytics";
import type { LinkComponentProps } from "@loom-loyalty/ui/shell";
import type { ReactNode } from "react";

import type { DrilldownHrefBuilder } from "../drilldown";
import { useDrilldownLinks } from "../drilldown";
import {
  useComparison,
  useCsvExport,
  useCurrencyTrend,
  useCustomersByStatus,
  useProgramsEnrollment,
  useTiersTotal,
} from "../hooks";
import { PIPES } from "../pipes";
import type { CurrencyTrendRow, DateRange, Granularity } from "../types";
import { aggregateCurrencyTrendByPeriod } from "../utils";

interface AnalyticsChartsSectionProps {
  dateRange: DateRange;
  granularity: Granularity;
  compareEnabled: boolean;
  /** Selected currency code; filters the trend pipe to a single series. */
  currencyCode?: string;
  sampleMode?: boolean;
  /** Builds a drill-down href. Omitted by apps without a SQL workbench. */
  buildDrilldownHref?: DrilldownHrefBuilder;
  /** Optional app-level router adapter for drill-down links. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
}

export function AnalyticsChartsSection({
  dateRange,
  granularity,
  compareEnabled,
  currencyCode,
  sampleMode,
  buildDrilldownHref,
  LinkComponent,
}: AnalyticsChartsSectionProps): ReactNode {
  // Sample data is illustrative, not the tenant's — drilling into it would open
  // a workbench query for rows that do not exist.
  const { chartHref, itemHref } = useDrilldownLinks(sampleMode ? undefined : buildDrilldownHref, {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    granularity,
    currencyCode,
  });

  const currencyTrend = useCurrencyTrend(dateRange, granularity, undefined, currencyCode);
  const customersByStatus = useCustomersByStatus(dateRange);
  const tiersTotal = useTiersTotal(dateRange);
  const programsEnrollment = useProgramsEnrollment(dateRange);

  const currencyComparison = useComparison<typeof PIPES.CURRENCY_TREND, CurrencyTrendRow>(
    PIPES.CURRENCY_TREND,
    {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      granularity,
      currency_code: currencyCode,
    },
    compareEnabled
  );

  const { exportCsv, isExporting, pipeName } = useCsvExport();

  // Collapse any per-code rows into one series per period. A no-op once the pipe
  // has filtered to a single currency_code, but a safety net when it hasn't.
  const currencyTrendData = aggregateCurrencyTrendByPeriod(
    sampleMode ? SAMPLE_CURRENCY_TREND.data : (currencyTrend.data?.data ?? [])
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TimeSeriesChart
        title="Currency Trend"
        data={currencyTrendData}
        xKey="period"
        series={[
          { key: "issued_amount", label: "Issued", color: "var(--chart-1)" },
          { key: "redeemed_amount", label: "Redeemed", color: "var(--chart-2)" },
          { key: "net_change", label: "Net", color: "var(--chart-3)" },
        ]}
        comparisonData={
          !sampleMode && compareEnabled
            ? aggregateCurrencyTrendByPeriod(currencyComparison.previous?.data ?? [])
            : undefined
        }
        isLoading={
          !sampleMode &&
          (currencyTrend.isLoading || (compareEnabled && currencyComparison.isLoading))
        }
        error={sampleMode ? null : (currencyTrend.error as Error | null)}
        onRetry={sampleMode ? undefined : () => void currencyTrend.refetch()}
        onExport={
          sampleMode
            ? undefined
            : () =>
                void exportCsv(
                  PIPES.CURRENCY_TREND,
                  {
                    start_date: dateRange.startDate,
                    end_date: dateRange.endDate,
                    granularity,
                  },
                  "currency-trend.csv"
                )
        }
        isExporting={isExporting && pipeName === PIPES.CURRENCY_TREND}
        exploreHref={chartHref(PIPES.CURRENCY_TREND)}
        LinkComponent={LinkComponent}
        className="lg:col-span-2"
      />

      <DistributionChart
        title="Customers by Status"
        data={
          sampleMode
            ? SAMPLE_CUSTOMERS_BY_STATUS.data.map((d) => ({
                name: d.status_code,
                value: d.customer_count,
                percentage: d.percentage,
              }))
            : (customersByStatus.data?.data.map((d) => ({
                name: d.status_code,
                value: d.customer_count,
                percentage: d.percentage,
                code: d.status_code,
              })) ?? [])
        }
        isLoading={!sampleMode && customersByStatus.isLoading}
        error={sampleMode ? null : (customersByStatus.error as Error | null)}
        onRetry={sampleMode ? undefined : () => void customersByStatus.refetch()}
        onExport={
          sampleMode
            ? undefined
            : () =>
                void exportCsv(
                  PIPES.CUSTOMERS_BY_STATUS,
                  { start_date: dateRange.startDate, end_date: dateRange.endDate },
                  "customers-by-status.csv"
                )
        }
        isExporting={isExporting && pipeName === PIPES.CUSTOMERS_BY_STATUS}
        exploreHref={chartHref(PIPES.CUSTOMERS_BY_STATUS)}
        LinkComponent={LinkComponent}
        getSegmentHref={(d) =>
          itemHref(PIPES.CUSTOMERS_BY_STATUS, { value: d.code ?? d.name, label: d.name })
        }
      />

      <DistributionChart
        title="Tier Distribution"
        data={
          sampleMode
            ? SAMPLE_TIERS_TOTAL.data.map((d) => ({
                name: d.tier_name,
                value: d.customer_count,
                percentage: d.percentage,
              }))
            : (tiersTotal.data?.data.map((d) => ({
                name: d.tier_name,
                value: d.customer_count,
                percentage: d.percentage,
                code: d.tier_code,
              })) ?? [])
        }
        isLoading={!sampleMode && tiersTotal.isLoading}
        error={sampleMode ? null : (tiersTotal.error as Error | null)}
        onRetry={sampleMode ? undefined : () => void tiersTotal.refetch()}
        onExport={
          sampleMode
            ? undefined
            : () =>
                void exportCsv(
                  PIPES.TIERS_TOTAL,
                  { start_date: dateRange.startDate, end_date: dateRange.endDate },
                  "tier-distribution.csv"
                )
        }
        isExporting={isExporting && pipeName === PIPES.TIERS_TOTAL}
        exploreHref={chartHref(PIPES.TIERS_TOTAL)}
        LinkComponent={LinkComponent}
        getSegmentHref={(d) =>
          itemHref(PIPES.TIERS_TOTAL, { value: d.code ?? d.name, label: d.name })
        }
      />

      <BarRanking
        title="Program Enrollment"
        data={
          sampleMode
            ? SAMPLE_PROGRAMS_ENROLLMENT.data.map((d) => ({
                label: d.program_code,
                value: d.total_enrollments,
                subtitle: `${String(d.active_enrollments)} active`,
              }))
            : (programsEnrollment.data?.data.map((d) => ({
                label: d.program_code,
                value: d.total_enrollments,
                subtitle: `${String(d.active_enrollments)} active`,
                code: d.program_code,
              })) ?? [])
        }
        isLoading={!sampleMode && programsEnrollment.isLoading}
        error={sampleMode ? null : (programsEnrollment.error as Error | null)}
        onRetry={sampleMode ? undefined : () => void programsEnrollment.refetch()}
        onExport={
          sampleMode
            ? undefined
            : () =>
                void exportCsv(
                  PIPES.PROGRAMS_ENROLLMENT,
                  { start_date: dateRange.startDate, end_date: dateRange.endDate },
                  "program-enrollment.csv"
                )
        }
        isExporting={isExporting && pipeName === PIPES.PROGRAMS_ENROLLMENT}
        exploreHref={chartHref(PIPES.PROGRAMS_ENROLLMENT)}
        LinkComponent={LinkComponent}
        getItemHref={(item) =>
          itemHref(PIPES.PROGRAMS_ENROLLMENT, {
            value: item.code ?? item.label,
            label: item.label,
          })
        }
      />
    </div>
  );
}
