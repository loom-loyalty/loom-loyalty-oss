/**
 * Entity Feature Components
 *
 * Specialized entity components extending the generic entity system with
 * custom visualizations, detail views, form sheets, and column definitions.
 */

// --- Existing specialized components ---

export { TierList, type TierListProps } from "./tier-list.js";
export { TierRankBadge, type TierRankBadgeProps } from "./tier-rank-badge.js";

// Target Cards
export {
  CompletionTargetCard,
  CounterTargetCard,
  EntityTargetCard,
  MilestoneTargetCard,
  XOfYTargetCard,
  calculateProgressPercentage,
  getStatusBadgeClasses,
  getStatusLabel,
  type CompletionTargetCardProps,
  type CounterTargetCardProps,
  type EntityTargetCardProps,
  type MilestoneTargetCardProps,
  type TargetCardInput,
  type TargetProgress,
  type TargetProgressStatus,
  type XOfYTargetCardProps,
} from "./target-cards/index.js";

// --- Badges ---

export { getBadgeColumnsExtended } from "./badges/badge-columns.js";
export { BadgeDetail, type BadgeDetailProps } from "./badges/badge-detail.js";
export { BadgeFormSheet } from "./badges/badge-form-sheet.js";
export { BadgeSkeleton } from "./badges/badge-skeleton.js";
export {
  BADGE_STANDARD_FIELDS,
  type BadgeFormData,
  type BadgeFormSheetProps,
  type BadgeListFilters,
} from "./badges/types.js";

// --- Currencies ---

export { getCurrencyColumnsExtended } from "./currencies/currency-columns.js";
export { CurrencyDetail, type CurrencyDetailProps } from "./currencies/currency-detail.js";
export { CurrencyFormSheet } from "./currencies/currency-form-sheet.js";
export { CurrencySkeleton } from "./currencies/currency-skeleton.js";
export {
  CURRENCY_STANDARD_FIELDS,
  type CurrencyFormData,
  type CurrencyFormPayload,
  type CurrencyFormSheetProps,
  type CurrencyListFilters,
} from "./currencies/types.js";

// --- Tiers ---

export { getDescription, getTierColumnsExtended } from "./tiers/tier-columns.js";
export { TierDetail, type TierDetailProps } from "./tiers/tier-detail.js";
export { TierFormSheet } from "./tiers/tier-form-sheet.js";
export { TierSkeleton } from "./tiers/tier-skeleton.js";
export {
  TIER_STANDARD_FIELDS,
  type TierFormData,
  type TierFormSheetProps,
  type TierListFilters,
} from "./tiers/types.js";

// --- Programs ---

export { getProgramColumnsExtended } from "./programs/program-columns.js";
export { ProgramDetail, type ProgramDetailProps } from "./programs/program-detail.js";
export { ProgramFormSheet } from "./programs/program-form-sheet.js";
export { ProgramSkeleton } from "./programs/program-skeleton.js";
export {
  PROGRAM_STANDARD_FIELDS,
  type ProgramFormData,
  type ProgramFormSheetProps,
  type ProgramListFilters,
} from "./programs/types.js";

// --- Partners ---

export { getPartnerColumnsExtended } from "./partners/partner-columns.js";
export { PartnerDetail, type PartnerDetailProps } from "./partners/partner-detail.js";
export { PartnerFormSheet } from "./partners/partner-form-sheet.js";
export { PartnerSkeleton } from "./partners/partner-skeleton.js";
export {
  PARTNER_STANDARD_FIELDS,
  type PartnerFormData,
  type PartnerFormSheetProps,
  type PartnerListFilters,
} from "./partners/types.js";

// --- Metadata Groups ---

export { getMetadataGroupColumnsExtended } from "./metadata-groups/metadata-group-columns.js";
export {
  MetadataGroupDetail,
  type MetadataGroupDetailProps,
} from "./metadata-groups/metadata-group-detail.js";
export { MetadataGroupFormSheet } from "./metadata-groups/metadata-group-form-sheet.js";
export {
  MetadataGroupMembersSheet,
  type MetadataGroupMember,
  type MetadataGroupMembersSheetProps,
} from "./metadata-groups/metadata-group-members-sheet.js";
export { MetadataGroupSkeleton } from "./metadata-groups/metadata-group-skeleton.js";
export {
  METADATA_GROUP_STANDARD_FIELDS,
  type MetadataGroupFormData,
  type MetadataGroupFormSheetProps,
  type MetadataGroupListFilters,
} from "./metadata-groups/types.js";

// --- Metadata Hierarchies ---

export * from "./metadata-hierarchies/index.js";

// --- Targets ---

export { formatTargetConfig, getTargetColumnsExtended } from "./targets/target-columns.js";
export { TargetDetail, type TargetDetailProps } from "./targets/target-detail.js";
export { TargetFormSheet } from "./targets/target-form-sheet.js";
export { TargetSkeleton } from "./targets/target-skeleton.js";
export {
  GROWTH_ALGORITHM_OPTIONS,
  GROWTH_OPERATOR_OPTIONS,
  TARGET_SCOPE_LABELS,
  TARGET_SCOPE_OPTIONS,
  TARGET_STANDARD_FIELDS,
  TARGET_TYPE_LABELS,
  TARGET_TYPE_OPTIONS,
  type TargetFormData,
  type TargetFormSheetProps,
  type TargetListFilters,
} from "./targets/types.js";

// --- Expiry Rules ---

export {
  formatExpiryConfig,
  getExpiryRuleColumnsExtended,
} from "./expiry-rules/expiry-rule-columns.js";
export { ExpiryRuleDetail, type ExpiryRuleDetailProps } from "./expiry-rules/expiry-rule-detail.js";
export { ExpiryRuleFormSheet } from "./expiry-rules/expiry-rule-form-sheet.js";
export { ExpiryRuleSkeleton } from "./expiry-rules/expiry-rule-skeleton.js";
export {
  EXPIRY_PERIOD_LABELS,
  EXPIRY_PERIOD_OPTIONS,
  EXPIRY_RULE_STANDARD_FIELDS,
  EXPIRY_TYPE_LABELS,
  EXPIRY_TYPE_OPTIONS,
  type ExpiryRuleFormData,
  type ExpiryRuleFormSheetProps,
  type ExpiryRuleListFilters,
} from "./expiry-rules/types.js";

// --- Pending Rules ---

export {
  formatPendingConfig,
  getPendingRuleColumnsExtended,
} from "./pending-rules/pending-rule-columns.js";
export {
  PendingRuleDetail,
  type PendingRuleDetailProps,
} from "./pending-rules/pending-rule-detail.js";
export { PendingRuleFormSheet } from "./pending-rules/pending-rule-form-sheet.js";
export { PendingRuleSkeleton } from "./pending-rules/pending-rule-skeleton.js";
export {
  PENDING_PERIOD_LABELS,
  PENDING_PERIOD_OPTIONS,
  PENDING_RULE_STANDARD_FIELDS,
  PENDING_RULE_TYPE_DESCRIPTIONS,
  PENDING_RULE_TYPE_LABELS,
  PENDING_TYPE_OPTIONS,
  type PendingRuleFormData,
  type PendingRuleFormSheetProps,
  type PendingRuleListFilters,
} from "./pending-rules/types.js";

// --- Event Type Configurations ---

export {
  formatArchivalConfig,
  getEventTypeConfigColumnsExtended,
  resolveEventTypeCode,
  resolveEventTypeLabel,
} from "./event-type-configs/event-type-config-columns.js";
export {
  EventTypeConfigDetailSheet,
  type EventTypeConfigDetailSheetProps,
} from "./event-type-configs/event-type-config-detail-sheet.js";
export {
  EventTypeConfigDetail,
  type EventTypeConfigDetailProps,
} from "./event-type-configs/event-type-config-detail.js";
export { EventTypeConfigFormSheet } from "./event-type-configs/event-type-config-form-sheet.js";
export { EventTypeConfigSkeleton } from "./event-type-configs/event-type-config-skeleton.js";
export {
  EventTypeDependents,
  type EventTypeDependentsProps,
} from "./event-type-configs/event-type-dependents.js";
export {
  EVENT_TYPE_CONFIG_STANDARD_FIELDS,
  type EventTypeAnchor,
  type EventTypeConfigFormData,
  type EventTypeConfigFormSheetProps,
  type EventTypeConfigListFilters,
  type EventTypeVariant,
} from "./event-type-configs/types.js";

// --- Customers (Customer View) ---

export { CustomerHeader, type CustomerHeaderProps } from "./customers/customer-header.js";
export { CustomerDetail, type CustomerDetailProps } from "./customers/customer-view.js";
export {
  EntityLinkButton,
  type EntityLinkButtonProps,
  type EntityLinkLabel,
} from "./customers/entity-link-button.js";
export { EventDetailSheet, type EventDetailSheetProps } from "./customers/event-detail-sheet.js";
export { EventStatusBadge, type EventStatusBadgeProps } from "./customers/event-status-badge.js";
export { ledgerColumns } from "./customers/ledger-columns.js";
export {
  LedgerHistorySheet,
  type LedgerHistorySheetProps,
} from "./customers/ledger-history-sheet.js";
export {
  deriveCouponStatus,
  formatCurrencyValue,
  formatEventTypeLabel,
  generateEventId,
  getActiveTier,
  getCouponUseActions,
  getCustomerInitials,
  getCustomerName,
  getOpenCouponUses,
  getPrimaryEmail,
  getPrimaryPhone,
  hasCouponUseActions,
} from "./customers/types.js";
export type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  CorporateIdentity,
  CouponUseActions,
  CurrencyBalance,
  Customer,
  CustomerBadgeEntry,
  CustomerCouponEntry,
  CustomerCouponStatus,
  CustomerCouponUseEntry,
  CustomerData,
  CustomerEvent,
  CustomerEventAction,
  CustomerEventStatus,
  CustomerEventTag,
  CustomerIdentifier,
  CustomerIdentity,
  CustomerPreference,
  CustomerProgram,
  CustomerSegment,
  CustomerTagEntry,
  CustomerTierEntry,
  EntityNameMap,
  EventTagSource,
  LedgerEntry,
} from "./customers/types.js";

// --- Customers (List/Detail/Form) ---

export {
  getCustomerColumnsExtended,
  type CustomerColumnOptions,
} from "./customers/customer-columns.js";
export { CustomerPreview } from "./customers/customer-detail.js";
export type { CustomerPreviewProps } from "./customers/customer-detail.js";
export { CustomerFormSheet } from "./customers/customer-form-sheet.js";
export { CustomerSearchBar } from "./customers/customer-search-bar.js";
export type { CustomerSearchBarProps } from "./customers/customer-search-bar.js";
export { CustomerSearchEmptyState } from "./customers/customer-search-empty-state.js";
export type { CustomerSearchEmptyStateProps } from "./customers/customer-search-empty-state.js";
export { CustomerSkeleton } from "./customers/customer-skeleton.js";
export {
  CUSTOMER_SEARCH_MIN_CHARS,
  CUSTOMER_STANDARD_FIELDS,
  DEFAULT_CUSTOMER_SEARCH_FILTERS,
  getSDKCustomerName,
  getSDKPrimaryEmail,
  getSDKPrimaryPhone,
} from "./customers/types.js";
export type {
  CustomerFormData,
  CustomerFormSheetProps,
  CustomerListFilters,
  CustomerSearchFilters,
  MatchMode,
} from "./customers/types.js";

// --- Promotions ---

export {
  AllTargetsSheet,
  PromotionRuleCard,
  PromotionRuleDetailSheet,
  PromotionTargetMetrics,
  PromotionsPanel,
  TargetDetailSheet,
} from "./customers/promotions/index.js";
export type {
  AllTargetsSheetProps,
  CustomerPromotionRule,
  CustomerPromotionTarget,
  PromotionRuleCardProps,
  PromotionRuleDetailSheetProps,
  PromotionStatusFilter,
  PromotionTargetCycle,
  PromotionTargetEventDetail,
  PromotionTargetItem,
  PromotionTargetMetricsProps,
  PromotionTargetStatus,
  PromotionTargetType,
  PromotionsPanelProps,
  TargetDetailSheetProps,
} from "./customers/promotions/index.js";

// --- Ledgers ---

export { getLedgerColumnsExtended } from "./ledgers/ledger-columns.js";
export { LedgerDetail, type LedgerDetailProps } from "./ledgers/ledger-detail.js";
export { LedgerSkeleton } from "./ledgers/ledger-skeleton.js";
export { LEDGER_STANDARD_FIELDS, type LedgerListFilters } from "./ledgers/types.js";

// --- Workflows ---

export { ApprovalDetail, type ApprovalDetailProps } from "./workflows/approval-detail.js";
export { getApprovalQueueColumnsExtended } from "./workflows/approval-queue-columns.js";
export {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_OPTIONS,
  STEP_TYPE_LABELS,
  STEP_TYPE_OPTIONS,
  WORKFLOW_STANDARD_FIELDS,
  type Workflow,
  type WorkflowFormData,
  type WorkflowFormSheetProps,
  type WorkflowListFilters,
  type WorkflowRequest,
  type WorkflowRequestEntity,
  type WorkflowRequestStatus,
  type WorkflowStep,
  type WorkflowStepStatus,
  type WorkflowStepType,
} from "./workflows/types.js";
export { getWorkflowColumnsExtended } from "./workflows/workflow-columns.js";
export { WorkflowDetail, type WorkflowDetailProps } from "./workflows/workflow-detail.js";
export { WorkflowFormSheet } from "./workflows/workflow-form-sheet.js";
export { WorkflowSkeleton } from "./workflows/workflow-skeleton.js";
export {
  WorkflowStatusBadge,
  type WorkflowStatusBadgeProps,
} from "./workflows/workflow-status-badge.js";

// --- Event Rules ---

export {
  EventRuleCategoryBadge,
  type EventRuleCategoryBadgeProps,
} from "./event-rules/event-rule-category-badge.js";
export { getEventRuleColumnsExtended } from "./event-rules/event-rule-columns.js";
export { EventRuleDetail, type EventRuleDetailProps } from "./event-rules/event-rule-detail.js";
export { EventRuleSkeleton } from "./event-rules/event-rule-skeleton.js";
export {
  CATEGORY_INFO,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  EVENT_RULE_STANDARD_FIELDS,
  type CategoryInfo,
  type CurrencyTarget,
  type EventRuleCategory,
  type OccurrenceTarget,
} from "./event-rules/types.js";

// --- Metadata Types ---

export {
  CategoryBadge as MetadataTypeCategoryBadge,
  type CategoryBadgeProps as MetadataTypeCategoryBadgeProps,
} from "./metadata-types/category-badge.js";
export { getMetadataTypeColumnsExtended } from "./metadata-types/metadata-type-columns.js";
export {
  MetadataTypeDetail,
  type MetadataTypeDetailProps,
} from "./metadata-types/metadata-type-detail.js";
export { MetadataTypeFormSheet } from "./metadata-types/metadata-type-form-sheet.js";
export {
  MetadataTypeRelationships,
  type MetadataTypeRelationshipActions,
  type MetadataTypeRelationshipsProps,
} from "./metadata-types/metadata-type-relationships.js";
export { MetadataTypeSkeleton } from "./metadata-types/metadata-type-skeleton.js";
export {
  METADATA_TYPE_CATEGORY_LABELS,
  METADATA_TYPE_CATEGORY_OPTIONS,
  METADATA_TYPE_STANDARD_FIELDS,
  type MetadataTypeFormData,
  type MetadataTypeFormSheetProps,
  type MetadataTypeListFilters,
} from "./metadata-types/types.js";

// --- Metadata ---

export { getMetadataColumnsExtended } from "./metadata/metadata-columns.js";
export { MetadataDetail, type MetadataDetailProps } from "./metadata/metadata-detail.js";
export { MetadataFormSheet } from "./metadata/metadata-form-sheet.js";
export {
  MetadataRelationships,
  type MetadataLinkEntry,
  type MetadataRelationshipActions,
  type MetadataRelationshipsProps,
} from "./metadata/metadata-relationships.js";
export { MetadataSkeleton } from "./metadata/metadata-skeleton.js";
export {
  METADATA_STANDARD_FIELDS,
  type MetadataFormData,
  type MetadataFormSheetProps,
  type MetadataListFilters,
  type MetadataSubmitData,
} from "./metadata/types.js";

// --- Data Model Types ---

export { DataModelTypeFormSheet } from "./data-models/data-model-type-form-sheet.js";

// --- Data Models ---

export * from "./data-models/builder/index.js";
export { BulkElementImportDialog } from "./data-models/bulk-element-import.js";
export {
  ClassificationBadge,
  ClassificationStatsBar,
  canDeleteDataModel,
  canEditDataModel,
  getTypeClassification,
  type ClassificationBadgeProps,
  type ClassificationStatsBarProps,
  type DataModelClassification,
} from "./data-models/classification.js";
export { dataModelCodeKey, sameDataModelCode } from "./data-models/code-key.js";
export { getDataModelColumnsExtended } from "./data-models/data-model-columns.js";
export { DataModelDetail, type DataModelDetailProps } from "./data-models/data-model-detail.js";
export { DataModelFormSheet } from "./data-models/data-model-form-sheet.js";
export { DataModelSkeleton } from "./data-models/data-model-skeleton.js";
export { VersionStatusBadge } from "./data-models/detail/version-status-badge.js";
export {
  planElementOperations,
  type DataModelElementOperation,
  type DataModelElementOperations,
} from "./data-models/element-changes.js";
export { ElementDialog, PRIMITIVE_TYPE_CODES } from "./data-models/element-dialog.js";
export { ElementsEditor, type ElementsEditorProps } from "./data-models/elements-editor.js";
export { MetricRoleSelect, type MetricRoleSelectProps } from "./data-models/metric-role-select.js";
export {
  elementToFormData,
  formDataToElement,
  nameToInputAttribute,
  newElementRowKey,
  type BulkElementImportDialogProps,
  type BulkImportRow,
  type CrossEntityImpactEntry,
  type DataModelElementFormData,
  type DataModelFormInitialData,
  type DataModelFormSheetProps,
  type DataModelTypeFormSheetProps,
  type DataModelVersionStatus,
  type ElementDialogProps,
} from "./data-models/types.js";

// --- Audiences ---

export {
  AUDIENCE_STANDARD_FIELDS,
  AudienceDetail,
  AudienceFormSheet,
  AudienceSkeleton,
  AudienceStatusDot,
  AudienceStatusIndicator,
  SEGMENT_VERSION_STATUS_CONFIG,
  SegmentVersionStatusBadge,
  TypedAudienceBadge,
  TypedAudienceIcon,
  formatConfidenceScore,
  formatMemberCount,
  getAudienceColumnsExtended,
  getAudienceMemberCount,
  getAudienceStatus,
  getAudienceTypeLabel,
  getSegmentComputationNote,
  isAudienceActive,
  isClickHouseSegment,
  isCustomerList,
  isCustomerSegment,
  isThreadsSegment,
  type CustomerSegment as AudienceCustomerSegment,
  type AudienceDetailProps,
  type AudienceFormData,
  type AudienceFormSheetProps,
  type AudienceListFilters,
  type AudienceStatus,
  type BanditStatus,
  type ClickHouseConfig,
  type ContributingBehavior,
  type CustomerAudience,
  type CustomerAudienceBase,
  type CustomerAudienceType,
  type CustomerList,
  type OfferRecommendation,
  type SegmentComputationStatus,
  type SegmentEngine,
  type SegmentHealthStatus,
  type SegmentOverlapData,
  type SegmentOverlapEntry,
  type SegmentVersionStatus,
  type SimilarSegmentReference,
} from "./audiences/index.js";

// --- Audiences: Segment Expression Layout ---

export {
  SegmentExpressionLayout,
  type CostLevel,
  type PreviewData,
  type SampleCustomer,
  type SegmentExpressionLayoutProps,
} from "./audiences/index.js";

// --- Audiences: THREADS Visualization ---

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
} from "./audiences/index.js";

// --- Offer partners ---

export * from "./offer-partners/index.js";

// --- Offers ---

export { getOfferColumnsExtended } from "./offers/offer-columns.js";
export { OfferDetail } from "./offers/offer-detail.js";
export { OfferFormSheet } from "./offers/offer-form-sheet.js";
export { OfferSkeleton } from "./offers/offer-skeleton.js";
export { OfferStatusBadge, type OfferStatusBadgeProps } from "./offers/offer-status-badge.js";
export { OfferTypeBadge, type OfferTypeBadgeProps } from "./offers/offer-type-badge.js";
export {
  OFFER_STANDARD_FIELDS,
  type CouponRow,
  type OfferDetailProps,
  type OfferFormData,
  type OfferFormSheetProps,
  type OfferListFilters,
  type OfferRecord,
} from "./offers/types.js";

// --- Coupons ---

export { getCouponColumnsExtended } from "./coupons/coupon-columns.js";
export { CouponDetail } from "./coupons/coupon-detail.js";
export { CouponFormSheet } from "./coupons/coupon-form-sheet.js";
export { CouponSkeleton } from "./coupons/coupon-skeleton.js";
export { CouponStatusBadge, type CouponStatusBadgeProps } from "./coupons/coupon-status-badge.js";
export { COUPON_STANDARD_FIELDS } from "./coupons/types.js";
export type {
  CouponDetailProps,
  CouponFormData,
  CouponFormSheetProps,
  CouponListFilters,
} from "./coupons/types.js";

// --- Webhooks ---

export { SubscriptionChecklist } from "./webhooks/subscription-checklist.js";
export {
  TransformAiBuilder,
  type TransformAiBuilderProps,
} from "./webhooks/transform-ai-builder.js";
export {
  WEBHOOK_STANDARD_FIELDS,
  type SubscriptionChecklistProps,
  type WebhookAttemptDetailProps,
  type WebhookConnectorOption,
  type WebhookDetailProps,
  type WebhookEndpoint,
  type WebhookFormData,
  type WebhookFormSheetProps,
  type WebhookListFilters,
  type WebhookMessage,
  type WebhookMessageLogProps,
} from "./webhooks/types.js";
export { WebhookAttemptDetail } from "./webhooks/webhook-attempt-detail.js";
export { getWebhookColumnsExtended } from "./webhooks/webhook-columns.js";
export { WebhookDetail } from "./webhooks/webhook-detail.js";
export { WebhookFormSheet } from "./webhooks/webhook-form-sheet.js";
export { WebhookMessageLog } from "./webhooks/webhook-message-log.js";
export { WebhookSkeleton } from "./webhooks/webhook-skeleton.js";

// --- Devices ---

export {
  DeviceClaimFormSheet,
  type CreatedLocation,
  type DeviceClaimFormSheetProps,
} from "./devices/device-claim-form-sheet.js";

// --- Customers (Tags) ---

export { CustomerTagList, type CustomerTagListProps } from "./customers/customer-tag-list.js";

// --- Customers (Contact & Preference Components) ---

export {
  AudienceMembershipFormSheet,
  type AudienceMembershipFormSheetProps,
} from "./customers/audience-membership-form-sheet.js";
export {
  AudienceMembershipList,
  type AudienceMembershipListProps,
} from "./customers/audience-membership-list.js";
export {
  ContactAddressFormSheet,
  type ContactAddressFormSheetProps,
} from "./customers/contact-address-form-sheet.js";
export {
  ContactAddressList,
  type ContactAddressListProps,
} from "./customers/contact-address-list.js";
export {
  ContactEmailFormSheet,
  type ContactEmailFormSheetProps,
} from "./customers/contact-email-form-sheet.js";
export { ContactEmailList, type ContactEmailListProps } from "./customers/contact-email-list.js";
export {
  ContactPhoneFormSheet,
  type ContactPhoneFormSheetProps,
} from "./customers/contact-phone-form-sheet.js";
export { ContactPhoneList, type ContactPhoneListProps } from "./customers/contact-phone-list.js";
export {
  IdentifierFormSheet,
  type IdentifierFormSheetProps,
} from "./customers/identifier-form-sheet.js";
export { IdentifierList, type IdentifierListProps } from "./customers/identifier-list.js";
export {
  PreferenceFormSheet,
  type PreferenceFormSheetProps,
} from "./customers/preference-form-sheet.js";
export { PreferenceList, type PreferenceListProps } from "./customers/preference-list.js";

// --- Customers (Mutation Form Sheets) ---

export {
  AssignBadgeFormSheet,
  type AssignBadgeFormSheetProps,
} from "./customers/assign-badge-form-sheet.js";
export {
  AssignTierFormSheet,
  type AssignTierFormSheetProps,
} from "./customers/assign-tier-form-sheet.js";
export {
  CustomerMergeHistory,
  CustomerMergedBanner,
  type CustomerMergeHistoryEntry,
  type CustomerMergeHistoryProps,
  type CustomerMergedBannerProps,
} from "./customers/customer-merge-history.js";
export {
  CustomerMergeSheet,
  type CustomerMergeCandidate,
  type CustomerMergeSelection,
  type CustomerMergeSheetProps,
} from "./customers/customer-merge-sheet.js";
export {
  EnrollmentFormSheet,
  type EnrollmentFormSheetProps,
} from "./customers/enrollment-form-sheet.js";
export {
  IssueCouponFormSheet,
  type IssueCouponFormSheetProps,
} from "./customers/issue-coupon-form-sheet.js";
export {
  RecordCouponUseSheet,
  type RecordCouponUseSheetProps,
} from "./customers/record-coupon-use-sheet.js";
// Record activity: the customer-care event path for activities with no sheet
export {
  ActivityDescriptionBox,
  ActivityDetailsForm,
  ActivityPicker,
  CorrectActivitySheet,
  RecordActivityCheckPanel,
  RecordActivityModal,
  type ActivityDescriptionBoxProps,
  type ActivityDetailField,
  type ActivityDetailValue,
  type ActivityDetailValues,
  type ActivityDetailsFormProps,
  type ActivityFieldErrors,
  type ActivityPickerProps,
  type CareActivityOption,
  type CorrectActivitySheetProps,
  type EarlierRecordWarning,
  type RecordActivityCheckPanelProps,
  type RecordActivityModalProps,
  type RecordedActivityAction,
  type ReversalOutcome,
} from "./customers/record-activity/index.js";

// Patterns (preview): discovered segments, member summaries, lookalikes
export * from "./patterns/index.js";
