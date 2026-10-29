// Infrastructure
export { ChartContainer } from "./chart-container";
export { ChartEmpty } from "./chart-empty";
export { ChartError } from "./chart-error";
export { ChartExploreLink, type ChartExploreLinkProps } from "./chart-explore-link";
export { ChartExportButton } from "./chart-export-button";
export { ChartSkeleton } from "./chart-skeleton";

// Charts
export { ActivityTable } from "./activity-table";
export { AnalyticsErrorBanner } from "./analytics-error-banner";
export { AnalyticsUpgradeBanner } from "./analytics-upgrade-banner";
export { BarRanking, type BarRankingItem } from "./bar-ranking";
export { DashboardSummaryCards } from "./dashboard-summary-cards";
export { DecileDistribution } from "./decile-distribution";
export { DistributionChart, type DistributionDatum } from "./distribution-chart";
export { LifecycleFunnel } from "./lifecycle-funnel";
export { LockedPremiumSection } from "./locked-premium-section";
export { PremiumLockedCard, type PremiumLockedCardProps } from "./premium-locked-card";
export { TimeSeriesChart } from "./time-series-chart";

// Funnel math (exported for tests + downstream reuse)
export { MIN_SEGMENT, SELECTED_MULTIPLIER, funnelRowHeights, funnelWidths } from "./funnel-sizing";

// Controls
export { CompareToggle } from "./compare-toggle";
export { CurrencySelect } from "./currency-select";
export { DateRangePicker } from "./date-range-picker";
export { GranularityToggle } from "./granularity-toggle";

// Spindle SQL Workbench
export { AskAiAssistant, type AskAiAssistantProps } from "./ask-ai-assistant";
export { applyChartShape, toChartShape } from "./chart-shape";
export {
  CHART_SHAPE_VERSION,
  type AppliedChartShape,
  type ChartShape,
  type ChartShapeChoice,
} from "./chart-shape-types";
export {
  MAX_BAR_ROWS,
  MAX_PIE_SLICES,
  classifyColumn,
  inferVisualization,
  toNumber,
  type ColumnRole,
  type VizColumn,
  type VizKind,
  type VizPlan,
} from "./infer-visualization";
export { QueryResultsTable, type QueryResultsTableProps } from "./query-results-table";
export { ResultChart, type ResultChartProps } from "./result-chart";
export { ResultVisualization, type ResultVisualizationProps } from "./result-visualization";
export { SavedQueriesPanel } from "./saved-queries-panel";
export { SchemaBrowser } from "./schema-browser";
export { SqlEditor } from "./sql-editor";

// Sample Data
export { buildSampleCustomerFunnel } from "./sample-customer-funnel";
export { buildSampleCustomerRevenueDecile } from "./sample-customer-revenue-decile";
export * from "./sample-data";
export { SampleDataBanner } from "./sample-data-banner";
