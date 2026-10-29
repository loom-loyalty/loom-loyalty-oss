/**
 * Structurally matches CustomerFunnelRow in @loom-loyalty/analytics, declared
 * inline here to break the analytics → ui → analytics import cycle (UI primitives
 * are consumed by the analytics package's page components, so importing the
 * type back from analytics would form a build-time cycle). Consumers that have
 * the analytics types pick up the compatible shape via structural typing.
 */
type SampleLifecycleStage =
  | "Awareness"
  | "Engagement"
  | "Conversion"
  | "Retention"
  | "Loyalty"
  | "Advocacy"
  | "Support"
  | "Lapse"
  | "Inactive";

interface SampleCustomerFunnelRow {
  stage_order: number;
  stage: SampleLifecycleStage;
  customer_count: number;
  pct_of_total: number;
}

/**
 * Sample funnel data for base-tier teaser mode. The shape is intentionally
 * "healthy diamond" so operators see what a good program looks like:
 * wide top → narrowing toward Advocacy → widening dormancy tail.
 *
 * Numbers are deterministic (no randomness) for SSR safety and snapshot stability.
 * No brand param because the 9 stages are fixed enums from the pipe — if a
 * future copy variant needs the tenant's currency name, add it then (YAGNI).
 */
export function buildSampleCustomerFunnel(): {
  data: SampleCustomerFunnelRow[];
  rows: number;
  rows_before_limit_at_least: number;
  meta: never[];
  statistics: { elapsed: number; rows_read: number; bytes_read: number };
} {
  const stages: SampleCustomerFunnelRow[] = [
    { stage_order: 1, stage: "Awareness", customer_count: 5200, pct_of_total: 33.5 },
    { stage_order: 2, stage: "Engagement", customer_count: 3100, pct_of_total: 20.0 },
    { stage_order: 3, stage: "Conversion", customer_count: 1900, pct_of_total: 12.2 },
    { stage_order: 4, stage: "Retention", customer_count: 1100, pct_of_total: 7.1 },
    { stage_order: 5, stage: "Loyalty", customer_count: 520, pct_of_total: 3.4 },
    { stage_order: 6, stage: "Advocacy", customer_count: 210, pct_of_total: 1.4 },
    { stage_order: 7, stage: "Support", customer_count: 640, pct_of_total: 4.1 },
    { stage_order: 8, stage: "Lapse", customer_count: 1180, pct_of_total: 7.6 },
    { stage_order: 9, stage: "Inactive", customer_count: 1670, pct_of_total: 10.7 },
  ];
  return {
    data: stages,
    rows: stages.length,
    rows_before_limit_at_least: stages.length,
    meta: [],
    statistics: { elapsed: 0.01, rows_read: stages.length, bytes_read: 800 },
  };
}
