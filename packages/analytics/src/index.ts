/**
 * @loom-loyalty/analytics
 *
 * TinyBird analytics data layer for Loom Loyalty applications.
 */
export { createAnalyticsTokenFetcher, type AnalyticsSdkFetcher } from "./auth";
export {
  DATE_PRESETS,
  DEFAULT_STALE_TIMES,
  GRANULARITY_OPTIONS,
  formatCompactNumber,
  getDefaultDateRange,
} from "./constants";
export {
  MetricRoleToggle,
  RevenueDecilesPage,
  ScopeToggle,
  type RevenueDecilesPageProps,
} from "./deciles";
export * from "./drilldown";
export { CohortFilterControl, CustomerFunnelPage, type CustomerFunnelPageProps } from "./funnel";
export * from "./hooks";
export { AnalyticsOverview } from "./overview";
export * from "./pipes";
export { TinybirdProvider, useTinybird } from "./provider";
export { QUERY_TEMPLATES, type QueryTemplate } from "./query-templates";
export * from "./types";
export {
  aggregateCurrencyTrendByPeriod,
  currencyValue,
  listCurrencyCodes,
  primaryCurrencyCode,
  sumCurrencyMap,
} from "./utils";
