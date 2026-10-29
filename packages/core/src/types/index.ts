/**
 * Types Barrel Export
 * All type definitions for @loom-loyalty/core
 */

// Entity and query types
export type { MutationOptions, Page, QueryOptions } from "./entity";

// Provider interfaces
export type { DataProvider } from "./data-provider";

export type {
  AuthOrganization,
  AuthProvider,
  AuthSession,
  AuthUser,
  PermissionCheckResult,
} from "./auth-provider";

export type { HubRoute, NavigateOptions, RouterProvider } from "./router-provider";

// Plugin types
export type {
  ComponentSlotRegistration,
  LifecycleContext,
  LifecycleHandler,
  LifecycleNext,
  PluginConfigContribution,
  PluginDefinition,
  PluginFactory,
  PluginLifecycleHooks,
  PluginMeta,
  PluginSetupContext,
  ResolvedPlugin,
} from "./plugin";

// Config types (compile-time configuration)
export type {
  ApiConfig,
  AuthConfig,
  EntityConfig,
  EntityDetailConfig,
  EntityDetailSection,
  EntityEditConfig,
  EntityFieldConfig,
  EntityHooks,
  EntityListConfig,
  EntityUIConfig,
  HubConfig,
  ResolvedHubConfig,
  ThemeConfig,
  WidgetConfig,
} from "./config";

// Runtime config types (Hub runtime configuration)
export type {
  BrandingConfig,
  ComponentDefinition,
  ComponentManifest,
  ComponentType,
  CustomComponentsConfig,
  // Enum value types
  EntityCodeValue,
  EntityLabelOverride,
  EntityOverride,
  EntityOverrides,
  // Custom component props (for organizations building custom components)
  EntityViewProps,
  FieldMatch,
  HubLocalConfig,
  HubRuntimeConfig,
  MinimalHubConfig,
  NavigationSectionIdValue,
  SystemComponentValue,
  SystemWidgetValue,
  ThemeOverride,
  UISettings,
  WidgetProps,
  WorkOSConfig,
} from "./runtime-config";

// Runtime config enums (const objects for type-safe strings)
export { EntityCode, NavigationSectionId, SystemComponent, SystemWidget } from "./runtime-config";
