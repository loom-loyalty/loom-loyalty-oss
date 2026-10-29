import { Button, PageHeader, Skeleton } from "@loom-loyalty/ui";
import { useAiChat } from "@loom-loyalty/ui/ai";
import {
  buildSampleCustomerRevenueDecile,
  CompareToggle,
  DecileDistribution,
  SampleDataBanner,
} from "@loom-loyalty/ui/analytics";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { CohortFilterControl, cohortToDateRange } from "../funnel/cohort-filter-control";
import { useComparison } from "../hooks/use-comparison";
import { useCustomerRevenueDecile } from "../hooks/use-customer-revenue-decile";
import { PIPES } from "../pipes";
import { useTinybird } from "../provider";
import type { CohortFilter, CustomerRevenueDecileRow } from "../types";
import { MetricRoleToggle } from "./metric-role-toggle";
import { ScopeToggle } from "./scope-toggle";

export interface RevenueDecilesPageProps {
  upgradeAction?: ReactNode;
  brand?: { currencyName?: string; currencyCode?: string };
}

function buildAiContext(
  cohort: CohortFilter,
  metricRole: string,
  scope: string,
  topDecileShare: number | null
): string {
  const cohortLabel =
    cohort.kind === "all"
      ? "all customers"
      : cohort.kind === "period"
        ? `customers acquired in the last ${cohort.period}`
        : `customers acquired between ${cohort.start_date} and ${cohort.end_date}`;
  const topNote =
    topDecileShare !== null
      ? `Decile 10 (top 10% of customers) drives ${topDecileShare.toFixed(1)}% of ${metricRole.toLowerCase()}.`
      : "";
  return `Help me interpret this customer revenue decile view. Metric: ${metricRole.toLowerCase()}, scope: ${scope}. Cohort: ${cohortLabel}. ${topNote} What does this tell me about my loyalty program's value concentration?`;
}

export function RevenueDecilesPage({ upgradeAction, brand }: RevenueDecilesPageProps): ReactNode {
  const { hasPremium, pipes, isLoading: tokenLoading, error: tokenError, retry } = useTinybird();
  const hasDecilePipe = pipes.includes(PIPES.CUSTOMER_REVENUE_DECILE);
  // PLAN_REQUIRED falls through to sample mode (the base-tier teaser path).
  // Other token errors render the error view.
  const isBlockingError = tokenError !== null && tokenError.type !== "PLAN_REQUIRED";
  // Suppress sample mode during initial token fetch — avoids the sample banner flashing
  // for premium tenants between mount and token arrival.
  const sampleMode = !isBlockingError && !tokenLoading && (!hasPremium || !hasDecilePipe);

  const [cohort, setCohort] = useState<CohortFilter>({ kind: "all" });
  const [metricRole, setMetricRole] = useState<"REVENUE" | "COST" | "MARGIN">("REVENUE");
  const [scope, setScope] = useState<"all" | "earning">("all");
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Reset compareEnabled when cohort flips to 'all'. The CompareToggle visual is gated
  // by cohort.kind !== 'all', so the toggle looks off — but state stays true and
  // would silently re-fire comparison when the user picks a period cohort again.
  useEffect(() => {
    if (cohort.kind === "all") setCompareEnabled(false);
  }, [cohort]);

  const decile = useCustomerRevenueDecile(
    cohort,
    { metricRole, scope },
    { enabled: !sampleMode && !isBlockingError }
  );

  // Comparison reuses useComparison<P,T> with explicit dates (cohortToDateRange handles 'period').
  const comparisonParams = useMemo(
    () => ({
      ...cohortToDateRange(cohort),
      metric_role: metricRole,
      scope,
    }),
    [cohort, metricRole, scope]
  );
  const comparison = useComparison<typeof PIPES.CUSTOMER_REVENUE_DECILE, CustomerRevenueDecileRow>(
    PIPES.CUSTOMER_REVENUE_DECILE,
    comparisonParams,
    compareEnabled && !sampleMode && cohort.kind !== "all"
  );

  const sampleFixture = useMemo(
    () => (sampleMode ? buildSampleCustomerRevenueDecile(brand) : null),
    [sampleMode, brand]
  );

  const data = sampleMode ? (sampleFixture?.data ?? []) : (decile.data?.data ?? []);

  const comparisonData =
    !sampleMode && compareEnabled && cohort.kind !== "all" ? comparison.previous?.data : undefined;

  // Sparse-data check (per BE pipe: < 10 customers collapses quantiles)
  const isSparse = useMemo(() => {
    if (data.length === 0) return false;
    if (data.length < 10) return true;
    const totals = data.map((d) => d.metric_total);
    return totals.every((v) => v === totals[0]);
  }, [data]);

  const topDecileShare = useMemo(() => {
    // Pipe DESC: data[0] is decile 10 (top).
    return data.length > 0 ? (data[0]?.share_of_total_pct ?? null) : null;
  }, [data]);

  const { openWithMessage } = useAiChat();
  const handleAskAi = (): void => {
    openWithMessage(buildAiContext(cohort, metricRole, scope, topDecileShare));
  };

  const isLoading = tokenLoading || (!sampleMode && decile.isLoading);

  if (isBlockingError && tokenError) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center" role="alert">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="bg-muted rounded-full p-4">
            <AlertCircle className="text-muted-foreground h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground font-serif text-xl font-semibold">
              Analytics unavailable
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{tokenError.message}</p>
          </div>
          <div className="mt-2 flex gap-3">
            <Button onClick={() => void retry()}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            {upgradeAction}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Revenue Decile Analysis"
        description="Where customer value concentrates"
        actions={
          <div className="flex items-center gap-2">
            <CompareToggle
              enabled={compareEnabled && cohort.kind !== "all"}
              onChange={setCompareEnabled}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAskAi}
              disabled={!hasPremium}
              aria-label={
                hasPremium
                  ? "Ask AI to interpret this decile view"
                  : "Ask AI to interpret this decile view (Premium)"
              }
              title={hasPremium ? undefined : "Premium feature"}
              className="min-h-11 sm:min-h-9"
            >
              <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Ask AI about this
            </Button>
          </div>
        }
      />

      {sampleMode && (
        <SampleDataBanner
          hasRealData={false}
          title="This is what your data could look like"
          description="The numbers below are sample data — real data unlocks with your upgraded plan."
          action={upgradeAction}
        />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <MetricRoleToggle value={metricRole} onChange={setMetricRole} />
        <ScopeToggle value={scope} onChange={setScope} />
        <CohortFilterControl value={cohort} onChange={setCohort} />
      </div>

      {isLoading ? (
        <Skeleton className="h-[28rem] w-full rounded-lg" />
      ) : data.length === 0 ? (
        <div
          className="border-border bg-muted/30 rounded-lg border border-dashed p-12 text-center"
          role="status"
        >
          <p className="text-foreground font-serif text-lg">
            No {metricRole.toLowerCase()} data yet.
          </p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            To populate this dashboard, make sure all three are true: send order value as a numeric
            field on your earn events, use a value-based (non-fixed) earn rule that reads it, and
            tag that attribute with a {metricRole.toLowerCase()} metric role on its data model. Once
            tagged transactions start flowing, this view fills in as customers accrue history.
          </p>
        </div>
      ) : isSparse ? (
        <div
          className="border-border bg-muted/30 rounded-lg border border-dashed p-8 text-center"
          role="status"
        >
          <p className="text-muted-foreground text-sm">
            You have {data.reduce((s, d) => s + d.customer_count, 0).toLocaleString()} customers
            with non-zero {metricRole.toLowerCase()}. Deciles get meaningful around 10+ — the view
            becomes sharper as your program grows.
          </p>
        </div>
      ) : (
        <DecileDistribution
          data={data}
          comparisonData={comparisonData}
          primaryCurrencyCode={brand?.currencyCode}
          metricRole={metricRole}
          scope={scope}
        />
      )}
    </main>
  );
}
