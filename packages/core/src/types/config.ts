/**
 * Configuration Types
 * Hub configuration schema with entity and UI definitions
 */

import type * as React from "react";
import type { PluginDefinition } from "./plugin";

/**
 * API configuration
 */
export interface ApiConfig {
  /** API endpoint URL */
  endpoint: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers to include */
  headers?: Record<string, string>;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Auth provider type */
  provider: "workos" | "custom";
  /** Client ID for auth provider */
  clientId?: string;
  /** Redirect URI after authentication */
  redirectUri?: string;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Entity field configuration
 */
export interface EntityFieldConfig {
  /** Custom widget to use */
  widget?: string;
  /** Override label */
  label?: string;
  /** Field is hidden */
  hidden?: boolean;
  /** Permission required to view/edit */
  permission?: string;
}

/**
 * Entity list view configuration
 */
export interface EntityListConfig {
  /** Columns to display */
  columns?: string[];
  /** Default sort */
  defaultSort?: { field: string; order: "asc" | "desc" };
  /** Available filters */
  filters?: string[];
  /** Searchable fields */
  searchableFields?: string[];
  /** Layout mode */
  layout?: "table" | "cards";
}

/**
 * Entity detail section configuration
 */
export interface EntityDetailSection {
  /** Section title */
  title: string;
  /** Fields in this section */
  fields?: string[];
  /** Custom component name */
  component?: string;
  /** Permission required to view */
  permission?: string;
}

/**
 * Entity detail view configuration
 */
export interface EntityDetailConfig {
  /** Sections to display */
  sections?: EntityDetailSection[];
}

/**
 * Entity edit view configuration
 */
export interface EntityEditConfig {
  /** Layout mode */
  layout?: "tabs" | "sections" | "single";
  /** Field configurations */
  fields?: Record<string, EntityFieldConfig>;
}

/**
 * Entity UI configuration
 */
export interface EntityUIConfig {
  list?: EntityListConfig;
  detail?: EntityDetailConfig;
  edit?: EntityEditConfig;
}

/**
 * Entity behavioral hooks
 */
export interface EntityHooks<TEntity = unknown> {
  /** Called before save (client-side validation/transform) */
  beforeSave?: (entity: TEntity) => TEntity | Promise<TEntity>;
  /** Called after save */
  afterSave?: (entity: TEntity) => void | Promise<void>;
  /** Called before delete */
  beforeDelete?: (id: string) => boolean | Promise<boolean>;
}

/**
 * Complete entity configuration
 */
export interface EntityConfig<TEntity = unknown> {
  /** Display labels */
  label?: { singular: string; plural: string };
  /** Icon name */
  icon?: string;
  /** UI configuration */
  ui?: EntityUIConfig;
  /** Behavioral hooks */
  hooks?: EntityHooks<TEntity>;
}

/**
 * Widget definition
 */
export interface WidgetConfig {
  /** Widget component */
  component: React.ComponentType<unknown>;
  /** Matcher function for auto-selection */
  match?: (field: { name: string; type: string }) => boolean;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Color overrides */
  colors?: {
    primary?: string;
    secondary?: string;
    [key: string]: string | undefined;
  };
  /** Logo URL */
  logo?: string;
}

/**
 * Hub configuration
 *
 * @public
 * @example
 * ```typescript
 * const config: HubConfig = {
 *   api: {
 *     endpoint: 'https://api.example.com',
 *   },
 *   auth: {
 *     provider: 'workos',
 *     clientId: 'client_xxx',
 *   },
 *   entities: {
 *     customer: {
 *       label: { singular: 'Customer', plural: 'Customers' },
 *       ui: {
 *         list: { columns: ['name', 'email'] },
 *       },
 *     },
 *   },
 * };
 * ```
 */
export interface HubConfig {
  /** API configuration */
  api?: ApiConfig;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Plugins to load */
  plugins?: PluginDefinition[];
  /** Entity configurations */
  entities?: Record<string, EntityConfig>;
  /** Custom widgets */
  widgets?: Record<string, WidgetConfig>;
  /** Component overrides */
  components?: Record<string, React.ComponentType<unknown>>;
  /** Theme customization */
  theme?: ThemeConfig;
}

/**
 * Resolved configuration (after plugin merging)
 */
export interface ResolvedHubConfig extends HubConfig {
  /** Indicates config has been resolved */
  __resolved: true;
}
