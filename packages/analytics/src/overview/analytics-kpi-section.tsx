/**
 * Analytics KPI Section
 *
 * Displays key performance indicator cards from api_dashboard_summary.
 */
import { SAMPLE_DASHBOARD_SUMMARY } from "@loom-loyalty/ui/analytics";
import { StatCard } from "@loom-loyalty/ui/data-display";
import { Coins, Gift, Users, Zap } from "lucide-react";
import type { ReactNode } from "react";

import { formatCompactNumber } from "../constants";
import { useDashboardSummary } from "../hooks";
import type { DashboardSummaryRow, DateRange } from "../types";
import { currencyValue, primaryCurrencyCode } from "../utils";

interface AnalyticsKpiSectionProps {
  dateRange: DateRange;
  /** Selected currency code; falls back to the summary's primary code. */
  currencyCode?: string;
  sampleMode?: boolean;
}

export function AnalyticsKpiSection({
  dateRange,
  currencyCode,
  sampleMode,
}: AnalyticsKpiSectionProps): ReactNode {
  const { data, isLoading } = useDashboardSummary(dateRange);
  const summary: DashboardSummaryRow | undefined = sampleMode
    ? SAMPLE_DASHBOARD_SUMMARY.data[0]
    : data?.data?.[0];
  // Sample mode renders before the overview can derive a code, so fall back to
  // the summary's own primary code (e.g. POINTS) for the currency cards.
  const code = currencyCode ?? primaryCurrencyCode(summary);

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="region"
      aria-label="Key performance indicators"
    >
      <StatCard
        title="Total Customers"
        value={summary ? formatCompactNumber(summary.total_customers) : "—"}
        subtitle={summary ? `${formatCompactNumber(summary.active_customers)} active` : undefined}
        icon={Users}
        variant="primary"
        isLoading={!sampleMode && isLoading}
      />
      <StatCard
        title="Currency Issued"
        value={
          summary ? formatCompactNumber(currencyValue(summary.currency_issued_by_code, code)) : "—"
        }
        subtitle={summary ? code : undefined}
        icon={Coins}
        variant="success"
        isLoading={!sampleMode && isLoading}
      />
      <StatCard
        title="Currency Redeemed"
        value={
          summary
            ? formatCompactNumber(currencyValue(summary.currency_redeemed_by_code, code))
            : "—"
        }
        subtitle={summary ? code : undefined}
        icon={Gift}
        variant="accent"
        isLoading={!sampleMode && isLoading}
      />
      <StatCard
        title="Coupons Issued"
        value={summary ? formatCompactNumber(summary.total_coupons_issued) : "—"}
        icon={Zap}
        variant="secondary"
        isLoading={!sampleMode && isLoading}
      />
    </div>
  );
}
