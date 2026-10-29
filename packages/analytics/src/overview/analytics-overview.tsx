/**
 * Analytics Overview
 *
 * Main orchestrator for the performance dashboard. Renders controls,
 * KPI cards, standard charts, and premium sections. Shared by the Hub
 * and the Dashboard; each app passes its own billing/upgrade link via
 * the `upgradeAction` slot.
 */
import { Button, PageHeader, Skeleton } from "@loom-loyalty/ui";
import { SampleDataBanner } from "@loom-loyalty/ui/analytics";
import type { LinkComponentProps } from "@loom-loyalty/ui/shell";
import { AlertCircle, BarChart3, Lock, RefreshCw, ServerCrash, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { DrilldownHrefBuilder } from "../drilldown";
import { useDashboardSummary } from "../hooks";
import { useTinybird } from "../provider";
import type { TinybirdTokenError } from "../types";
import { listCurrencyCodes, primaryCurrencyCode } from "../utils";
import { AnalyticsChartsSection } from "./analytics-charts-section";
import { AnalyticsControls } from "./analytics-controls";
import { AnalyticsKpiSection } from "./analytics-kpi-section";
import { AnalyticsPremiumSection } from "./analytics-premium-section";
import { useAnalyticsState } from "./use-analytics-state";

function AnalyticsErrorView({
  error,
  onRetry,
  onShowSample,
  upgradeAction,
}: {
  error: TinybirdTokenError;
  onRetry: () => void;
  onShowSample: () => void;
  upgradeAction?: ReactNode;
}): ReactNode {
  interface ErrorConfigEntry {
    icon: typeof AlertCircle;
    title: string;
    description: string;
    showRetry: boolean;
  }

  const config: Record<TinybirdTokenError["type"], ErrorConfigEntry> = {
    PLAN_REQUIRED: {
      icon: Lock,
      title: "Analytics Unavailable",
      description:
        "Analytics is available on paid plans. Upgrade your plan to access performance insights, customer trends, and detailed reporting.",
      showRetry: false,
    },
    SERVICE_UNAVAILABLE: {
      icon: ServerCrash,
      title: "Analytics Service Unavailable",
      description:
        "The analytics service is temporarily unavailable. This is usually resolved quickly — please try again in a few moments.",
      showRetry: true,
    },
    AUTH_ERROR: {
      icon: Lock,
      title: "Authentication Error",
      // A 401, or a 403 for a caller without the analytics scope (a 401 on older releases).
      description:
        "We couldn't verify your access to analytics. Try refreshing the page or signing in " +
        "again. If it keeps happening, ask an administrator for analytics access.",
      showRetry: true,
    },
    NETWORK_ERROR: {
      icon: WifiOff,
      title: "Connection Error",
      description:
        "Unable to reach the analytics service. Check your internet connection and try again.",
      showRetry: true,
    },
    UNKNOWN: {
      icon: AlertCircle,
      title: "Something Went Wrong",
      description: "An unexpected error occurred while loading analytics.",
      showRetry: true,
    },
  };

  const { icon: Icon, title, description, showRetry } = config[error.type];

  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center" role="alert">
        <div className="bg-muted rounded-full p-4">
          <Icon className="text-muted-foreground h-8 w-8" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-foreground font-serif text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          {error.message && error.message !== description && (
            <p className="text-muted-foreground/70 mt-1 font-mono text-xs">{error.message}</p>
          )}
        </div>
        <div className="mt-2 flex gap-3">
          {showRetry && (
            <Button onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try Again
            </Button>
          )}
          {error.type === "PLAN_REQUIRED" && upgradeAction}
          <Button variant="outline" onClick={onShowSample}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Show Sample Data
          </Button>
        </div>
      </div>
    </main>
  );
}

interface AnalyticsOverviewProps {
  /**
   * App-specific upgrade/billing CTA rendered on the PLAN_REQUIRED error view.
   * Supplied by the caller so each app links to its own billing surface
   * (in-app TanStack Link, cross-app anchor, etc.). Defaults to nothing.
   */
  upgradeAction?: ReactNode;
  /**
   * Builds the href a chart's drill-down navigates to, normally the app's SQL
   * workbench route. Apps that ship no workbench omit it and render no
   * drill-down affordances at all — the package never assumes a route exists.
   */
  buildDrilldownHref?: DrilldownHrefBuilder;
  /** Optional app-level router adapter for drill-down links. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
}

export function AnalyticsOverview({
  upgradeAction,
  buildDrilldownHref,
  LinkComponent,
}: AnalyticsOverviewProps = {}): ReactNode {
  const { isLoading, error, retry } = useTinybird();
  const [sampleMode, setSampleMode] = useState(false);
  const {
    dateRange,
    granularity,
    compareEnabled,
    selectedCurrencyCode,
    setDateRange,
    setGranularity,
    setCompareEnabled,
    setSelectedCurrencyCode,
  } = useAnalyticsState();

  // Fetch the summary here to derive the tenant's currency codes for the
  // selector. The KPI section issues the same query — react-query dedupes by
  // key, so this is a single network request.
  const { data: summaryResponse } = useDashboardSummary(dateRange);
  const summary = summaryResponse?.data?.[0];
  const currencyCodes = listCurrencyCodes(summary);
  // Derived (no effect): a selection that's no longer valid after a date change
  // falls back to the primary code without a stale-state flash.
  const effectiveCurrencyCode =
    selectedCurrencyCode && currencyCodes.includes(selectedCurrencyCode)
      ? selectedCurrencyCode
      : primaryCurrencyCode(summary);

  if (error && !sampleMode) {
    return (
      <AnalyticsErrorView
        error={error}
        onRetry={() => void retry()}
        onShowSample={() => setSampleMode(true)}
        upgradeAction={upgradeAction}
      />
    );
  }

  if (isLoading && !sampleMode) {
    return (
      <main className="space-y-6" aria-busy="true">
        <PageHeader title="Analytics" description="Performance Overview" />
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Performance Overview"
        actions={
          !sampleMode ? (
            <AnalyticsControls
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              granularity={granularity}
              onGranularityChange={(g) =>
                setGranularity(g as "hourly" | "daily" | "weekly" | "monthly")
              }
              compareEnabled={compareEnabled}
              onCompareChange={setCompareEnabled}
              currencyCodes={currencyCodes}
              currencyCode={effectiveCurrencyCode}
              onCurrencyCodeChange={setSelectedCurrencyCode}
            />
          ) : undefined
        }
      />

      <SampleDataBanner hasRealData={!sampleMode} />

      <section aria-label="Key metrics">
        <AnalyticsKpiSection
          dateRange={dateRange}
          currencyCode={effectiveCurrencyCode}
          sampleMode={sampleMode}
        />
      </section>

      <section aria-label="Charts">
        <AnalyticsChartsSection
          dateRange={dateRange}
          granularity={granularity}
          compareEnabled={compareEnabled}
          currencyCode={effectiveCurrencyCode}
          sampleMode={sampleMode}
          buildDrilldownHref={buildDrilldownHref}
          LinkComponent={LinkComponent}
        />
      </section>

      {!sampleMode && (
        <section aria-label="Premium insights">
          <AnalyticsPremiumSection
            dateRange={dateRange}
            granularity={granularity}
            compareEnabled={compareEnabled}
            upgradeAction={upgradeAction}
            buildDrilldownHref={buildDrilldownHref}
            LinkComponent={LinkComponent}
          />
        </section>
      )}
    </main>
  );
}
