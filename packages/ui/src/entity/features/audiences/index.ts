/**
 * Customer Audience Components
 *
 * Components for managing customer audiences, segments, and
 * AI-generated THREADS segments with visualization support.
 */

// Types
export {
  AUDIENCE_STANDARD_FIELDS,
  isClickHouseSegment,
  isCustomerList,
  isCustomerSegment,
  isThreadsSegment,
} from "./types.js";
export type {
  AudienceFormData,
  AudienceFormSheetProps,
  AudienceListFilters,
  AudienceStatus,
  BanditStatus,
  ClickHouseConfig,
  ContributingBehavior,
  CustomerAudience,
  CustomerAudienceBase,
  CustomerAudienceType,
  CustomerList,
  CustomerSegment,
  OfferRecommendation,
  SegmentComputationStatus,
  SegmentEngine,
  SegmentHealthStatus,
  SegmentOverlapData,
  SegmentOverlapEntry,
  SegmentVersionStatus,
  SimilarSegmentReference,
} from "./types.js";

// Utilities
export {
  audienceTypeBadgeClasses,
  audienceTypeLabels,
  banditStatusBadgeClasses,
  banditStatusLabels,
  calculateTotalWeight,
  engineBadgeClasses,
  engineDescriptions,
  engineLabels,
  formatBehaviorWeight,
  formatConfidenceScore,
  formatConversionRate,
  formatCronExpression,
  formatLastUpdate,
  formatMemberCount,
  formatMemberCountChange,
  formatOverlapPercentage,
  formatQueryDuration,
  getAudienceMemberCount,
  getAudienceStatus,
  getAudienceTypeLabel,
  getSegmentComputationNote,
  getTopBehaviors,
  isAudienceActive,
  sortBehaviorsByWeight,
} from "./utils.js";

// Components
export { getAudienceColumnsExtended } from "./audience-columns.js";
export { AudienceSkeleton } from "./audience-skeleton.js";
export { AudienceStatusDot, AudienceStatusIndicator } from "./audience-status-indicator.js";
export {
  SEGMENT_VERSION_STATUS_CONFIG,
  SegmentVersionStatusBadge,
} from "./segment-version-status-badge.js";
export { TypedAudienceBadge, TypedAudienceIcon } from "./typed-audience-badge.js";

// Detail and Form (will be added when files exist)
export { AudienceDetail, type AudienceDetailProps } from "./audience-detail.js";
export { AudienceFormSheet } from "./audience-form-sheet.js";

// Segment Expression Layout (presentational)
export {
  SegmentExpressionLayout,
  type CostLevel,
  type PreviewData,
  type SampleCustomer,
  type SegmentExpressionLayoutProps,
} from "./segment-expression-layout.js";

// THREADS Visualization Components
export {
  BanditStatusBadge,
  BanditStatusCard,
  BanditStatusIndicator,
  BehaviorRuleDisplay,
  BehaviorRuleList,
  BehaviorSunburst,
  BehaviorTag,
  ConfidenceScoreBadge,
  ConfidenceScoreBar,
  ConfidenceScoreGauge,
  ExplainabilityPanel,
  ExplainabilitySummary,
  NeuralNetworkGraph,
  NextBestOfferList,
  NextBestOfferPanel,
  OverlapBadge,
  OverlapIndicator,
  SegmentOverlapVisualization,
  SimilarSegmentsCarousel,
  SimilarSegmentsList,
  TopBehaviorsBadges,
  type BanditStatusIndicatorProps,
  type BehaviorRuleDisplayProps,
  type BehaviorSunburstProps,
  type ConfidenceScoreGaugeProps,
  type ExplainabilityPanelProps,
  type NeuralNetworkGraphProps,
  type NextBestOfferPanelProps,
  type SegmentOverlapVisualizationProps,
  type SimilarSegmentsCarouselProps,
} from "./threads/index.js";
