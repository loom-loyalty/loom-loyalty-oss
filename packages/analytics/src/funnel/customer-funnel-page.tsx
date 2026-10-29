import { Button, PageHeader, Skeleton } from "@loom-loyalty/ui";
import { useAiChat } from "@loom-loyalty/ui/ai";
import {
  buildSampleCustomerFunnel,
  CompareToggle,
  LifecycleFunnel,
  SampleDataBanner,
} from "@loom-loyalty/ui/analytics";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { useComparison } from "../hooks/use-comparison";
import { useCustomerFunnel } from "../hooks/use-customer-funnel";
import { PIPES } from "../pipes";
import { useTinybird } from "../provider";
import type { CohortFilter, CustomerFunnelRow } from "../types";
import { CohortFilterControl, cohortToDateRange } from "./cohort-filter-control";
import { isFunnelDataEmpty } from "./funnel-utils";

export interface CustomerFunnelPageProps {
  /** App-specific billing CTA rendered in the SampleDataBanner upgrade slot + error view. */
  upgradeAction?: ReactNode;
}

function buildAiContext(cohort: CohortFilter, topStage: string | null): string {
  const cohortLabel =
    cohort.kind === "all"
      ? "all customers"
      : cohort.kind === "period"
        ? `customers acquired in the last ${cohort.period}`
        : `customers acquired between ${cohort.start_date} and ${cohort.end_date}`;
  const topNote = topStage ? `Top stage: ${topStage}.` : "";
  return `Help me interpret this customer lifecycle funnel. Cohort: ${cohortLabel}. ${topNote} What does the shape tell me about my loyalty program?`;
}

export function CustomerFunnelPage({ upgradeAction }: CustomerFunnelPageProps): ReactNode {
  const { hasPremium, pipes, isLoading: tokenLoading, error: tokenError, retry } = useTinybird();
  const hasFunnelPipe = pipes.includes(PIPES.CUSTOMER_FUNNEL);
  // PLAN_REQUIRED is the base-tier teaser path — fall through to sample mode.
  // Other token errors (NETWORK/SERVICE/AUTH/UNKNOWN) render the error view.
  const isBlockingError = tokenError !== null && tokenError.type !== "PLAN_REQUIRED";
  // Suppress sample mode during the initial token fetch so premium tenants don't see a
  // sample-banner flash before the token arrives.
  const sampleMode = !isBlockingError && !tokenLoading && (!hasPremium || !hasFunnelPipe);

  const [cohort, setCohort] = useState<CohortFilter>({ kind: "all" });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [selectedStageOrder, setSelectedStageOrder] = useState<number | null>(null);

  // Reset stage selection when cohort changes — the selected stage may not exist in the
  // new cohort, and the drill-in panel would render with stale/empty fields.
  useEffect(() => {
    setSelectedStageOrder(null);
  }, [cohort]);

  // Reset compareEnabled when cohort flips to 'all'. The CompareToggle visual is gated
  // by cohort.kind !== 'all', so the toggle "looks" off — but state stays true and
  // would silently re-fire comparison when the user picks a period cohort again.
  useEffect(() => {
    if (cohort.kind === "all") setCompareEnabled(false);
  }, [cohort]);

  const funnel = useCustomerFunnel(cohort, { enabled: !sampleMode && !isBlockingError });

  // Comparison: useComparison only fires when both start_date AND end_date are present.
  // For cohort.kind === 'period', we pre-compute the date range here so the hook gets
  // what it needs (otherwise it would silently no-op).
  const comparisonParams = useMemo(() => cohortToDateRange(cohort) ?? {}, [cohort]);
  const comparison = useComparison<typeof PIPES.CUSTOMER_FUNNEL, CustomerFunnelRow>(
    PIPES.CUSTOMER_FUNNEL,
    comparisonParams,
    compareEnabled && !sampleMode && cohort.kind !== "all"
  );

  const sampleFixture = useMemo(
    () => (sampleMode ? buildSampleCustomerFunnel() : null),
    [sampleMode]
  );

  const data = sampleMode ? (sampleFixture?.data ?? []) : (funnel.data?.data ?? []);

  const isEmpty = isFunnelDataEmpty(data);

  // Gate comparisonData on the same conditions the CompareToggle visual uses so a
  // cohort change to 'all' doesn't leave stale period comparison bars in the viz.
  const comparisonData =
    !sampleMode && compareEnabled && cohort.kind !== "all" ? comparison.previous?.data : undefined;

  const topStage = useMemo(() => {
    const first = data[0];
    if (!first) return null;
    return data.reduce((top, row) => (row.customer_count > top.customer_count ? row : top), first)
      .stage;
  }, [data]);

  const { openWithMessage } = useAiChat();
  const handleAskAi = (): void => {
    openWithMessage(buildAiContext(cohort, topStage));
  };

  const isLoading = tokenLoading || (!sampleMode && funnel.isLoading);

  // The selected stage's row — found once; the detail aside reads its fields.
  const selectedStage = data.find((d) => d.stage_order === selectedStageOrder);

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
        title="Customer Lifecycle Funnel"
        description="How your customers progress through their loyalty journey"
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
                  ? "Ask AI to interpret this funnel"
                  : "Ask AI to interpret this funnel (Premium)"
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

      <CohortFilterControl value={cohort} onChange={setCohort} />

      {isLoading ? (
        <Skeleton className="h-[34rem] w-full rounded-lg" />
      ) : isEmpty ? (
        <div
          className="border-border bg-muted/30 rounded-lg border border-dashed p-12 text-center"
          role="status"
        >
          <p className="text-foreground font-serif text-lg">Your funnel starts here.</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            When your first customers join, they&apos;ll appear in Awareness. As they engage, earn,
            and redeem, they&apos;ll move through the stages — and you&apos;ll see the shape of your
            loyalty program take form.
          </p>
        </div>
      ) : (
        <LifecycleFunnel
          data={data}
          comparisonData={comparisonData}
          selectedStageOrder={selectedStageOrder}
          onSelectStage={setSelectedStageOrder}
        />
      )}

      {selectedStageOrder !== null && (
        <aside
          aria-label={`Stage ${selectedStageOrder} details`}
          className="border-border bg-card rounded-lg border p-4"
        >
          <h2 className="text-foreground font-serif text-base">{selectedStage?.stage} stage</h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm tabular-nums">
            {selectedStage?.customer_count.toLocaleString()} customers ·{" "}
            {selectedStage?.pct_of_total.toFixed(1)}%
          </p>
        </aside>
      )}
    </main>
  );
}
