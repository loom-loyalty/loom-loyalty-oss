/**
 * Customer Audience Types
 *
 * Supports two audience types:
 * - CUSTOMER_LIST: Static, manually uploaded customer collections
 * - CUSTOMER_SEGMENT: Dynamic segments with two engine options:
 *   - CLICKHOUSE: Human-defined rule-based queries
 *   - THREADS: AI-generated graph clustering
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { ReactNode } from "react";
import type { Expression } from "../../../expressions/types.js";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";
import type { EnabledInEnvironment } from "../../environment-workflow/environment-status-column.js";

// ============================================================================
// Enums and Constants
// ============================================================================

export type CustomerAudienceType = "CUSTOMER_LIST" | "CUSTOMER_SEGMENT";

export type SegmentEngine = "CLICKHOUSE" | "THREADS";

export type BanditStatus = "exploring" | "optimized";

export type AudienceStatus = "active" | "inactive" | "archived" | "scheduled";

/**
 * Lifecycle status of a CustomerSegment's expression version.
 *
 * The SDK types `versionStatus` as plain `string` because the OpenAPI spec
 * doesn't declare an enum constraint (see CustomerSegment.versionStatus).
 * This local union narrows it for UI use. Unlike DataModel's four-value
 * lifecycle (DRAFT/PUBLISHED/PAUSED/ARCHIVED), a segment only ever has two:
 * a segment is either an editable DRAFT that has never been computed, or a
 * PUBLISHED version that's live and scheduled for analytics computation.
 */
export type SegmentVersionStatus = "DRAFT" | "PUBLISHED";

/**
 * Computed health status of a CustomerSegment based on computation freshness.
 * Also typed as plain `string` on the wire; narrowed here for UI use.
 */
export type SegmentHealthStatus = "PENDING" | "HEALTHY" | "STALE" | "CRITICAL";

/**
 * Where a PUBLISHED segment's membership computation stands. The scheduled
 * computation job moves a segment PENDING -> COMPUTING -> COMPLETED (or
 * FAILED). A segment that has never finished a run has no member count yet.
 */
export type SegmentComputationStatus = "PENDING" | "COMPUTING" | "COMPLETED" | "FAILED";

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base interface for all customer audiences.
 * Uses inline types instead of platform-specific imports:
 * - string for ISO date-time values
 * - Record<string, string> for localized strings
 */
export interface CustomerAudienceBase {
  // Identity
  customerAudienceId: string;
  code: string;
  name: string;
  description?: Record<string, string>;

  // Type Discrimination
  type: CustomerAudienceType;

  // Membership Event Triggers
  triggerOnEnter?: boolean;
  triggerOnExit?: boolean;

  // Validity Period
  durationPeriod?: {
    fixedDurationDateTimePeriod?: {
      startDateTime: string;
      endDateTime?: string;
    };
  };

  // Multi-Tenancy & Environment
  enabledInEnvironments?: EnabledInEnvironment[];

  // Additional Properties
  properties?: Record<string, unknown>;

  // Audit Fields
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Customer List Types
// ============================================================================

/**
 * Static customer list with manually managed membership
 */
export interface CustomerList extends CustomerAudienceBase {
  type: "CUSTOMER_LIST";
  customerListId: string;
  memberCount?: number;
}

// ============================================================================
// Customer Segment Types
// ============================================================================

/**
 * Dynamic segment with engine-based membership determination
 */
export interface CustomerSegment extends CustomerAudienceBase {
  type: "CUSTOMER_SEGMENT";
  customerSegmentId: string;
  engine: SegmentEngine;
  engineConfig: ClickHouseConfig | ThreadsConfig;
  /** Expression tree for ClickHouse segments (returned by API, stored on create/edit) */
  segmentExpression?: Expression | null;
  currentMemberCount?: number;
  /**
   * Version number of the segment, incremented on expression or composition
   * changes. Required by the publish endpoint (`PUT
   * /customer-audiences/{id}/versions/{version}`) — always read this from the
   * fetched entity rather than assuming "1".
   */
  version?: number;
  /**
   * DRAFT segments are never scheduled for analytics computation (segment
   * membership) until published. CUSTOMER_LIST has no equivalent field —
   * only CustomerSegment carries a version lifecycle.
   */
  versionStatus?: SegmentVersionStatus;
  /** Computed health status based on computation freshness. */
  healthStatus?: SegmentHealthStatus;
  /**
   * Member count from the segment's last completed computation. Null or
   * absent until the computation job has finished its first run, which is
   * different from a computed count of 0.
   */
  lastCardinality?: number | null;
  /** When the last computation finished (ISO date-time). */
  lastComputedDateTime?: string | null;
  /** Where the segment's membership computation stands. */
  computationStatus?: SegmentComputationStatus;
}

/**
 * Configuration for rule-based segments using ClickHouse queries
 */
export interface ClickHouseConfig {
  engine: "CLICKHOUSE";

  // Query Definition
  queryDefinition: string;
  queryVersion?: string;

  // Execution Settings
  refreshInterval?: string; // Cron expression
  lastQueryRun?: string;
  lastQueryDuration?: number; // Milliseconds
  lastRefreshAt?: string;

  // Results
  memberCount?: number;
  currentMemberCount?: number;
  lastMemberCountChange?: number;
}

/**
 * Configuration for AI-generated segments using graph clustering
 */
export interface ThreadsConfig {
  engine: "THREADS";

  // AI Generation Metadata
  aiGeneratedName: string;
  confidenceScore: number; // 0.0-1.0
  lastClusterUpdate: string;
  clusterVersion?: string;

  // Seed Behaviors (used for AI generation)
  seedBehaviors: string[];
  targetSizeHint?: number;

  // Explainability
  contributingBehaviors: ContributingBehavior[];
  explainabilityRules: string[];

  // Relationships
  similarSegments: SimilarSegmentReference[];
  segmentOverlap?: SegmentOverlapData;

  // Next-Best-Offer Integration
  offerRecommendations: OfferRecommendation[];
  banditStatus: BanditStatus;
  explorationInteractions: number;

  // Lifecycle
  archivedAt?: string;

  // Results
  memberCount?: number;
  currentMemberCount?: number;
}

// ============================================================================
// Supporting Types - Explainability
// ============================================================================

/**
 * Behavior that contributes to THREADS segment definition
 */
export interface ContributingBehavior {
  behaviorTag: string;
  behaviorCategory: string;
  contributionWeight: number; // 0.0-1.0
  description: string;
  sampleCount: number;
  exampleValues?: string[];
}

/**
 * Reference to a related segment
 */
export interface SimilarSegmentReference {
  customerAudienceId: string;
  code: string;
  name: string;
  type: CustomerAudienceType;
  engine?: SegmentEngine;
  similarityScore: number; // 0.0-1.0
  overlapPercentage?: number;
}

/**
 * Overlap analysis with other segments
 */
export interface SegmentOverlapData {
  totalCustomers: number;
  segments: SegmentOverlapEntry[];
}

export interface SegmentOverlapEntry {
  customerAudienceId: string;
  code: string;
  name: string;
  type: CustomerAudienceType;
  overlapCount: number;
  overlapPercentage: number;
}

// ============================================================================
// Supporting Types - Next Best Offer
// ============================================================================

/**
 * AI-suggested offer for THREADS segments
 */
export interface OfferRecommendation {
  offerTypeCode: string;
  offerTypeName: string;
  confidenceScore: number; // 0.0-1.0
  expectedConversionRate: number;
  historicalConversionRate?: number;
  isPinned: boolean;
  lastUpdated: string;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Union type for any customer audience
 */
export type CustomerAudience = CustomerList | CustomerSegment;

// ============================================================================
// Type Guards
// ============================================================================

export function isCustomerList(audience: CustomerAudience): audience is CustomerList {
  return audience.type === "CUSTOMER_LIST";
}

export function isCustomerSegment(audience: CustomerAudience): audience is CustomerSegment {
  return audience.type === "CUSTOMER_SEGMENT";
}

export function isClickHouseSegment(
  audience: CustomerAudience
): audience is CustomerSegment & { engineConfig: ClickHouseConfig } {
  return isCustomerSegment(audience) && audience.engine === "CLICKHOUSE";
}

export function isThreadsSegment(
  audience: CustomerAudience
): audience is CustomerSegment & { engineConfig: ThreadsConfig } {
  return isCustomerSegment(audience) && audience.engine === "THREADS";
}

// ============================================================================
// Request Types - Create
// ============================================================================

/**
 * Base request for creating any customer audience
 */
interface CreateCustomerAudienceBaseRequest {
  code: string;
  name: string;
  description?: Record<string, string>;
  durationPeriod?: {
    fixedDurationDateTimePeriod?: {
      startDateTime: string;
      endDateTime?: string;
    };
  };
  enabledInEnvironments?: EnabledInEnvironment[];
  triggerOnEnter?: boolean;
  triggerOnExit?: boolean;
  properties?: Record<string, unknown>;
}

/**
 * Request for creating a customer list
 */
export interface CreateCustomerListRequest extends CreateCustomerAudienceBaseRequest {
  type: "CUSTOMER_LIST";
}

/**
 * Request for creating a ClickHouse segment
 */
export interface CreateClickHouseSegmentRequest extends CreateCustomerAudienceBaseRequest {
  type: "CUSTOMER_SEGMENT";
  engine: "CLICKHOUSE";
  clickHouseConfig: {
    queryDefinition: string;
    refreshInterval?: string;
  };
}

/**
 * Request for creating a THREADS segment
 */
export interface CreateThreadsSegmentRequest extends CreateCustomerAudienceBaseRequest {
  type: "CUSTOMER_SEGMENT";
  engine: "THREADS";
  threadsConfig?: {
    seedBehaviors?: string[];
    targetSize?: number;
  };
}

/**
 * Union type for create requests
 */
export type CreateCustomerAudienceRequest =
  | CreateCustomerListRequest
  | CreateClickHouseSegmentRequest
  | CreateThreadsSegmentRequest;

// ============================================================================
// Request Types - Update
// ============================================================================

/**
 * Base request for updating any customer audience
 */
interface UpdateCustomerAudienceBaseRequest {
  name?: string;
  description?: Record<string, string>;
  durationPeriod?: {
    fixedDurationDateTimePeriod?: {
      startDateTime: string;
      endDateTime?: string;
    };
  };
  enabledInEnvironments?: EnabledInEnvironment[];
  triggerOnEnter?: boolean;
  triggerOnExit?: boolean;
  properties?: Record<string, unknown>;
}

/**
 * Request for updating a customer list
 */
export interface UpdateCustomerListRequest extends UpdateCustomerAudienceBaseRequest {
  // No additional fields - all base fields are editable
}

/**
 * Request for updating a ClickHouse segment
 */
export interface UpdateClickHouseSegmentRequest extends UpdateCustomerAudienceBaseRequest {
  clickHouseConfig?: {
    queryDefinition?: string;
    refreshInterval?: string;
  };
}

/**
 * Request for updating a THREADS segment
 * Note: Most AI-generated fields are read-only
 */
export interface UpdateThreadsSegmentRequest extends UpdateCustomerAudienceBaseRequest {
  // Only isPinned can be updated for offer recommendations
  pinnedOffers?: string[]; // Array of offer codes to pin
}

/**
 * Union type for update requests
 */
export type UpdateCustomerAudienceRequest =
  | UpdateCustomerListRequest
  | UpdateClickHouseSegmentRequest
  | UpdateThreadsSegmentRequest;

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Filter criteria for listing customer audiences
 */
export interface CustomerAudienceFilters {
  type?: CustomerAudienceType;
  engine?: SegmentEngine;
  status?: AudienceStatus;
  search?: string;
  minConfidence?: number; // For THREADS segments
  maxConfidence?: number;
}

// ============================================================================
// Form Types
// ============================================================================

export interface AudienceFormData {
  name: string;
  code: string;
  description?: Record<string, string>;
  type: CustomerAudienceType;
  triggerOnEnter?: boolean;
  triggerOnExit?: boolean;
  engine?: SegmentEngine;
  /** Expression tree for Customer Segment type (replaces queryDefinition) */
  segmentExpression?: Expression | null;
  /** Engine-specific configuration nested for API compatibility */
  engineConfig?: {
    // ClickHouse
    queryDefinition?: string;
    refreshInterval?: string;
    // THREADS
    seedBehaviors?: string[];
    targetSizeHint?: number;
  };
}

export interface AudienceFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: CustomerAudience;
  onSubmit: (data: AudienceFormData) => void | Promise<void>;
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /** Render slot for the segment expression builder panel (data-connected, provided by the app) */
  renderSegmentBuilder?: (props: {
    expression: Expression | null;
    onChange: (expression: Expression | null) => void;
    disabled?: boolean;
    /** RAW persisted expression (pre-normalize) — feeds the migration notice. */
    rawExpression?: Expression | null;
    /** Reports the segment builder's current validity up to the outer Save gate. */
    onValidityChange?: (isValid: boolean) => void;
  }) => ReactNode;
  /** Runtime UI schema (for rendering tenant-extension fields). */
  schema?: UIEntitySchema;
  /** Names of extended (tenant-defined) fields beyond the standard audience fields. */
  extendedFields?: string[];
}

export interface AudienceListFilters {
  type?: CustomerAudienceType;
  engine?: SegmentEngine;
  search?: string;
}

// ============================================================================
// Standard Fields
// ============================================================================

export const AUDIENCE_STANDARD_FIELDS = [
  "name",
  "code",
  "type",
  "description",
  "customerAudienceId",
  "durationPeriod",
  "triggerOnEnter",
  "triggerOnExit",
  "enabledInEnvironments",
  "properties",
  "createdAt",
  "updatedAt",
] as const;
