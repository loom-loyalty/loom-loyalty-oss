/**
 * API types for Weave Platform data model endpoints.
 *
 * These types match the Platform API's /data-models endpoints.
 */

/**
 * Localized description object used in API responses.
 */
export interface LocalizedDescription {
  en?: string;
  [locale: string]: string | undefined;
}

/**
 * Data model status in the Weave platform.
 */
export type DataModelStatus = "DRAFT" | "PUBLISHED";

/**
 * Data model type information from the API.
 */
export interface ApiDataModelType {
  code: string;
  name: string;
  description?: LocalizedDescription;
}

/**
 * Data model element (field) from the API.
 */
export interface ApiDataModelElement {
  /** Attribute name in input payloads */
  inputAttribute?: string;
  /** Example value for input */
  inputExample?: string;
  /** Attribute name in output payloads */
  outputAttribute?: string;
  /** Example value for output */
  outputExample?: string;
  /** Display name */
  name: string;
  /** Localized description */
  description?: LocalizedDescription;
  /** Weave type reference (e.g., STRING, INTEGER, METADATA) */
  typeReference: string;
  /** Metadata type code (for METADATA typeReference) */
  metadataType?: string;
  /** Metadata type category (for METADATA typeReference) */
  metadataTypeCategory?: string;
  /** Entity type (for ENTITY_ID typeReference) */
  entityType?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field contains sensitive data */
  sensitive?: boolean;
  /** Whether the field is system-managed */
  system?: boolean;
  /** Whether the field is an array */
  array?: boolean;
  /** JSON Schema for additional validation */
  jsonSchema?: Record<string, unknown> | null;
}

/**
 * Complete data model from the API.
 */
export interface ApiDataModel {
  /** Unique identifier */
  dataModelId: string;
  /** Type information */
  type: ApiDataModelType;
  /** Current status */
  status: DataModelStatus;
  /** Version number */
  version: number;
  /** Field elements */
  elements: ApiDataModelElement[];
  /** Cross-field JSON Schema */
  jsonSchema?: Record<string, unknown>;
  /** Created timestamp */
  createdAt?: string;
  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Input for creating a new data model.
 */
export interface CreateDataModelInput {
  type: ApiDataModelType;
  elements: ApiDataModelElement[];
  jsonSchema?: Record<string, unknown>;
}

/**
 * Input for updating an existing data model.
 */
export interface UpdateDataModelInput {
  type?: Partial<ApiDataModelType>;
  elements?: ApiDataModelElement[];
  jsonSchema?: Record<string, unknown>;
}

/**
 * Input for creating a new version from a published model.
 */
export interface CreateDataModelVersionInput {
  sourceDataModelId: string;
}

/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors?: Array<{ code: number; message: string }>;
}

/**
 * Paginated API response.
 */
export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  errors?: Array<{ code: number; message: string }>;
}

/**
 * Result of a push operation.
 */
export interface PushResult {
  action: "created" | "updated" | "versioned";
  model: ApiDataModel;
}

// ============================================================
// Package installations (tenant manifests)
// ============================================================

/**
 * What applying a manifest does to one record. Known values are CREATE, ADOPT, UPDATE, UNCHANGED,
 * CONFLICT and BLOCKED; a newer Platform may send others, so this stays a string.
 */
export type PackageInstallAction = string;

export interface PackageInstallPlanRecord {
  /** The record's kind, such as TIER or EVENT_RULE */
  kind: string;
  code: string;
  action: PackageInstallAction;
  /** Why, for a CONFLICT, BLOCKED or an UPDATE */
  reason?: string | null;
}

export interface PackageInstallPlan {
  packageCode: string;
  version?: string;
  contentHash?: string;
  records: PackageInstallPlanRecord[];
}

/** A workflow request `--env` opened, one per type of record. */
export interface PackagePromotion {
  entityType: string;
  entityCount: number;
  workflowRequestId?: string | null;
  /** PENDING when opened; FAILED when it could not be, in which case nothing after it was opened */
  status?: string | null;
  message?: string | null;
}

export interface PackageInstallation {
  packageInstallationId: string;
  packageCode: string;
  version?: string;
  contentHash?: string;
  status?: string;
  /** For a manifest, `record:<KIND>:<code>` → the id of each record it manages */
  resources?: Record<string, unknown> | null;
}

export interface PackageInstallationResult {
  packageCode: string;
  dryRun: boolean;
  applied: boolean;
  conflicted: boolean;
  installation?: PackageInstallation | null;
  promotions?: PackagePromotion[];
  packages: PackageInstallPlan[];
}

export interface InstallManifestInput {
  code: string;
  manifest: unknown;
  dryRun: boolean;
  /** The organization environment code to promote into through its approval workflow */
  targetEnvironmentCode?: string;
}

/** `GET /package-installations/manifest-export`: the organization's live configuration as a manifest. */
export interface PackageManifestExport {
  /** The manifest; a section with no records is absent */
  manifest: Record<string, unknown>;
  /** What the export left out or flagged, such as a section the caller can't read or an unpublished draft */
  warnings?: string[];
}

export interface ExportManifestInput {
  /** The manifest's code */
  code: string;
  /** The sections to fill */
  sections: readonly string[];
  /** One program's code: that program and everything it uses */
  program?: string;
}

// ============================================================
// Environment workflow requests
// ============================================================

export interface WorkflowRequestEntity {
  entityType: string;
  entityId: string;
  entityName?: string;
  enabledInEnvironment?: { organizationEnvironmentId?: string; environmentCode?: string } | null;
}

export interface WorkflowRequest {
  environmentWorkflowRequestId: string;
  status: string;
  entities?: WorkflowRequestEntity[] | null;
  requestedDateTime?: string | null;
}

/** A Platform page, as `/workflow-requests` returns it under `data`. */
export interface PlatformPage<T> {
  content?: T[];
  totalPages?: number;
  pageNumber?: number;
}
