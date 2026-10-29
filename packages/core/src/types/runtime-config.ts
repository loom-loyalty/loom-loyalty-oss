/**
 * Runtime Configuration Types
 *
 * These types define the configuration system for Loom Loyalty Hub:
 * - HubLocalConfig: What developers author in hub.config.ts (Hub-specific settings only)
 * - HubRuntimeConfig: Full config fetched from the API (org settings + local config merged)
 *
 * @see https://github.com/loom-loyalty/loom-loyalty/blob/main/prds/hub-consolidated-prd.md
 */

// ============================================================
// Enums - Avoid Magic Strings
// ============================================================

/**
 * Entity codes for all Loom Loyalty entities.
 * Use these constants instead of magic strings for type safety.
 *
 * @example
 * ```typescript
 * import { EntityCode } from '@loom-loyalty/core';
 *
 * const tierOverride = config.entityOverrides?.[EntityCode.Tier];
 * ```
 */
export const EntityCode = {
  /** Loyalty program customers */
  Customer: "customer",
  /** Membership tiers (Bronze, Silver, Gold, etc.) */
  Tier: "tier",
  /** Achievement badges */
  Badge: "badge",
  /** Goals/targets for customers to complete */
  Target: "target",
  /** Promotional offers */
  Offer: "offer",
  /** Loyalty programs */
  Program: "program",
  /** Partner organizations */
  Partner: "partner",
  /** Point/currency types */
  Currency: "currency",
  /** Event processing rules */
  EventRule: "event-rule",
  /** Transaction records */
  Transaction: "transaction",
  /** Marketing campaigns */
  Campaign: "campaign",
} as const;

/** Type for EntityCode values */
export type EntityCodeValue = (typeof EntityCode)[keyof typeof EntityCode];

/**
 * System component identifiers for specialized Hub components.
 * Use these when registering or overriding system components.
 *
 * @example
 * ```typescript
 * import { SystemComponent } from '@loom-loyalty/core';
 *
 * const customTierList = components[SystemComponent.TierList];
 * ```
 */
export const SystemComponent = {
  /** Tier list with ranking and gradient badges */
  TierList: "tier-list",
  /** Individual tier rank badge */
  TierRankBadge: "tier-rank-badge",
  /** Polymorphic target card (delegates to specific type) */
  EntityTargetCard: "entity-target-card",
  /** Completion-type target card */
  CompletionTargetCard: "completion-target-card",
  /** Counter-type target card */
  CounterTargetCard: "counter-target-card",
  /** Milestone-type target card */
  MilestoneTargetCard: "milestone-target-card",
  /** X-of-Y progression target card */
  XOfYTargetCard: "x-of-y-target-card",
  /** Generic entity list view */
  EntityList: "entity-list",
  /** Generic entity detail view */
  EntityDetail: "entity-detail",
  /** Generic entity edit/create form */
  EntityEdit: "entity-edit",
} as const;

/** Type for SystemComponent values */
export type SystemComponentValue = (typeof SystemComponent)[keyof typeof SystemComponent];

/**
 * Navigation section identifiers for the Hub icon rail.
 * Use these when configuring navigation or determining active sections.
 *
 * @example
 * ```typescript
 * import { NavigationSectionId } from '@loom-loyalty/core';
 *
 * if (sectionId === NavigationSectionId.Programs) {
 *   // Show program-specific navigation
 * }
 * ```
 */
export const NavigationSectionId = {
  /** Home section (labelled "Home"; the id predates the rename) */
  Overview: "overview",
  /** Program structure: programs, currencies, tiers, badges, partners */
  Programs: "programs",
  /** Customer/member management */
  Customers: "customers",
  /** Audience management */
  Audiences: "audiences",
  /** Engagement: event rules, flows, offers, targets */
  Engage: "engage",
  /** Data definitions: data models, metadata, event types */
  Data: "data",
  /** Analytics and reporting */
  Insights: "insights",
  /** Environment workflows and the approval queue */
  Changes: "changes",
  /** @deprecated Offers live in the Engage section. */
  Offers: "offers",
  /** @deprecated Analytics lives in the Insights section. */
  Analytics: "analytics",
  /** @deprecated The Hub has no receipt review section. */
  Receipts: "receipts",
  /** @deprecated Hub organization pages are split across Data and Changes. */
  Organization: "organization",
  /** Settings and configuration */
  Settings: "settings",
} as const;

/** Type for NavigationSectionId values */
export type NavigationSectionIdValue =
  (typeof NavigationSectionId)[keyof typeof NavigationSectionId];

/**
 * Built-in field widget identifiers.
 * Use these when configuring custom widget overrides or matching fields.
 *
 * @example
 * ```typescript
 * import { SystemWidget } from '@loom-loyalty/core';
 *
 * const customWidget = {
 *   match: (field) => field.widget === SystemWidget.Points,
 *   component: CustomPointsWidget,
 * };
 * ```
 */
export const SystemWidget = {
  /** Plain text input */
  Text: "text",
  /** Multi-line text input */
  Textarea: "textarea",
  /** Numeric input */
  Number: "number",
  /** Date picker */
  Date: "date",
  /** Date and time picker */
  DateTime: "datetime",
  /** Single select dropdown */
  Select: "select",
  /** Multi-select dropdown */
  MultiSelect: "multi-select",
  /** Boolean toggle switch */
  Switch: "switch",
  /** Checkbox */
  Checkbox: "checkbox",
  /** Points/currency display with formatting */
  Points: "points",
  /** Monetary currency display */
  Currency: "currency",
  /** Email address input */
  Email: "email",
  /** URL input */
  Url: "url",
  /** Phone number input */
  Phone: "phone",
  /** Color picker */
  Color: "color",
  /** File upload */
  File: "file",
  /** Image upload/display */
  Image: "image",
  /** Rich text editor */
  RichText: "rich-text",
  /** JSON editor */
  Json: "json",
  /** Entity reference (foreign key) */
  EntityRef: "entity-ref",
  /** Tags/labels input */
  Tags: "tags",
  /** Percentage display */
  Percentage: "percentage",
  /** Duration/time period */
  Duration: "duration",
} as const;

/** Type for SystemWidget values */
export type SystemWidgetValue = (typeof SystemWidget)[keyof typeof SystemWidget];

// ============================================================
// UI Settings
// ============================================================

/**
 * Hub UI settings configuration
 */
export interface UISettings {
  /** Show API explorer in the Hub */
  showApiExplorer?: boolean;
  /** Default view mode for entity lists */
  defaultListView?: "table" | "cards";
}

// ============================================================
// Entity Overrides
// ============================================================

/**
 * Entity label override
 */
export interface EntityLabelOverride {
  singular: string;
  plural: string;
}

/**
 * Per-entity override configuration
 */
export interface EntityOverride {
  /** Custom labels for the entity */
  label?: EntityLabelOverride;
  /** Hide this entity from navigation/UI */
  hidden?: boolean;
  /** Make this entity read-only (no create/edit/delete) */
  readonly?: boolean;
  /** Custom icon for the entity (lucide icon name) */
  icon?: string;
}

/**
 * All entity overrides
 */
export type EntityOverrides = Record<string, EntityOverride>;

// ============================================================
// Theme Configuration
// ============================================================

/**
 * Theme color overrides
 */
export interface ThemeOverride {
  /** Primary brand color */
  primaryColor?: string;
  /** Secondary/accent color */
  secondaryColor?: string;
}

// ============================================================
// Custom Components
// ============================================================

/**
 * Custom component configuration
 */
export interface CustomComponentsConfig {
  /** URL to the component manifest JSON */
  manifestUrl: string;
  /** Version string for cache busting */
  version: string;
}

/**
 * Component type determines where it can be used in Hub
 */
export type ComponentType = "widget" | "entity-view" | "dashboard" | "navigation";

/**
 * Field matching criteria for widgets
 */
export interface FieldMatch {
  /** Match fields with these schema types */
  types?: string[];
  /** Match fields whose name matches this regex pattern */
  namePattern?: string;
}

/**
 * Component definition in a manifest
 */
export interface ComponentDefinition {
  /** Component type */
  type: ComponentType;
  /** Human-readable display name */
  displayName: string;
  /** Description of what the component does */
  description?: string;
  /** For widgets: which fields this widget handles */
  fieldMatch?: FieldMatch;
  /**
   * For entity views: which entity this component is for.
   * Use EntityCode constants for type safety.
   * @example entityName: EntityCode.Tier
   */
  entityName?: EntityCodeValue | string;
  /** For entity views: which view type */
  viewType?: "list" | "detail" | "edit";
}

/**
 * Component manifest structure
 */
export interface ComponentManifest {
  /** Manifest version */
  version: string;
  /** When the manifest was built */
  buildDate: string;
  /** URL to the component bundle */
  bundleUrl: string;
  /** Registered components */
  components: Record<string, ComponentDefinition>;
}

/**
 * Props passed to custom widget components
 *
 * Organizations building custom widgets should implement this interface.
 *
 * @example
 * ```typescript
 * import type { WidgetProps } from '@loom-loyalty/core';
 *
 * export function CustomPointsWidget({ value, fieldName, onChange }: WidgetProps) {
 *   return <div>{value} pts</div>;
 * }
 * ```
 */
export interface WidgetProps {
  /** Current field value */
  value: unknown;
  /** Field name from the schema */
  fieldName: string;
  /** Field type from the schema */
  fieldType: string;
  /** Change handler for editable widgets */
  onChange?: (value: unknown) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
}

/**
 * Props passed to custom entity view components
 *
 * Organizations building custom entity views should implement this interface.
 *
 * @example
 * ```typescript
 * import type { EntityViewProps } from '@loom-loyalty/core';
 *
 * export function CustomMemberListView({ data, entityCode, isLoading }: EntityViewProps) {
 *   return <div>Custom list for {entityCode}</div>;
 * }
 * ```
 */
export interface EntityViewProps {
  /** Entity data records */
  data: unknown[];
  /** Entity code (e.g., 'customer', 'tier') */
  entityCode: EntityCodeValue | string;
  /** View type being rendered */
  viewType: "list" | "detail" | "edit";
  /** Loading state */
  isLoading?: boolean;
}

// ============================================================
// WorkOS Configuration
// ============================================================

/**
 * WorkOS authentication configuration
 */
export interface WorkOSConfig {
  /** WorkOS client ID (platform-wide) */
  clientId: string;
  /** Organization-specific WorkOS organization ID */
  organizationId: string;
}

// ============================================================
// Branding Configuration
// ============================================================

/**
 * Organization branding configuration
 */
export interface BrandingConfig {
  /** URL to organization logo */
  logoUrl?: string;
  /** URL to favicon */
  faviconUrl?: string;
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Secondary/accent color (hex) */
  secondaryColor?: string;
}

// ============================================================
// Local Configuration (hub.config.ts)
// ============================================================

/**
 * Local Hub configuration
 *
 * This is what developers author in their hub.config.ts file.
 * Contains only Hub-specific UI settings - organization identity,
 * API config, branding, and features come from the backend.
 *
 * @example
 * ```typescript
 * // hub.config.ts
 * import { defineLocalConfig } from '@loom-loyalty/core';
 *
 * export default defineLocalConfig({
 *   uiSettings: {
 *     showApiExplorer: true,
 *     defaultListView: 'table',
 *   },
 *   entityOverrides: {
 *     customer: {
 *       label: { singular: 'Member', plural: 'Members' },
 *     },
 *     internal_audit: {
 *       hidden: true,
 *     },
 *   },
 *   theme: {
 *     primaryColor: '#6366f1',
 *   },
 * });
 * ```
 */
export interface HubLocalConfig {
  /** UI behavior settings */
  uiSettings?: UISettings;
  /** Per-entity display overrides */
  entityOverrides?: EntityOverrides;
  /** Theme color overrides */
  theme?: ThemeOverride;
  /** Custom component configuration */
  customComponents?: CustomComponentsConfig;
}

// ============================================================
// Runtime Configuration (fetched from the API)
// ============================================================

/**
 * Full Hub runtime configuration
 *
 * This is the complete configuration fetched from the API
 * after authentication. It's assembled by merging:
 * - Organization settings from the backend (identity, branding, features)
 * - Local HubLocalConfig from the customer's hub.config.ts
 *
 * @example
 * ```typescript
 * // Full config fetched from API after authentication
 * const config: HubRuntimeConfig = {
 *   organizationId: 'org_01HXYZ...',
 *   organizationCode: 'acme',
 *   apiEndpoint: 'https://api.loomloyalty.com',
 *   // Optional overrides (providers supply defaults when not specified):
 *   name: 'ACME Corporation',
 *   branding: { primaryColor: '#6366f1' },
 *   features: { analytics: true },
 *   entityOverrides: {
 *     customer: { label: { singular: 'Member', plural: 'Members' } },
 *   },
 * };
 * ```
 */
export interface HubRuntimeConfig {
  // ========================================
  // Organization Identity (required)
  // ========================================

  /** Organization ID */
  organizationId: string;
  /** Organization Environment ID (from JWT claims) */
  organizationEnvironmentId: string;
  /** Organization code (used in subdomain, e.g., "acme" for acme.weave.host) */
  organizationCode: string;

  // ========================================
  // API Configuration (required)
  // ========================================

  /** Weave API endpoint URL */
  apiEndpoint: string;

  // ========================================
  // Domain Configuration (optional)
  // ========================================

  /** Custom domain for the Hub (e.g., "hub.acme.com") */
  customDomain?: string;

  // ========================================
  // Optional Overrides
  // Providers supply defaults when not specified
  // ========================================

  /** Organization display name (defaults to formatted organizationCode) */
  name?: string;
  /** Organization branding (defaults in BrandingProvider) */
  branding?: Partial<BrandingConfig>;
  /** Feature flags (defaults in FeaturesProvider) */
  features?: Record<string, boolean>;
  /** UI behavior settings (defaults in providers) */
  uiSettings?: UISettings;
  /** Per-entity display overrides */
  entityOverrides?: EntityOverrides;
  /** Custom component configuration */
  customComponents?: CustomComponentsConfig;
}

// ============================================================
// Minimal Configuration (initial load before auth)
// ============================================================

/**
 * Minimal Hub configuration for initial load
 *
 * @deprecated No longer used by ConfigProvider. Organization code is resolved
 * client-side from the hostname and full config is fetched from the API after auth.
 * This interface is kept for backwards compatibility but may be removed in a future version.
 */
export interface MinimalHubConfig {
  /** Organization code (used in subdomain, e.g., "acme" for acme.weave.host) */
  organizationCode: string;
  /** API endpoint for loading full config (defaults to standard endpoint) */
  apiEndpoint?: string;
}
